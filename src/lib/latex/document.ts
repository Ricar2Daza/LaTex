import type { LatexTemplate } from "@/lib/templates";

/** Quita comentarios de LaTeX sin tocar los `\%` escapados. */
export function stripComments(src: string): string {
  return src.replace(/(^|[^\\])%[^\n]*/g, "$1");
}

export function normalizeNewlines(src: string): string {
  return src.replace(/\r\n?/g, "\n");
}

export function hasDocumentEnvironment(src: string): boolean {
  return /\\begin\s*\{document\}/.test(stripComments(src));
}

export interface NormalizedDocument {
  tex: string;
  /** true si el usuario escribió solo un fragmento y lo hemos envuelto. */
  wrapped: boolean;
}

/**
 * Garantiza que el texto sea un documento LaTeX compilable.
 * - Si ya contiene `\begin{document}` se respeta tal cual.
 * - Si es un fragmento, se envuelve con el preámbulo de la plantilla activa.
 */
export function normalizeSource(source: string, template: LatexTemplate): NormalizedDocument {
  const tex = normalizeNewlines(source).trim();

  if (hasDocumentEnvironment(tex)) {
    const closed = /\\end\s*\{document\}/.test(stripComments(tex));
    return {
      tex: closed ? `${tex}\n` : `${tex}\n\n\\end{document}\n`,
      wrapped: false,
    };
  }

  return {
    tex: `${template.preamble}\n\n\\begin{document}\n${tex}\n\n\\end{document}\n`,
    wrapped: true,
  };
}

const METADATA_RE = (command: string) =>
  new RegExp(`\\\\${command}\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`, "m");

/** Convierte un fragmento LaTeX muy simple a texto plano (para nombres de archivo). */
export function latexToText(input: string): string {
  return input
    .replace(/\\(?:v|h)space\*?\s*\{[^{}]*\}/g, " ")
    .replace(/\\\\\s*(?:\[[^\]]*\])?/g, " ")
    .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/\\[%&$#_{}]/g, (match) => match.slice(1))
    .replace(/[{}]/g, "")
    .replace(/~|\\quad|\\qquad/g, " ")
    .replace(/---?/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export interface DocumentMetadata {
  title: string | null;
  author: string | null;
  date: string | null;
}

export function extractMetadata(tex: string): DocumentMetadata {
  const pick = (command: string) => {
    const match = METADATA_RE(command).exec(tex);
    if (!match) return null;
    const text = latexToText(match[1]);
    return text.length > 0 ? text : null;
  };
  return { title: pick("title"), author: pick("author"), date: pick("date") };
}

/** Devuelve solo el contenido entre `\begin{document}` y `\end{document}`. */
export function extractBody(tex: string): string | null {
  const startMatch = /\\begin\s*\{document\}/.exec(stripComments(tex));
  if (!startMatch) return null;
  const start = startMatch.index + startMatch[0].length;
  const rest = tex.slice(start);
  const endIndex = rest.search(/\\end\s*\{document\}/);
  return (endIndex === -1 ? rest : rest.slice(0, endIndex)).trim();
}

/** Nombre de archivo seguro a partir del título del documento. */
export function safeFileName(title: string | null, fallback = "documento"): string {
  const base = (title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s._-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return base || fallback;
}
