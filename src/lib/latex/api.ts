import { getEngineInfo } from "./binaries";
import {
  compileDocument,
  EngineUnavailableError,
  LatexCompileError,
  type CompileOutput,
  type OutputFormat,
} from "./compile";
import type { LatexIssue } from "./errors";

interface ErrorPayload {
  error: string;
  issues: LatexIssue[];
  log: string;
  durationMs: number;
  kind: "compile" | "engine" | "input";
}

function jsonError(payload: ErrorPayload, status: number): Response {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function fileResponse(output: CompileOutput, download: boolean): Response {
  const disposition = download ? "attachment" : "inline";
  return new Response(new Uint8Array(output.buffer), {
    status: 200,
    headers: {
      "Content-Type": output.mime,
      "Content-Length": String(output.bytes),
      "Content-Disposition": `${disposition}; filename="${output.fileName}"`,
      "Cache-Control": "no-store",
      "X-Compile-Ms": String(output.durationMs),
      "X-Compile-Cached": String(output.cached),
      "X-Source-Wrapped": String(output.wrapped),
      ...(output.pages ? { "X-Pdf-Pages": String(output.pages) } : {}),
    },
  });
}

/** Punto de entrada común para /api/compile y /api/export/*. */
export async function handleCompile(
  request: Request,
  format: OutputFormat,
  download: boolean,
): Promise<Response> {
  let body: { source?: unknown; template?: unknown };
  try {
    body = (await request.json()) as { source?: unknown; template?: unknown };
  } catch {
    return jsonError(
      {
        error: "El cuerpo de la petición debe ser JSON.",
        issues: [],
        log: "",
        durationMs: 0,
        kind: "input",
      },
      400,
    );
  }

  if (typeof body.source !== "string") {
    return jsonError(
      {
        error: 'Falta el campo "source" con el código LaTeX.',
        issues: [],
        log: "",
        durationMs: 0,
        kind: "input",
      },
      400,
    );
  }

  try {
    const output = await compileDocument(
      {
        source: body.source,
        template: typeof body.template === "string" ? body.template : null,
      },
      format,
    );
    return fileResponse(output, download);
  } catch (error) {
    if (error instanceof LatexCompileError) {
      return jsonError(
        {
          error: error.message,
          issues: error.issues,
          log: error.log,
          durationMs: error.durationMs,
          kind: /demasiado grande/i.test(error.message) ? "input" : "compile",
        },
        /demasiado grande/i.test(error.message) ? 413 : 422,
      );
    }
    if (error instanceof EngineUnavailableError) {
      return jsonError(
        { error: error.message, issues: [], log: "", durationMs: 0, kind: "engine" },
        503,
      );
    }
    const message = error instanceof Error ? error.message : "Error inesperado del servidor.";
    return jsonError(
      { error: message, issues: [], log: "", durationMs: 0, kind: "compile" },
      500,
    );
  }
}

/** Estado de los motores nativos (para mostrar avisos en la interfaz). */
export function enginesStatus() {
  const pandoc = getEngineInfo("pandoc");
  const tectonic = getEngineInfo("tectonic");
  return {
    ready: pandoc.available && tectonic.available,
    engines: [tectonic, pandoc].map((engine) => ({
      name: engine.name,
      available: engine.available,
      version: engine.version ?? null,
      origin: engine.origin ?? null,
      note: engine.note ?? null,
    })),
    setupCommand: "npm run setup:tools",
  };
}
