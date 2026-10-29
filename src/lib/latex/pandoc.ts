/**
 * Ajustes de LaTeX antes de entregar el documento a Pandoc para generar DOCX.
 *
 * Pandoc convierte bien la mayoría del LaTeX, pero los entornos de alineación
 * (`align`, `aligned`, `gather`…) dejan los `&` de alineación como texto
 * literal dentro de la ecuación de Word. Los descomponemos en ecuaciones
 * independientes, que es lo que Word representa de forma nativa.
 */
const ALIGN_ENVIRONMENTS = [
  "align",
  "align*",
  "aligned",
  "flalign",
  "flalign*",
  "eqnarray",
  "eqnarray*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "split",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alignBodyToEquations(body: string): string {
  return body
    .split(/\\\\/)
    .map((line) =>
      line
        .replace(/&/g, " ")
        .replace(/\\(nonumber|notag|label\s*\{[^}]*\})/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .map((line) => `\\[\n${line}\n\\]`)
    .join("\n\n");
}

export function preprocessForDocx(tex: string): string {
  let output = tex;
  for (const env of ALIGN_ENVIRONMENTS) {
    const name = escapeRegExp(env);
    const re = new RegExp(`\\\\begin\\{${name}\\}([\\s\\S]*?)\\\\end\\{${name}\\}`, "g");
    output = output.replace(re, (_match, body: string) => alignBodyToEquations(body));
  }
  return output;
}

/** Pandoc no genera índice por sí solo: lo activamos si el documento lo pide. */
export function wantsTableOfContents(tex: string): boolean {
  return /\\tableofcontents/.test(tex);
}
