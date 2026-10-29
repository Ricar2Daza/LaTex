"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileCodeIcon,
  FilePdfIcon,
  FileWordIcon,
  PlayIcon,
  SpinnerIcon,
} from "@/components/icons";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import type { DownloadKind, HealthResponse, Phase } from "@/lib/studio-types";

interface ToolbarProps {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onCompile: () => void;
  onExport: (kind: DownloadKind) => void;
  onDownloadTex: () => void;
  phase: Phase;
  exporting: DownloadKind | null;
  autoCompile: boolean;
  onToggleAuto: () => void;
  engines: HealthResponse | null;
}

const ghostButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5";

const primaryButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-500 px-2.5 text-[12px] font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_10px_24px_-12px_rgba(99,102,241,0.9)] transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:cursor-not-allowed disabled:opacity-80 sm:px-3";

function TemplateMenu({
  templateId,
  onTemplateChange,
}: {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const current = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[12px] font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 sm:px-2.5"
      >
        <FileCodeIcon size={14} className="hidden shrink-0 text-slate-400 sm:inline" />
        <span className="max-w-[6.5rem] truncate sm:max-w-[9rem]">{current.name}</span>
        <ChevronDownIcon
          size={13}
          className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="fade-in absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-studio-800/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Plantillas
          </p>
          {TEMPLATES.map((template) => {
            const active = template.id === templateId;
            return (
              <button
                key={template.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onTemplateChange(template.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                  active ? "bg-indigo-500/10" : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                    active
                      ? "border-indigo-400 bg-indigo-500 text-white"
                      : "border-slate-600 text-transparent"
                  }`}
                >
                  <CheckIcon size={10} strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-slate-100">
                    {template.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {template.tagline}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="border-t border-white/5 px-2.5 pb-1 pt-2 text-[10.5px] leading-snug text-slate-500">
            Cambiar de plantilla reemplaza el documento (los fragmentos se conservan).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EngineChip({ engines }: { engines: HealthResponse | null }) {
  if (!engines) {
    return (
      <div className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] text-slate-500 sm:flex">
        <SpinnerIcon size={12} />
        <span className="hidden xl:inline">Detectando motores…</span>
      </div>
    );
  }

  const missing = engines.engines.filter((engine) => !engine.available);
  const ok = missing.length === 0;
  const tooltip = engines.engines
    .map((engine) => `${engine.name}: ${engine.available ? engine.version : "no encontrado"}`)
    .join(" · ");

  return (
    <div
      title={ok ? tooltip : `${tooltip} — ejecuta: ${engines.setupCommand}`}
      className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium sm:flex ${
        ok
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-200"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`}
      />
      <span className="hidden xl:inline">
        {ok ? "Motores OK" : `Falta ${missing.map((engine) => engine.name).join(", ")}`}
      </span>
    </div>
  );
}

export function Toolbar({
  templateId,
  onTemplateChange,
  onCompile,
  onExport,
  onDownloadTex,
  phase,
  exporting,
  autoCompile,
  onToggleAuto,
  engines,
}: ToolbarProps) {
  const compiling = phase === "compiling";

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-1 border-b border-white/[0.06] bg-studio-900/70 px-2 backdrop-blur-xl sm:gap-2 sm:px-3">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-[15px] font-semibold text-white shadow-lg shadow-indigo-950/60">
          λ
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[13px] font-semibold tracking-tight text-slate-100">
            LaTeX Studio
          </div>
          <div className="text-[10px] text-slate-500">PDF · Word · tiempo real</div>
        </div>
      </div>

      <div className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" />

      <TemplateMenu templateId={templateId} onTemplateChange={onTemplateChange} />

      <div className="flex-1" />

      <EngineChip engines={engines} />

      <button
        type="button"
        role="switch"
        aria-checked={autoCompile}
        onClick={onToggleAuto}
        title="Compilar automáticamente al escribir"
        className="inline-flex h-8 items-center gap-2 rounded-lg px-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <span
          className={`relative h-4 w-7 rounded-full transition-colors ${
            autoCompile ? "bg-emerald-500/80" : "bg-slate-600/70"
          }`}
        >
          <span
            className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${
              autoCompile ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
        <span className="hidden xl:inline">Auto</span>
      </button>

      <button type="button" onClick={onCompile} disabled={compiling} className={primaryButton}>
        {compiling ? <SpinnerIcon size={13} /> : <PlayIcon size={12} />}
        <span>{compiling ? "Compilando" : "Compilar"}</span>
        <kbd className="ml-0.5 hidden rounded border border-white/25 bg-black/15 px-1 py-px text-[10px] font-medium text-white/80 lg:inline">
          Ctrl ↵
        </kbd>
      </button>

      <div className="mx-0.5 hidden h-6 w-px bg-white/10 md:block" />

      <button
        type="button"
        onClick={() => onExport("pdf")}
        disabled={exporting !== null}
        className={ghostButton}
        title="Descargar como PDF"
      >
        {exporting === "pdf" ? <SpinnerIcon size={13} /> : <FilePdfIcon size={14} />}
        <span className="hidden md:inline">PDF</span>
      </button>

      <button
        type="button"
        onClick={() => onExport("docx")}
        disabled={exporting !== null}
        className={ghostButton}
        title="Descargar como documento de Word (.docx)"
      >
        {exporting === "docx" ? <SpinnerIcon size={13} /> : <FileWordIcon size={14} />}
        <span className="hidden md:inline">Word</span>
      </button>

      <button
        type="button"
        onClick={onDownloadTex}
        className="hidden h-8 items-center justify-center rounded-lg px-2 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 sm:inline-flex"
        title="Descargar el código .tex"
        aria-label="Descargar el código .tex"
      >
        <DownloadIcon size={15} />
      </button>
    </header>
  );
}
