"use client";

import { useEffect, useRef } from "react";

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  snippetCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { tags as t } from "@lezer/highlight";

export interface EditorHandle {
  revealLine: (line: number) => void;
  focus: () => void;
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursor?: (line: number, column: number) => void;
  onReady?: (handle: EditorHandle) => void;
}

/* ------------------------------------------------------------------ */
/* Resaltado                                                          */
/* ------------------------------------------------------------------ */
const latexHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword], color: "#c4b5fd" },
  { tag: [t.tagName, t.typeName, t.className], color: "#7dd3fc" },
  { tag: [t.string], color: "#86efac" },
  { tag: [t.number, t.bool, t.atom], color: "#fbbf24" },
  { tag: [t.comment], color: "#64748b", fontStyle: "italic" },
  { tag: [t.operator], color: "#f0abfc" },
  { tag: [t.variableName, t.propertyName], color: "#e2e8f0" },
  { tag: [t.bracket, t.punctuation, t.separator], color: "#94a3b8" },
  { tag: [t.meta, t.labelName], color: "#fca5a5" },
  { tag: [t.heading, t.strong], color: "#f8fafc", fontWeight: "600" },
  { tag: [t.emphasis], fontStyle: "italic", color: "#e2e8f0" },
  { tag: [t.invalid], color: "#fda4af" },
]);

/* ------------------------------------------------------------------ */
/* Autocompletado                                                     */
/* ------------------------------------------------------------------ */
const COMMANDS: Completion[] = [
  "\\documentclass",
  "\\usepackage",
  "\\begin",
  "\\end",
  "\\section",
  "\\subsection",
  "\\subsubsection",
  "\\paragraph",
  "\\title",
  "\\author",
  "\\date",
  "\\maketitle",
  "\\tableofcontents",
  "\\item",
  "\\label",
  "\\ref",
  "\\eqref",
  "\\cite",
  "\\bibliography",
  "\\includegraphics",
  "\\caption",
  "\\centering",
  "\\textbf",
  "\\textit",
  "\\emph",
  "\\underline",
  "\\texttt",
  "\\section*",
  "\\footnote",
  "\\url",
  "\\href",
  "\\hspace",
  "\\vspace",
  "\\newpage",
  "\\clearpage",
  "\\noindent",
  "\\hfill",
  "\\quad",
  "\\frac",
  "\\sqrt",
  "\\sum",
  "\\prod",
  "\\int",
  "\\lim",
  "\\infty",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\epsilon",
  "\\theta",
  "\\lambda",
  "\\mu",
  "\\pi",
  "\\sigma",
  "\\phi",
  "\\omega",
  "\\Delta",
  "\\Sigma",
  "\\Omega",
  "\\times",
  "\\cdot",
  "\\pm",
  "\\leq",
  "\\geq",
  "\\neq",
  "\\approx",
  "\\rightarrow",
  "\\Rightarrow",
  "\\in",
  "\\subset",
  "\\cup",
  "\\cap",
  "\\forall",
  "\\exists",
  "\\mathbb",
  "\\mathcal",
  "\\mathrm",
  "\\text",
  "\\left",
  "\\right",
].map((label) => ({ label, type: "keyword" }));

const SNIPPETS: Completion[] = [
  snippetCompletion("\\begin{itemize}\n\t\\item ${}\n\\end{itemize}", {
    label: "itemize (lista)",
    detail: "entorno",
    type: "snippet",
  }),
  snippetCompletion("\\begin{enumerate}\n\t\\item ${}\n\\end{enumerate}", {
    label: "enumerate (lista numerada)",
    detail: "entorno",
    type: "snippet",
  }),
  snippetCompletion("\\begin{equation}\n\t${}\n\\end{equation}", {
    label: "equation",
    detail: "ecuación numerada",
    type: "snippet",
  }),
  snippetCompletion("\\begin{align}\n\t${} &= \\\\\n\\end{align}", {
    label: "align",
    detail: "ecuaciones alineadas",
    type: "snippet",
  }),
  snippetCompletion("\\begin{figure}[htbp]\n\t\\centering\n\t${}\n\t\\caption{}\n\\end{figure}", {
    label: "figure",
    detail: "figura",
    type: "snippet",
  }),
  snippetCompletion(
    "\\begin{table}[htbp]\n\t\\centering\n\t\\begin{tabular}{${lcr}}\n\t\t${} \\\\\n\t\\end{tabular}\n\t\\caption{}\n\\end{table}",
    { label: "table", detail: "tabla", type: "snippet" },
  ),
  snippetCompletion("\\frac{${num}}{${den}}", {
    label: "fracción",
    detail: "matemáticas",
    type: "snippet",
  }),
  snippetCompletion("\\begin{abstract}\n\t${}\n\\end{abstract}", {
    label: "abstract",
    detail: "resumen",
    type: "snippet",
  }),
];

const ENVIRONMENTS = [
  "document",
  "abstract",
  "itemize",
  "enumerate",
  "description",
  "equation",
  "equation*",
  "align",
  "align*",
  "gather",
  "cases",
  "matrix",
  "pmatrix",
  "bmatrix",
  "figure",
  "table",
  "tabular",
  "center",
  "flushleft",
  "flushright",
  "quote",
  "verbatim",
  "lstlisting",
  "thebibliography",
  "minipage",
].map((label) => ({ label, type: "class", apply: `${label}}` }));

const commandSource: CompletionSource = (context) => {
  const match = context.matchBefore(/\\[a-zA-Z]*/);
  if (!match) return null;
  if (match.from === match.to && !context.explicit) return null;
  return {
    from: match.from,
    options: [...SNIPPETS, ...COMMANDS],
    validFor: /^\\[a-zA-Z]*$/,
  };
};

const environmentSource: CompletionSource = (context) => {
  const match = context.matchBefore(/\\begin\{[a-zA-Z*]*$/);
  if (!match) return null;
  return {
    from: match.from + "\\begin{".length,
    options: ENVIRONMENTS,
    validFor: /^[a-zA-Z*]*$/,
  };
};

/* ------------------------------------------------------------------ */
/* Componente                                                         */
/* ------------------------------------------------------------------ */
export default function LatexEditor({ value, onChange, onCursor, onReady }: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursor);
  const onReadyRef = useRef(onReady);
  const initialValueRef = useRef(value);

  // Mantiene las callbacks al día sin recrear el editor en cada render.
  useEffect(() => {
    onChangeRef.current = onChange;
    onCursorRef.current = onCursor;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          dropCursor(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({
            override: [environmentSource, commandSource],
            icons: false,
            activateOnTyping: true,
          }),
          highlightSelectionMatches(),
          syntaxHighlighting(latexHighlight),
          StreamLanguage.define(stex),
          placeholder("Escribe tu documento LaTeX aquí…"),
          EditorView.contentAttributes.of({ "aria-label": "Editor de código LaTeX" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              onCursorRef.current?.(line.number, head - line.from + 1);
            }
          }),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
        ],
      }),
    });

    viewRef.current = view;
    onReadyRef.current?.({
      revealLine: (lineNumber: number) => {
        const current = viewRef.current;
        if (!current) return;
        const target = Math.min(Math.max(1, lineNumber), current.state.doc.lines);
        const line = current.state.doc.line(target);
        current.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        current.focus();
      },
      focus: () => viewRef.current?.focus(),
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sincroniza cambios externos (plantillas, restaurar sesión, formato).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: Math.min(view.state.selection.main.head, value.length) },
    });
  }, [value]);

  return <div ref={hostRef} className="cm-host h-full w-full" />;
}
