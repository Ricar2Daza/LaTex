import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";

import { getTemplate } from "@/lib/templates";
import { EngineUnavailableError, requireEngine, tectonicCacheDir } from "./binaries";
import { LruCache } from "./cache";
import { extractBody, extractMetadata, normalizeSource, safeFileName } from "./document";
import { parseLatexLog, summarizeLog, type LatexIssue } from "./errors";
import { preprocessForDocx, wantsTableOfContents } from "./pandoc";
import { runProcess } from "./runner";

export type OutputFormat = "pdf" | "docx";

export interface CompileInput {
  source: string;
  template?: string | null;
}

export interface CompileOutput {
  buffer: Buffer;
  format: OutputFormat;
  mime: string;
  fileName: string;
  bytes: number;
  pages?: number;
  durationMs: number;
  cached: boolean;
  log: string;
  /** true si el texto era un fragmento y se envolvió con la plantilla. */
  wrapped: boolean;
}

export class LatexCompileError extends Error {
  constructor(
    message: string,
    public readonly issues: LatexIssue[],
    public readonly log: string,
    public readonly durationMs: number,
  ) {
    super(message);
    this.name = "LatexCompileError";
  }
}

const MAX_SOURCE_BYTES = 1_000_000;
const PDF_TIMEOUT_MS = 240_000;
const DOCX_TIMEOUT_MS = 120_000;
const CONCURRENCY = 2;

const cache = new LruCache<Omit<CompileOutput, "cached">>();

/* ------------------------------------------------------------------ */
/* Semáforo: como máximo N compilaciones simultáneas (CPU-bound)      */
/* ------------------------------------------------------------------ */
let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    const next = waiting.shift();
    if (next) next();
  }
}

function countPdfPages(pdf: Buffer): number | undefined {
  const raw = pdf.toString("latin1");
  const direct = raw.match(/\/Type\s*\/Page[^s]/g);
  if (direct && direct.length > 0) return direct.length;

  // PDF 1.5+ guarda los objetos de página dentro de object streams comprimidos:
  // inflamos los streams y volvemos a buscar. Si algo falla, no informamos páginas.
  let count = 0;
  for (const chunk of raw.split("endstream")) {
    const start = chunk.lastIndexOf("stream");
    if (start === -1) continue;
    const data = chunk.slice(start + "stream".length).replace(/^\r?\n/, "");
    try {
      const inflated = inflateSync(Buffer.from(data, "latin1")).toString("latin1");
      const matches = inflated.match(/\/Type\s*\/Page[^s]/g);
      if (matches) count += matches.length;
    } catch {
      // Stream no comprimido o con predictor: se ignora.
    }
  }
  return count > 0 ? count : undefined;
}

function readTextSafe(file: string): Promise<string | null> {
  return readFile(file, "utf8").catch(() => null);
}

function buildLog(...chunks: Array<string | null | undefined>): string {
  const text = chunks
    .filter((chunk): chunk is string => Boolean(chunk && chunk.trim()))
    .join("\n\n")
    .split(/\r?\n/)
    .filter((line) => !/^Fontconfig error/i.test(line.trim()))
    .join("\n");
  return summarizeLog(text);
}

async function compilePdf(tex: string, workdir: string, wrapped: boolean, startedAt: number) {
  const tectonic = requireEngine("tectonic");
  await mkdir(tectonicCacheDir(), { recursive: true });
  await writeFile(path.join(workdir, "main.tex"), tex, "utf8");

  const result = await runProcess(
    tectonic.path!,
    ["-X", "compile", "main.tex", "--keep-logs", "--untrusted"],
    {
      cwd: workdir,
      timeoutMs: PDF_TIMEOUT_MS,
      env: { TECTONIC_CACHE_DIR: tectonicCacheDir() },
    },
  );

  const texLog = await readTextSafe(path.join(workdir, "main.log"));
  const log = buildLog(result.stderr, result.stdout, texLog);
  const pdfPath = path.join(workdir, "main.pdf");
  const durationMs = Date.now() - startedAt;

  if (result.error) {
    throw new LatexCompileError(
      `No se pudo ejecutar Tectonic: ${result.error}`,
      [{ severity: "error", message: result.error }],
      log,
      durationMs,
    );
  }

  if (result.timedOut) {
    throw new LatexCompileError(
      `La compilación superó ${Math.round(PDF_TIMEOUT_MS / 1000)} s y se canceló.`,
      [{ severity: "error", message: "Tiempo de compilación agotado." }],
      log,
      durationMs,
    );
  }

  if (result.code !== 0 || !existsSync(pdfPath)) {
    const issues = parseLatexLog(log);
    throw new LatexCompileError(
      issues[0]?.message ?? "La compilación de LaTeX falló.",
      issues,
      log,
      durationMs,
    );
  }

  const buffer = await readFile(pdfPath);
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new LatexCompileError(
      "Tectonic no generó un PDF válido.",
      [{ severity: "error", message: "Salida PDF inválida." }],
      log,
      durationMs,
    );
  }

  return { buffer, log, durationMs, pages: countPdfPages(buffer), wrapped };
}

async function runPandoc(
  tex: string,
  workdir: string,
  inputName: string,
  extraArgs: string[],
): Promise<{ ok: boolean; log: string; durationMs: number }> {
  const pandoc = requireEngine("pandoc");
  const startedAt = Date.now();
  const result = await runProcess(
    pandoc.path!,
    [
      inputName,
      "-f",
      "latex",
      "-t",
      "docx",
      "--standalone",
      "--number-sections",
      "--resource-path",
      ".",
      "-o",
      "main.docx",
      ...extraArgs,
    ],
    { cwd: workdir, timeoutMs: DOCX_TIMEOUT_MS },
  );
  return {
    ok: !result.timedOut && !result.error && result.code === 0,
    log: buildLog(result.stderr, result.stdout),
    durationMs: Date.now() - startedAt,
  };
}

async function compileDocx(tex: string, workdir: string, wrapped: boolean, startedAt: number) {
  const processed = preprocessForDocx(tex);
  const texPath = path.join(workdir, "main.tex");
  await writeFile(texPath, processed, "utf8");

  const extra = wantsTableOfContents(processed) ? ["--toc", "--toc-depth=3"] : [];
  let attempt = await runPandoc(processed, workdir, "main.tex", extra);

  // Segundo intento: si el preámbulo tiene cosas que Pandoc no entiende,
  // convertimos solo el cuerpo y pasamos los metadatos por CLI.
  if (!attempt.ok) {
    const body = extractBody(processed);
    if (body) {
      const meta = extractMetadata(processed);
      const metaArgs: string[] = [];
      if (meta.title) metaArgs.push("-M", `title=${meta.title}`);
      if (meta.author) metaArgs.push("-M", `author=${meta.author}`);
      if (meta.date) metaArgs.push("-M", `date=${meta.date}`);
      await writeFile(path.join(workdir, "body.tex"), body, "utf8");
      const retry = await runPandoc(body, workdir, "body.tex", [...extra, ...metaArgs]);
      if (retry.ok) {
        attempt = { ...retry, log: buildLog(attempt.log, "· Reintento sin preámbulo.", retry.log) };
      }
    }
  }

  const docxPath = path.join(workdir, "main.docx");
  const durationMs = Date.now() - startedAt;

  if (!attempt.ok || !existsSync(docxPath)) {
    const issues = parseLatexLog(attempt.log);
    throw new LatexCompileError(
      issues[0]?.message ?? "Pandoc no pudo convertir el documento a Word.",
      issues,
      attempt.log,
      durationMs,
    );
  }

  const buffer = await readFile(docxPath);
  if (buffer.subarray(0, 2).toString("latin1") !== "PK") {
    throw new LatexCompileError(
      "Pandoc no generó un .docx válido.",
      [{ severity: "error", message: "Salida DOCX inválida." }],
      attempt.log,
      durationMs,
    );
  }

  return { buffer, log: attempt.log, durationMs, wrapped };
}

export async function compileDocument(
  input: CompileInput,
  format: OutputFormat,
): Promise<CompileOutput> {
  const source = typeof input.source === "string" ? input.source : "";
  if (!source.trim()) {
    throw new LatexCompileError(
      "El documento está vacío.",
      [{ severity: "error", message: "Escribe algo de LaTeX para compilar." }],
      "",
      0,
    );
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    throw new LatexCompileError(
      "El documento es demasiado grande (máximo 1 MB).",
      [{ severity: "error", message: "Documento demasiado grande." }],
      "",
      0,
    );
  }

  const template = getTemplate(input.template);
  const { tex, wrapped } = normalizeSource(source, template);
  const metadata = extractMetadata(tex);
  const fallbackName = template.id === "cv" ? "curriculum" : "documento";
  const fileName = `${safeFileName(metadata.title, fallbackName)}.${format}`;

  const key = createHash("sha256")
    .update(`${format}|${template.id}|${tex}`)
    .digest("hex");

  const hit = cache.get(key);
  if (hit) {
    return { ...hit, fileName, cached: true };
  }

  const startedAt = Date.now();
  const workdir = await mkdtemp(path.join(os.tmpdir(), "latex-studio-"));

  try {
    const result = await withSlot(() =>
      format === "pdf"
        ? compilePdf(tex, workdir, wrapped, startedAt)
        : compileDocx(tex, workdir, wrapped, startedAt),
    );

    const output: Omit<CompileOutput, "cached"> = {
      ...result,
      format,
      mime:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName,
      bytes: result.buffer.length,
    };

    cache.set(key, output, result.buffer.length);
    return { ...output, cached: false };
  } finally {
    await rm(workdir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

export { EngineUnavailableError };
