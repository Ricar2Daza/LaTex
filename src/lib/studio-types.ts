import type { LatexIssue } from "@/lib/latex/errors";

export type Phase = "idle" | "compiling" | "success" | "error";

export interface CompileMeta {
  durationMs: number;
  cached: boolean;
  pages?: number;
  bytes: number;
  wrapped: boolean;
}

export interface CompileFailure {
  error: string;
  issues: LatexIssue[];
  log: string;
  durationMs: number;
  kind: "compile" | "engine" | "input";
}

export interface EngineStatus {
  name: string;
  available: boolean;
  version: string | null;
  origin: string | null;
  note: string | null;
}

export interface HealthResponse {
  ready: boolean;
  engines: EngineStatus[];
  setupCommand: string;
}

export type DownloadKind = "pdf" | "docx";

/** Ancho mínimo/máximo del panel del editor (porcentaje). */
export const SPLIT_MIN = 28;
export const SPLIT_MAX = 72;
