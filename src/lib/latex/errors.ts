export type IssueSeverity = "error" | "warning";

export interface LatexIssue {
  line?: number;
  severity: IssueSeverity;
  message: string;
}

const NOISE = [
  /^Overfull \\[hv]box/,
  /^Underfull \\[hv]box/,
  /^LaTeX Warning: (Citation|Reference) .* undefined/,
  /^Package hyperref Warning: Token not allowed/,
  /^something bad happened inside XeTeX/i,
  /^the XeTeX engine had/i,
  /^caused by:/i,
  /^Fontconfig error/i,
  /^Transcript written/i,
  /^No pages of output/i,
  /^See the LaTeX manual and the LaTeX Companion/i,
  /^Type\s+H <return>/i,
];

function isNoise(message: string): boolean {
  return NOISE.some((re) => re.test(message));
}

function clean(message: string): string {
  return message
    .replace(/\s+/g, " ")
    .replace(/^\s*[-!]\s*/, "")
    .trim()
    .slice(0, 400);
}

/** Clave para detectar el mismo error descrito de dos formas distintas. */
function dedupeKey(message: string): string {
  return message
    .toLowerCase()
    .replace(/[\s.;:,]+$/g, "")
    .replace(/\s+/g, " ");
}


/**
 * Extrae los errores/avisos relevantes del log de Tectonic (estilo codespan o
 * TeX clásico) y de la salida de Pandoc.
 */
export function parseLatexLog(log: string): LatexIssue[] {
  const issues: LatexIssue[] = [];
  const lines = log.split(/\r?\n/);
  let pendingClassic: LatexIssue | null = null;

  const push = (issue: LatexIssue) => {
    const message = clean(issue.message);
    if (!message || isNoise(message)) return;
    const key = dedupeKey(message);
    const existing = issues.find((i) => dedupeKey(i.message) === key);
    if (existing) {
      if (existing.line === undefined && issue.line !== undefined) existing.line = issue.line;
      if (existing.severity === "warning" && issue.severity === "error") {
        existing.severity = "error";
      }
      return;
    }
    issues.push({ ...issue, message });
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Formato codespan de Tectonic: error: main.tex:12: mensaje
    const coded = /^(error|warning):\s*(?:[^\s:]*?([\w.-]+\.tex):(\d+):\s*)?(.*)$/.exec(line);
    if (coded) {
      push({
        severity: coded[1] === "warning" ? "warning" : "error",
        line: coded[3] ? Number(coded[3]) : undefined,
        message: clean(coded[4] || line),
      });
      continue;
    }

    // Ubicación tipo `┌─ main.tex:12:1` (asocia la última línea del mensaje)
    const span = /[┌╭├]─\s*([\w.-]+\.tex):(\d+):(\d+)/.exec(line);
    if (span) {
      const last = issues[issues.length - 1];
      if (last && last.line === undefined) last.line = Number(span[2]);
      continue;
    }

    // Error clásico de TeX: "! Undefined control sequence."
    if (line.startsWith("!")) {
      const message = clean(line.slice(1));
      pendingClassic = {
        severity: /warning/i.test(message) ? "warning" : "error",
        message,
      };
      continue;
    }

    // Línea del error clásico: "l.42 \comando"
    const ctx = /^l\.(\d+)\s*(.*)$/.exec(line);
    if (ctx && pendingClassic) {
      push({ ...pendingClassic, line: Number(ctx[1]) });
      pendingClassic = null;
      continue;
    }

    // Pandoc: Error at "main.tex" (line 12, column 3)
    const pandoc = /(?:error|Error)[^\n]*?\(line\s+(\d+)/.exec(line);
    if (pandoc && /error/i.test(line)) {
      push({ severity: "error", line: Number(pandoc[1]), message: clean(line) });
      continue;
    }

    // Algunos motores escriben "main.tex:12: mensaje"
    const fileLine = /^[\w.-]+\.tex:(\d+):\s*(.+)$/.exec(line);
    if (fileLine && /error/i.test(fileLine[2])) {
      push({ severity: "error", line: Number(fileLine[1]), message: clean(fileLine[2]) });
    }
  }

  if (pendingClassic) push(pendingClassic);

  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length === 0) {
    // Sin marcadores reconocibles: al menos mostrar algo útil.
    const tail = lines.map((l) => l.trim()).filter(Boolean).slice(-4).join(" · ");
    if (tail) push({ severity: "error", message: clean(tail) });
  }

  return issues.slice(0, 25);
}

/** Recorta el log para enviarlo al cliente sin saturar la respuesta. */
export function summarizeLog(log: string, maxLines = 400): string {
  const lines = log.split(/\r?\n/);
  if (lines.length <= maxLines) return log;
  return `${lines.slice(0, 40).join("\n")}\n… ${lines.length - maxLines} líneas omitidas …\n${lines
    .slice(-(maxLines - 40))
    .join("\n")}`;
}
