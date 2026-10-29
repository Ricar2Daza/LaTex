"use client";

import { useState } from "react";

import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  TerminalIcon,
  XIcon,
} from "@/components/icons";
import type { LatexIssue } from "@/lib/latex/errors";
import type { CompileFailure } from "@/lib/studio-types";

export type LogTab = "issues" | "log";

interface LogPanelProps {
  failure: CompileFailure | null;
  log: string;
  durationMs: number | null;
  onClose: () => void;
  onGoToLine: (line: number) => void;
}

export function LogPanel({ failure, log, durationMs, onClose, onGoToLine }: LogPanelProps) {
  const [tab, setTab] = useState<LogTab>("issues");
  const [copied, setCopied] = useState(false);

  const issues: LatexIssue[] = failure?.issues ?? [];
  const errors = issues.filter((issue) => issue.severity === "error").length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(log || failure?.error || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="flex h-[15rem] shrink-0 flex-col border-t border-white/[0.06] bg-studio-900">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-white/[0.04] px-2">
        <button
          type="button"
          onClick={() => setTab("issues")}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition ${
            tab === "issues"
              ? "bg-white/[0.06] text-slate-100"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <AlertIcon size={12} className={errors > 0 ? "text-rose-400" : "text-emerald-400"} />
          Problemas
          {issues.length > 0 ? (
            <span className="rounded-full bg-rose-500/15 px-1.5 text-[10px] tabular-nums text-rose-300">
              {issues.length}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/10 px-1.5 text-[10px] text-emerald-300">
              0
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab("log")}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition ${
            tab === "log" ? "bg-white/[0.06] text-slate-100" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <TerminalIcon size={12} />
          Registro
        </button>

        <div className="flex-1" />

        {durationMs !== null ? (
          <span className="hidden text-[10.5px] tabular-nums text-slate-600 sm:inline">
            {durationMs} ms
          </span>
        ) : null}

        <button
          type="button"
          onClick={copy}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          title="Copiar al portapapeles"
          aria-label="Copiar al portapapeles"
        >
          {copied ? <CheckIcon size={13} className="text-emerald-400" /> : <CopyIcon size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          title="Ocultar panel"
          aria-label="Ocultar panel"
        >
          <ChevronDownIcon size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-0.5 inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200 sm:hidden"
          aria-label="Cerrar"
        >
          <XIcon size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "issues" ? (
          issues.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 text-[12px] text-slate-500">
              <CheckIcon size={14} className="text-emerald-400" />
              {failure ? failure.error : "Sin problemas: el documento compila correctamente."}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.03]">
              {issues.map((issue, index) => (
                <li key={`${issue.message}-${index}`}>
                  <button
                    type="button"
                    onClick={() => issue.line && onGoToLine(issue.line)}
                    className="flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <AlertIcon
                      size={13}
                      className={
                        issue.severity === "error"
                          ? "mt-[3px] shrink-0 text-rose-400"
                          : "mt-[3px] shrink-0 text-amber-400"
                      }
                    />
                    <span className="w-10 shrink-0 pt-px text-[11px] tabular-nums text-slate-500">
                      {issue.line ? `L${issue.line}` : "—"}
                    </span>
                    <span className="min-w-0 break-words text-[12px] leading-snug text-slate-300">
                      {issue.message}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-400">
            {log || "Sin registro todavía. Compila el documento para ver la salida de Tectonic y Pandoc."}
          </pre>
        )}
      </div>
    </section>
  );
}
