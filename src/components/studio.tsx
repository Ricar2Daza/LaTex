"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import LatexEditor, { type EditorHandle } from "@/components/editor";
import { AlertIcon, CodeIcon, EyeIcon, TerminalIcon } from "@/components/icons";
import { LogPanel } from "@/components/log-panel";
import { PreviewPane } from "@/components/preview";
import { Toolbar } from "@/components/toolbar";
import { extractMetadata, hasDocumentEnvironment, safeFileName } from "@/lib/latex/document";
import { DEFAULT_TEMPLATE_ID, TEMPLATES, getTemplate, renderTemplate, type TemplateId } from "@/lib/templates";
import {
  SPLIT_MAX,
  SPLIT_MIN,
  type CompileFailure,
  type CompileMeta,
  type DownloadKind,
  type HealthResponse,
  type Phase,
} from "@/lib/studio-types";

const STORAGE_KEY = "latex-studio:v1";
const DEFAULT_TEMPLATE = getTemplate(DEFAULT_TEMPLATE_ID);
const DEFAULT_SOURCE = renderTemplate(DEFAULT_TEMPLATE);

interface PersistedState {
  source?: string;
  templateId?: string;
  autoCompile?: boolean;
  split?: number;
}

function signature(templateId: string, source: string): string {
  return `${templateId}\u0000${source}`;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function parseFileName(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

async function toFailure(response: Response): Promise<CompileFailure> {
  const fallback: CompileFailure = {
    error: `Error ${response.status}`,
    issues: [],
    log: "",
    durationMs: 0,
    kind: "compile",
  };
  try {
    const data = (await response.json()) as Partial<CompileFailure>;
    return {
      error: typeof data.error === "string" ? data.error : fallback.error,
      issues: Array.isArray(data.issues) ? data.issues : [],
      log: typeof data.log === "string" ? data.log : "",
      durationMs: typeof data.durationMs === "number" ? data.durationMs : 0,
      kind: data.kind ?? "compile",
    };
  } catch {
    return fallback;
  }
}

export function Studio() {
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE_ID);
  const [autoCompile, setAutoCompile] = useState(true);
  const [split, setSplit] = useState(52);
  const [dragging, setDragging] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<CompileMeta | null>(null);
  const [failure, setFailure] = useState<CompileFailure | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [lastLog, setLastLog] = useState("");
  const [exporting, setExporting] = useState<DownloadKind | null>(null);
  const [engines, setEngines] = useState<HealthResponse | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [toast, setToast] = useState<string | null>(null);

  const editorRef = useRef<EditorHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const attemptRef = useRef(0);
  const lastAttemptSignature = useRef<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const exportingRef = useRef<DownloadKind | null>(null);
  const phaseRef = useRef<Phase>("idle");

  const sourceRef = useRef(source);
  const templateRef = useRef(templateId);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    templateRef.current = templateId;
  }, [templateId]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* ---------------------------------------------------------------- */
  /* Sesión: restaurar y guardar                                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    // Hidratación única del estado persistido: se hace en un efecto para no
    // romper la hidratación de React (el HTML del servidor no conoce localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedState;
        if (typeof saved.source === "string" && saved.source.trim().length > 0) {
          setSource(saved.source);
        }
        if (typeof saved.templateId === "string") {
          setTemplateId(getTemplate(saved.templateId).id);
        }
        if (typeof saved.autoCompile === "boolean") setAutoCompile(saved.autoCompile);
        if (typeof saved.split === "number") {
          setSplit(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, saved.split)));
        }
      }
    } catch {
      // localStorage no disponible: seguimos con la plantilla por defecto.
    }

    fetch("/api/health")
      .then((response) => (response.ok ? (response.json() as Promise<HealthResponse>) : null))
      .then((data) => setEngines(data))
      .catch(() => setEngines(null));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ source, templateId, autoCompile, split } satisfies PersistedState),
        );
      } catch {
        // Ignorado: modo privado o cuota llena.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [mounted, source, templateId, autoCompile, split]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Compilación                                                      */
  /* ---------------------------------------------------------------- */
  const runCompile = useCallback(async () => {
    const currentSource = sourceRef.current;
    const currentTemplate = templateRef.current;
    lastAttemptSignature.current = signature(currentTemplate, currentSource);

    if (!currentSource.trim()) {
      setPhase("idle");
      setFailure(null);
      return;
    }

    const attemptId = ++attemptRef.current;
    setPhase("compiling");

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: currentSource, template: currentTemplate }),
      });

      if (attemptId !== attemptRef.current) return;

      if (!response.ok) {
        const problem = await toFailure(response);
        setFailure(problem);
        setLastLog(problem.log);
        setPhase("error");
        if (phaseRef.current !== "error") setLogOpen(true);
        return;
      }

      const blob = await response.blob();
      if (attemptId !== attemptRef.current) return;

      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);

      const pagesHeader = Number(response.headers.get("x-pdf-pages") ?? "");
      setMeta({
        durationMs: Number(response.headers.get("x-compile-ms") ?? 0),
        cached: response.headers.get("x-compile-cached") === "true",
        pages: Number.isFinite(pagesHeader) && pagesHeader > 0 ? pagesHeader : undefined,
        bytes: blob.size,
        wrapped: response.headers.get("x-source-wrapped") === "true",
      });
      setFailure(null);
      setPhase("success");
    } catch {
      if (attemptId !== attemptRef.current) return;
      const problem: CompileFailure = {
        error: "No se pudo contactar con el servidor de compilación.",
        issues: [],
        log: "",
        durationMs: 0,
        kind: "compile",
      };
      setFailure(problem);
      setPhase("error");
      if (phaseRef.current !== "error") setLogOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !autoCompile) return;
    if (lastAttemptSignature.current === signature(templateId, source)) return;
    const delay = lastAttemptSignature.current === null ? 150 : 900;
    const timer = setTimeout(() => void runCompile(), delay);
    return () => clearTimeout(timer);
  }, [mounted, autoCompile, source, templateId, runCompile]);

  /* ---------------------------------------------------------------- */
  /* Exportación y descargas                                          */
  /* ---------------------------------------------------------------- */
  const handleExport = useCallback(async (kind: DownloadKind) => {
    if (exportingRef.current) return;
    exportingRef.current = kind;
    setExporting(kind);

    try {
      const response = await fetch(kind === "pdf" ? "/api/export/pdf" : "/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceRef.current, template: templateRef.current }),
      });

      if (!response.ok) {
        const problem = await toFailure(response);
        setFailure(problem);
        setLastLog(problem.log);
        setPhase("error");
        setLogOpen(true);
        setToast(problem.error);
        return;
      }

      const blob = await response.blob();
      const fallback = `documento.${kind}`;
      const filename = parseFileName(response.headers.get("content-disposition"), fallback);
      saveBlob(blob, filename);
      setToast(`Descargado: ${filename}`);
    } catch {
      setToast("No se pudo generar el archivo. Revisa la conexión con el servidor.");
    } finally {
      exportingRef.current = null;
      setExporting(null);
    }
  }, []);

  const handleDownloadTex = useCallback(() => {
    const current = sourceRef.current;
    const { title } = extractMetadata(current);
    const filename = `${safeFileName(title)}.tex`;
    saveBlob(new Blob([current], { type: "application/x-tex;charset=utf-8" }), filename);
    setToast(`Descargado: ${filename}`);
  }, []);

  const handleOpenPdf = useCallback(() => {
    if (pdfUrlRef.current) {
      window.open(pdfUrlRef.current, "_blank", "noopener,noreferrer");
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Plantillas                                                       */
  /* ---------------------------------------------------------------- */
  const handleTemplateChange = useCallback((nextId: TemplateId) => {
    if (nextId === templateRef.current) return;
    const next = getTemplate(nextId);
    const current = sourceRef.current;

    // Un fragmento se conserva: solo cambia el preámbulo con el que se compila.
    if (!hasDocumentEnvironment(current)) {
      setTemplateId(nextId);
      setToast(`El fragmento se compilará con «${next.name}»`);
      return;
    }

    const untouched = TEMPLATES.some((template) => renderTemplate(template).trim() === current.trim());
    if (
      !untouched &&
      !window.confirm(
        `Se reemplazará el documento actual por la plantilla «${next.name}». ¿Quieres continuar?`,
      )
    ) {
      return;
    }

    setTemplateId(nextId);
    setSource(renderTemplate(next));
    setToast(`Plantilla «${next.name}» aplicada`);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Atajos de teclado                                                */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void runCompile();
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleDownloadTex();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runCompile, handleDownloadTex]);

  /* ---------------------------------------------------------------- */
  /* Divisor redimensionable                                          */
  /* ---------------------------------------------------------------- */
  const onDividerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = true;
    setDragging(true);
  };

  const onDividerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    setSplit(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, percent)));
  };

  const onDividerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Derivados                                                        */
  /* ---------------------------------------------------------------- */
  const lineCount = source.split("\n").length;
  const charCount = source.length;
  const errorCount = failure?.issues.filter((issue) => issue.severity === "error").length ?? 0;
  const tectonic = engines?.engines.find((engine) => engine.name === "tectonic");
  const pandoc = engines?.engines.find((engine) => engine.name === "pandoc");

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-studio-950"
      style={{ "--split": `${split}%` } as CSSProperties}
    >
      <Toolbar
        templateId={templateId}
        onTemplateChange={handleTemplateChange}
        onCompile={() => void runCompile()}
        onExport={(kind) => void handleExport(kind)}
        onDownloadTex={handleDownloadTex}
        phase={phase}
        exporting={exporting}
        autoCompile={autoCompile}
        onToggleAuto={() => setAutoCompile((value) => !value)}
        engines={engines}
      />

      {engines && !engines.ready ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-3 py-1.5 text-[11.5px] text-amber-200">
          <AlertIcon size={13} className="shrink-0" />
          <span>
            Faltan los motores nativos. Ejecuta{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-amber-100">
              {engines.setupCommand}
            </code>{" "}
            y recarga la página.
          </span>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-studio-900 px-2 py-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium transition ${
            mobileView === "editor" ? "bg-white/[0.08] text-slate-100" : "text-slate-500"
          }`}
        >
          <CodeIcon size={13} />
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium transition ${
            mobileView === "preview" ? "bg-white/[0.08] text-slate-100" : "text-slate-500"
          }`}
        >
          <EyeIcon size={13} />
          Vista previa
          {pdfUrl ? <span className="size-1.5 rounded-full bg-emerald-400" /> : null}
        </button>
      </div>

      <main ref={containerRef} className="flex min-h-0 flex-1">
        <section
          className={`min-h-0 min-w-0 flex-col border-white/[0.06] lg:flex lg:w-auto lg:shrink-0 lg:grow-0 lg:basis-[var(--split)] lg:border-r ${
            mobileView === "editor" ? "flex w-full" : "hidden"
          } ${dragging ? "pointer-events-none" : ""}`}
        >
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-studio-900/40 px-2.5">
            <div className="flex h-7 items-center gap-1.5 rounded-md bg-studio-800 px-2 text-[11px] font-medium text-slate-300 ring-1 ring-white/[0.06]">
              <span className="size-1.5 rounded-full bg-amber-400/70" />
              main.tex
            </div>
            {meta?.wrapped ? (
              <span
                className="hidden rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 sm:inline"
                title="El contenido es un fragmento: se envuelve con el preámbulo de la plantilla."
              >
                fragmento
              </span>
            ) : null}
            <div className="flex-1" />
            <span className="text-[10.5px] tabular-nums text-slate-600">{lineCount} líneas</span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden" onMouseDown={() => editorRef.current?.focus()}>
            <LatexEditor
              value={source}
              onChange={setSource}
              onCursor={(line, column) => setCursor({ line, column })}
              onReady={(handle) => {
                editorRef.current = handle;
              }}
            />
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar los paneles"
          aria-valuenow={Math.round(split)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabIndex={0}
          onPointerDown={onDividerDown}
          onPointerMove={onDividerMove}
          onPointerUp={onDividerUp}
          onPointerCancel={onDividerUp}
          onDoubleClick={() => setSplit(52)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setSplit((value) => Math.max(SPLIT_MIN, value - 2));
            if (event.key === "ArrowRight") setSplit((value) => Math.min(SPLIT_MAX, value + 2));
          }}
          className="group hidden w-1.5 shrink-0 cursor-col-resize touch-none items-center justify-center bg-studio-950 transition-colors hover:bg-indigo-500/10 focus-visible:bg-indigo-500/10 focus-visible:outline-none lg:flex"
        >
          <div className="h-9 w-[3px] rounded-full bg-white/10 transition group-hover:bg-indigo-400/70" />
        </div>

        <section
          className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${
            mobileView === "preview" ? "flex w-full" : "hidden"
          } ${dragging ? "pointer-events-none" : ""}`}
        >
          <PreviewPane
            pdfUrl={pdfUrl}
            phase={phase}
            meta={meta}
            failure={failure}
            onCompile={() => void runCompile()}
            onOpenExternal={handleOpenPdf}
            onDownload={() => void handleExport("pdf")}
            onShowLog={() => setLogOpen(true)}
          />
        </section>
      </main>

      {logOpen ? (
        <LogPanel
          failure={failure}
          log={lastLog}
          durationMs={failure ? failure.durationMs : meta ? meta.durationMs : null}
          onClose={() => setLogOpen(false)}
          onGoToLine={(line) => {
            editorRef.current?.revealLine(line);
            setMobileView("editor");
          }}
        />
      ) : null}

      <footer className="flex h-7 shrink-0 items-center gap-2.5 border-t border-white/[0.06] bg-studio-950 px-3 text-[10.5px] text-slate-600">
        <span className="font-medium text-slate-500">LaTeX</span>
        <span className="tabular-nums">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="hidden tabular-nums sm:inline">{charCount} caracteres</span>

        <div className="flex-1" />

        {errorCount > 0 ? (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="font-medium text-rose-400 transition hover:text-rose-300"
          >
            {errorCount} {errorCount === 1 ? "error" : "errores"}
          </button>
        ) : phase === "success" ? (
          <span className="text-emerald-500/80">compilado</span>
        ) : phase === "compiling" ? (
          <span className="text-amber-400/80">compilando…</span>
        ) : null}

        {meta?.pages && errorCount === 0 ? <span className="tabular-nums">{meta.pages} pág.</span> : null}

        <button
          type="button"
          onClick={() => setLogOpen((value) => !value)}
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-white/5 hover:text-slate-300 ${
            logOpen ? "text-slate-300" : ""
          }`}
          title="Mostrar u ocultar el registro de compilación"
        >
          <TerminalIcon size={11} />
          <span className="hidden sm:inline">Registro</span>
        </button>

        <span className="hidden items-center gap-1 md:flex" title={tectonic?.version ?? "Tectonic"}>
          <span
            className={`size-1.5 rounded-full ${tectonic?.available ? "bg-emerald-500/70" : "bg-rose-500/70"}`}
          />
          Tectonic
        </span>
        <span className="hidden items-center gap-1 md:flex" title={pandoc?.version ?? "Pandoc"}>
          <span
            className={`size-1.5 rounded-full ${pandoc?.available ? "bg-emerald-500/70" : "bg-rose-500/70"}`}
          />
          Pandoc
        </span>
      </footer>

      {toast ? (
        <div className="fade-in pointer-events-none fixed bottom-11 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-studio-800/95 px-3 py-1.5 text-[11.5px] text-slate-200 shadow-2xl shadow-black/60 backdrop-blur">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
