"use client";

import {
  AlertIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshIcon,
  SparklesIcon,
  SpinnerIcon,
} from "@/components/icons";
import type { CompileFailure, CompileMeta, Phase } from "@/lib/studio-types";

interface PreviewPaneProps {
  pdfUrl: string | null;
  phase: Phase;
  meta: CompileMeta | null;
  failure: CompileFailure | null;
  onCompile: () => void;
  onOpenExternal: () => void;
  onDownload: () => void;
  onShowLog: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const iconButton =
  "inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-35";

export function PreviewPane({
  pdfUrl,
  phase,
  meta,
  failure,
  onCompile,
  onOpenExternal,
  onDownload,
  onShowLog,
}: PreviewPaneProps) {
  const compiling = phase === "compiling";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-studio-850">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-studio-900/40 px-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${
              phase === "error"
                ? "bg-rose-400"
                : compiling
                  ? "bg-amber-400"
                  : pdfUrl
                    ? "bg-emerald-400"
                    : "bg-slate-600"
            }`}
          />
          <span className="text-[11px] font-medium text-slate-400">Vista previa</span>
        </div>

        {meta && phase !== "error" ? (
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 tabular-nums">
              {meta.pages ? `${meta.pages} pág.` : formatBytes(meta.bytes)}
            </span>
            {meta.pages ? (
              <span className="hidden rounded bg-white/[0.04] px-1.5 py-0.5 tabular-nums lg:inline">
                {formatBytes(meta.bytes)}
              </span>
            ) : null}
            <span className="hidden tabular-nums sm:inline">
              {meta.cached ? "caché" : formatMs(meta.durationMs)}
            </span>
          </div>
        ) : null}

        {compiling ? (
          <span className="flex items-center gap-1 text-[10.5px] text-amber-300/90">
            <SpinnerIcon size={10} />
            compilando
          </span>
        ) : null}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onCompile}
          className={iconButton}
          title="Recompilar"
          aria-label="Recompilar"
          disabled={compiling}
        >
          <RefreshIcon size={13} />
        </button>
        <button
          type="button"
          onClick={onOpenExternal}
          className={iconButton}
          title="Abrir el PDF en una pestaña nueva"
          aria-label="Abrir el PDF en una pestaña nueva"
          disabled={!pdfUrl}
        >
          <ExternalLinkIcon size={13} />
        </button>
        <button
          type="button"
          onClick={onDownload}
          className={iconButton}
          title="Descargar el PDF"
          aria-label="Descargar el PDF"
          disabled={!pdfUrl}
        >
          <DownloadIcon size={13} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {compiling ? (
          <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-indigo-500/10">
            <div className="progress-bar h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
          </div>
        ) : null}

        {pdfUrl ? (
          <iframe
            key={pdfUrl}
            src={`${pdfUrl}#view=FitH`}
            title="Vista previa del PDF compilado"
            className="h-full w-full border-0 bg-neutral-800"
          />
        ) : (
          <div className="grid h-full place-items-center px-6 py-10">
            <div className="max-w-sm text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-indigo-300">
                <SparklesIcon size={20} />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-slate-200">
                {failure ? "No se pudo generar el PDF" : "Aún no hay vista previa"}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
                {failure
                  ? "Revisa los problemas detectados y corrige el código para volver a compilar."
                  : "Pulsa «Compilar» o escribe en el editor: el PDF se regenera automáticamente."}
              </p>
              <button
                type="button"
                onClick={failure ? onShowLog : onCompile}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                {failure ? <AlertIcon size={13} /> : <SparklesIcon size={13} />}
                {failure ? "Ver detalles del error" : "Compilar ahora"}
              </button>
            </div>
          </div>
        )}

        {failure ? (
          <div
            role="alert"
            className="fade-in absolute inset-x-2 top-2 z-10 rounded-lg border border-rose-500/25 bg-rose-950/85 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-md"
          >
            <div className="flex items-start gap-2">
              <AlertIcon size={14} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-rose-100">{failure.error}</p>
                {failure.issues.length > 1 ? (
                  <p className="mt-0.5 text-[11px] text-rose-300/80">
                    {failure.issues.length} problemas detectados
                    {pdfUrl ? " · se muestra la última versión correcta" : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onShowLog}
                className="shrink-0 rounded-md border border-rose-400/25 px-2 py-0.5 text-[11px] font-medium text-rose-200 transition hover:bg-rose-500/15"
              >
                Detalles
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
