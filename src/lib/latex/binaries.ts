import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type EngineName = "pandoc" | "tectonic";

export interface EngineInfo {
  name: EngineName;
  available: boolean;
  version?: string;
  path?: string;
  /** De dónde salió el binario: proyecto (.tools), variable de entorno o PATH. */
  origin?: "project" | "env" | "path";
  /** Agranda la primera compilación (descarga del bundle de TeX). */
  note?: string;
}

const EXE = process.platform === "win32" ? ".exe" : "";
const PROJECT_ROOT = process.cwd();
const BIN_DIR = path.join(PROJECT_ROOT, ".tools", "bin");

const ENV_VARS: Record<EngineName, string> = {
  pandoc: "PANDOC_PATH",
  tectonic: "TECTONIC_PATH",
};

const MISSING_TTL_MS = 8_000;
const memo = new Map<string, { info: EngineInfo; at: number }>();

function probe(candidate: string, origin: EngineInfo["origin"]): EngineInfo | null {
  const result = spawnSync(candidate, ["--version"], {
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
    shell: false,
  });
  if (result.error || result.status !== 0) return null;
  const firstLine = `${result.stdout ?? ""}`.split(/\r?\n/)[0]?.trim() ?? "";
  return {
    name: "pandoc",
    available: true,
    version: firstLine || "desconocida",
    path: candidate,
    origin,
  };
}

function candidates(name: EngineName): Array<{ candidate: string; origin: EngineInfo["origin"] }> {
  const list: Array<{ candidate: string; origin: EngineInfo["origin"] }> = [];
  const fromEnv = process.env[ENV_VARS[name]];
  if (fromEnv) list.push({ candidate: fromEnv, origin: "env" });

  const local = path.join(BIN_DIR, name + EXE);
  if (fs.existsSync(local)) list.push({ candidate: local, origin: "project" });

  // Último recurso: el binario que esté en el PATH del sistema.
  list.push({ candidate: name, origin: "path" });
  return list;
}

/**
 * Localiza un binario y devuelve su versión. Cachea los aciertos y los fallos
 * (los fallos por pocos segundos, para que el usuario pueda instalarlos en
 * caliente sin reiniciar el servidor).
 */
export function getEngineInfo(name: EngineName): EngineInfo {
  const cached = memo.get(name);
  if (cached && (cached.info.available || Date.now() - cached.at < MISSING_TTL_MS)) {
    return cached.info;
  }

  for (const { candidate, origin } of candidates(name)) {
    const info = probe(candidate, origin);
    if (info) {
      const resolved: EngineInfo = { ...info, name };
      memo.set(name, { info: resolved, at: Date.now() });
      return resolved;
    }
  }

  const missing: EngineInfo = {
    name,
    available: false,
    note: `No encontrado. Ejecuta "npm run setup:tools" o define ${ENV_VARS[name]}.`,
  };
  memo.set(name, { info: missing, at: Date.now() });
  return missing;
}

export class EngineUnavailableError extends Error {
  constructor(public engine: EngineName) {
    super(
      `El motor "${engine}" no está disponible. Ejecuta "npm run setup:tools" para descargarlo.`,
    );
    this.name = "EngineUnavailableError";
  }
}

export function requireEngine(name: EngineName): EngineInfo {
  const info = getEngineInfo(name);
  if (!info.available || !info.path) throw new EngineUnavailableError(name);
  return info;
}

/** Carpeta de caché del bundle de TeX, dentro del proyecto para que sea reproducible. */
export function tectonicCacheDir(): string {
  return process.env.TECTONIC_CACHE_DIR ?? path.join(PROJECT_ROOT, ".tools", "tectonic-cache");
}

export function toolsBinDir(): string {
  return BIN_DIR;
}
