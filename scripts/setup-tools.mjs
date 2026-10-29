#!/usr/bin/env node
/**
 * Descarga las herramientas nativas que usa el backend de conversión:
 *   - Tectonic  -> motor LaTeX autocontenido (LaTeX -> PDF)
 *   - Pandoc    -> conversor universal (LaTeX -> DOCX)
 *
 * Los binarios se guardan en `.tools/bin` (ignorado por git).
 *
 * Uso:
 *   node scripts/setup-tools.mjs            # instala lo que falte
 *   node scripts/setup-tools.mjs --force    # reinstala todo
 *   node scripts/setup-tools.mjs --prewarm  # además compila un doc de prueba
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BIN_DIR = path.join(ROOT, ".tools", "bin");
const CACHE_DIR = path.join(ROOT, ".tools", "tectonic-cache");
const TMP_DIR = path.join(ROOT, ".tools", "tmp");
const EXE = process.platform === "win32" ? ".exe" : "";

const TECTONIC_VERSION = "0.17.0";
const PANDOC_VERSION = "3.13";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const PREWARM = args.has("--prewarm");

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function platformMatrix() {
  const { platform, arch } = process;
  if (platform === "win32" && arch === "x64")
    return { tectonic: "x86_64-pc-windows-msvc", pandoc: "windows-x86_64", ext: "zip" };
  if (platform === "darwin" && arch === "arm64")
    return { tectonic: "aarch64-apple-darwin", pandoc: "arm64-macOS", ext: "tar.gz" };
  if (platform === "darwin" && arch === "x64")
    return { tectonic: "x86_64-apple-darwin", pandoc: "x86_64-macOS", ext: "tar.gz" };
  if (platform === "linux" && arch === "x64")
    return { tectonic: "x86_64-unknown-linux-musl", pandoc: "linux-amd64", ext: "tar.gz" };
  if (platform === "linux" && arch === "arm64")
    return { tectonic: "aarch64-unknown-linux-musl", pandoc: "linux-arm64", ext: "tar.gz" };
  throw new Error(`Plataforma no soportada por el auto-instalador: ${platform}/${arch}`);
}

async function download(url, destFile) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(destFile, buf);
  return buf.length;
}

function extract(archive, destDir) {
  // `tar` (bsdtar) viene con Windows 10+, macOS y Linux y entiende .zip y .tar.gz
  const result = spawnSync("tar", ["-xf", archive, "-C", destDir], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`No se pudo extraer ${path.basename(archive)}`);
}

async function findFile(dir, fileName) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFile(full, fileName);
      if (found) return found;
    } else if (entry.name === fileName) {
      return full;
    }
  }
  return null;
}

function hasBinary(name) {
  return fs.existsSync(path.join(BIN_DIR, name + EXE));
}

function run(name, argv, options = {}) {
  const result = spawnSync(path.join(BIN_DIR, name + EXE), argv, {
    encoding: "utf8",
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 240_000,
    windowsHide: true,
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

async function install({ name, version, url, archiveName }) {
  const dest = path.join(BIN_DIR, name + EXE);
  if (!FORCE && hasBinary(name)) {
    console.log(`${c.green("✔")} ${c.bold(name)} ya instalado ${c.dim(`(${dest})`)}`);
    return;
  }

  console.log(`${c.cyan("↓")} Descargando ${c.bold(name)} ${version}…`);
  const work = await fsp.mkdtemp(path.join(TMP_DIR, `${name}-`));
  const archive = path.join(work, archiveName);
  const bytes = await download(url, archive);
  console.log(`  ${c.dim(`${(bytes / 1_048_576).toFixed(1)} MB · extrayendo…`)}`);
  extract(archive, work);

  const found = await findFile(work, name + EXE);
  if (!found) throw new Error(`El archivo ${name}${EXE} no está en el paquete descargado`);

  await fsp.mkdir(BIN_DIR, { recursive: true });
  await fsp.copyFile(found, dest);
  if (process.platform !== "win32") await fsp.chmod(dest, 0o755);
  await fsp.rm(work, { recursive: true, force: true });
  console.log(`${c.green("✔")} ${c.bold(name)} listo ${c.dim(`(${dest})`)}`);
}

async function main() {
  console.log(c.bold("\nLaTeX Studio · setup de motores\n"));
  await fsp.mkdir(TMP_DIR, { recursive: true });
  const matrix = platformMatrix();

  await install({
    name: "tectonic",
    version: `v${TECTONIC_VERSION}`,
    url: `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${matrix.tectonic}.${matrix.ext}`,
    archiveName: `tectonic-${TECTONIC_VERSION}.${matrix.ext}`,
  });

  await install({
    name: "pandoc",
    version: `v${PANDOC_VERSION}`,
    url: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-${matrix.pandoc}.${matrix.ext}`,
    archiveName: `pandoc-${PANDOC_VERSION}.${matrix.ext}`,
  });

  console.log("");
  for (const name of ["tectonic", "pandoc"]) {
    const result = run(name, ["--version"]);
    const firstLine = result.out.split("\n")[0] ?? "";
    console.log(
      `${result.code === 0 ? c.green("✔") : c.red("✘")} ${c.bold(name)} ${c.dim(firstLine.slice(0, 70))}`,
    );
  }

  if (PREWARM) {
    console.log(
      `\n${c.cyan("⚡")} Precalentando el bundle de TeX (la primera vez descarga ~100 MB)…`,
    );
    const work = await fsp.mkdtemp(path.join(TMP_DIR, "prewarm-"));
    await fsp.writeFile(
      path.join(work, "prewarm.tex"),
      "\\documentclass{article}\\begin{document}Hola \\LaTeX\\end{document}",
    );
    const result = run("tectonic", ["-X", "compile", "prewarm.tex"], {
      timeout: 900_000,
      cwd: work,
      env: { TECTONIC_CACHE_DIR: CACHE_DIR },
    });
    console.log(
      result.code === 0 ? `${c.green("✔")} Bundle listo` : `${c.yellow("!")} ${result.out.slice(-500)}`,
    );
    await fsp.rm(work, { recursive: true, force: true });
  }

  await fsp.rm(TMP_DIR, { recursive: true, force: true });
  console.log(`\n${c.green("Todo listo.")} Ejecuta ${c.bold("npm run dev")} y abre http://localhost:3000\n`);
}

main().catch((error) => {
  console.error(`\n${c.red("✘")} ${error.message}\n`);
  process.exitCode = 1;
});
