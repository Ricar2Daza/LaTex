export type TemplateId = "simple" | "report" | "cv";

export interface LatexTemplate {
  id: TemplateId;
  name: string;
  tagline: string;
  /** Desde `\documentclass` hasta justo antes de `\begin{document}`. */
  preamble: string;
  /** Cuerpo del documento (sin `\begin{document}` / `\end{document}`). */
  body: string;
}

const SIMPLE_PREAMBLE = String.raw`\documentclass[11pt,a4paper]{article}

% ---------- Codificación e idioma ----------
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[spanish,es-noshorthands]{babel}

% ---------- Márgenes y matemáticas ----------
\usepackage[margin=2.5cm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{xcolor}

% ---------- Enlaces ----------
\usepackage[hidelinks]{hyperref}

\title{Documento sin título}
\author{Tu nombre}
\date{\today}`;

const SIMPLE_BODY = String.raw`\maketitle

\begin{abstract}
Escribe aquí un resumen breve del documento. Este proyecto compila \LaTeX{}
a PDF y lo exporta a Word (.docx) conservando títulos, listas y fórmulas.
\end{abstract}

\section{Introducción}
Este es un documento de ejemplo. Puedes editar el código de la izquierda y ver
el resultado en la vista previa. La compilación es automática mientras escribes.

\section{Matemáticas}
Una fórmula en línea, como $E = mc^2$, y una ecuación numerada:

\begin{equation}
  \int_{-\infty}^{\infty} e^{-x^2}\,\mathrm{d}x = \sqrt{\pi}
  \label{eq:gauss}
\end{equation}

\section{Listas y tablas}
\begin{itemize}
  \item Elemento uno.
  \item Elemento dos, con \textbf{negrita} y \emph{cursiva}.
  \item Elemento tres, con \texttt{código}.
\end{itemize}

\begin{table}[h]
  \centering
  \begin{tabular}{lcr}
    \toprule
    Herramienta & Función & Estado \\
    \midrule
    Tectonic & LaTeX $\rightarrow$ PDF & Listo \\
    Pandoc   & LaTeX $\rightarrow$ DOCX & Listo \\
    \bottomrule
  \end{tabular}
  \caption{Tabla de ejemplo.}
\end{table}

\section{Conclusión}
Fin del documento de ejemplo.`;

const REPORT_PREAMBLE = String.raw`\documentclass[11pt,a4paper]{article}

% ---------- Codificación e idioma ----------
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[spanish,es-noshorthands]{babel}

% ---------- Diseño de página ----------
\usepackage[top=2.8cm,bottom=2.8cm,left=3cm,right=3cm]{geometry}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{xcolor}

% ---------- Contenido ----------
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{caption}
\usepackage[hidelinks]{hyperref}

\definecolor{brand}{HTML}{1D4ED8}
\definecolor{ink}{HTML}{0F172A}

\titleformat{\section}{\Large\bfseries\color{brand}}{\thesection.}{0.6em}{}
\titleformat{\subsection}{\large\bfseries\color{ink}}{\thesubsection}{0.6em}{}
\titlespacing*{\section}{0pt}{1.6em}{0.7em}

\captionsetup{font=small,labelfont={bf,color=brand}}
\setlist[itemize]{leftmargin=1.4em,itemsep=3pt,topsep=4pt}
\setlist[enumerate]{leftmargin=1.6em,itemsep=3pt,topsep=4pt}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{gray}Reporte técnico}
\fancyhead[R]{\small\color{gray}\thepage}
\renewcommand{\headrulewidth}{0.4pt}

\title{\vspace{-1.5cm}\textbf{Informe de proyecto}\\[4pt]
  \large Subtítulo o línea de investigación}
\author{Equipo de trabajo \\ \small Organización}
\date{\today}`;

const REPORT_BODY = String.raw`\maketitle
\thispagestyle{empty}

\begin{abstract}
\noindent Resumen ejecutivo del informe. Describe el problema, el enfoque
propuesto y los resultados principales en un párrafo de cinco a ocho líneas.
\end{abstract}

\vspace{1em}
\tableofcontents
\newpage

\section{Introducción}
El objetivo de este informe es documentar el desarrollo de \emph{...}. La
motivación principal es \emph{...}.

\subsection{Contexto}
Contexto del problema y antecedentes relevantes.

\subsection{Objetivos}
\begin{enumerate}
  \item Objetivo general.
  \item Objetivos específicos.
\end{enumerate}

\section{Marco teórico}
Modelo matemático de referencia:
\begin{equation}
  \mathcal{L}(\theta) = \frac{1}{n}\sum_{i=1}^{n}\bigl(y_i - f(x_i;\theta)\bigr)^2
  \label{eq:loss}
\end{equation}

La ecuación~\eqref{eq:loss} define el error cuadrático medio.

\section{Metodología}
\begin{figure}[htbp]
  \centering
  \fbox{\rule{0pt}{4.5cm}\rule{10cm}{0pt}}
  \caption{Diagrama de la arquitectura propuesta (reemplaza este recuadro por
  \texttt{\textbackslash includegraphics}).}
  \label{fig:arquitectura}
\end{figure}

\section{Resultados}
\begin{table}[htbp]
  \centering
  \begin{tabular}{lrrr}
    \toprule
    Escenario & Precisión & Latencia (ms) & Coste \\
    \midrule
    Base      & 0.82 & 145 & Bajo \\
    Optimizado& 0.89 & 98  & Medio \\
    Propuesto & 0.93 & 74  & Medio \\
    \bottomrule
  \end{tabular}
  \caption{Comparativa de resultados.}
  \label{tab:resultados}
\end{table}

\section{Conclusiones}
Conclusiones y trabajo futuro.

\section*{Referencias}
\begin{enumerate}[label={[\arabic*]}]
  \item Autor, A. \emph{Título del trabajo}. Editorial, 2024.
  \item Autor, B. \emph{Otro trabajo}. Revista, 12(3):45--67, 2025.
\end{enumerate}`;

const CV_PREAMBLE = String.raw`\documentclass[10pt,a4paper]{article}

% ---------- Codificación e idioma ----------
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[spanish,es-noshorthands]{babel}

% ---------- Diseño ----------
\usepackage[left=1.7cm,right=1.7cm,top=1.6cm,bottom=1.6cm]{geometry}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{hyperref}

\definecolor{accent}{HTML}{0F4C81}
\definecolor{muted}{HTML}{5B6770}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=1.1em,itemsep=1pt,topsep=2pt,parsep=0pt}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0pt}{}[\vspace{-0.55em}\color{accent}\rule{\linewidth}{0.8pt}]
\titlespacing*{\section}{0pt}{12pt}{8pt}

% Entrada de dos columnas: puesto/fecha en la primera línea y entidad debajo.
\newcommand{\cvrole}[2]{%
  \textbf{#1} \hfill \textcolor{muted}{\small #2}\par\vspace{2pt}}`;

const CV_BODY = String.raw`\begin{center}
  {\Huge\bfseries Nombre Apellido}\\[2pt]
  {\large\color{accent} Ingeniero de Software}\\[6pt]
  {\small\color{muted}
    correo@ejemplo.com \quad$\cdot$\quad +34 600 000 000 \quad$\cdot$\quad
    Ciudad, País \quad$\cdot$\quad \href{https://github.com/usuario}{github.com/usuario}}
\end{center}

\section*{Perfil}
Desarrollador con experiencia en el diseño y construcción de aplicaciones web.
Interesado en arquitecturas limpias, rendimiento y experiencia de usuario.

\section*{Experiencia profesional}
\cvrole{Ingeniero de Software Senior}{2023 -- presente}
\textit{Empresa Actual} --- Ciudad
\begin{itemize}
  \item Lideré la migración de un monolito a servicios independientes.
  \item Reduje el tiempo de carga un 40\,\% con optimización del renderizado.
\end{itemize}
\vspace{4pt}

\cvrole{Desarrollador Full Stack}{2021 -- 2023}
\textit{Empresa Anterior} --- Ciudad
\begin{itemize}
  \item Construí el panel de administración con React y TypeScript.
  \item Automaticé el despliegue continuo sobre contenedores.
\end{itemize}

\section*{Formación}
\cvrole{Grado en Ingeniería Informática}{2017 -- 2021}
\textit{Universidad} --- Ciudad

\section*{Habilidades}
\begin{itemize}
  \item \textbf{Lenguajes:} TypeScript, Python, SQL, LaTeX.
  \item \textbf{Frontend:} React, Next.js, Tailwind CSS.
  \item \textbf{Backend:} Node.js, Pandoc, Docker.
\end{itemize}

\section*{Idiomas}
Español (nativo) \quad$\cdot$\quad Inglés (C1)`;


export const TEMPLATES: LatexTemplate[] = [
  {
    id: "simple",
    name: "Documento simple",
    tagline: "Artículo con resumen, listas, tablas y ecuaciones.",
    preamble: SIMPLE_PREAMBLE,
    body: SIMPLE_BODY,
  },
  {
    id: "report",
    name: "Reporte técnico",
    tagline: "Portada, índice, figuras y tablas para informes.",
    preamble: REPORT_PREAMBLE,
    body: REPORT_BODY,
  },
  {
    id: "cv",
    name: "Currículum",
    tagline: "CV compacto de una página con secciones.",
    preamble: CV_PREAMBLE,
    body: CV_BODY,
  },
];

export const DEFAULT_TEMPLATE_ID: TemplateId = "simple";

export function getTemplate(id: string | undefined | null): LatexTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Documento completo listo para compilar. */
export function renderTemplate(template: LatexTemplate): string {
  return `${template.preamble}\n\n\\begin{document}\n${template.body}\n\n\\end{document}\n`;
}
