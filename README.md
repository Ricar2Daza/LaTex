# LaTeX Studio

Clon simplificado de Overleaf: editor LaTeX con resaltado de sintaxis, vista previa de PDF en tiempo real y exportación a **PDF** y **Word (.docx)**.

El proyecto compila LaTeX de verdad con [Tectonic](https://tectonic-typesetting.github.io/) y convierte a DOCX con [Pandoc](https://pandoc.org/), ambos descargados automáticamente al directorio local `.tools/`.

---

## Características

- **Editor CodeMirror 6** con resaltado de LaTeX, numeración de líneas, autocompletado de comandos y entornos, y atajos de teclado.
- **Vista previa dividida** (editor a la izquierda, PDF a la derecha) con panel redimensionable; en móvil se usan pestañas Editor / Vista previa.
- **Compilación automática** con debounce de 900 ms, o manual con `Compilar` / `Ctrl`+`Enter`.
- **Tres plantillas**: documento simple, reporte técnico y currículum.
- **Exportación** a PDF y a Word (.docx) con un clic.
- **Errores de LaTeX estructurados**: mensaje, línea y salto directo a la línea del editor.
- **Sesión persistida** en `localStorage`: código, plantilla, panel dividido y preferencia de auto-compilación.
- **Caché LRU** en memoria para recompilaciones idénticas y límite de compilaciones concurrentes.

---

## Requisitos

- Node.js 20 o superior.
- Windows, macOS o Linux.
- Conexión a Internet **solo la primera vez** (descarga de Tectonic, Pandoc y el paquete de LaTeX).

No hace falta instalar TeX Live, MiKTeX ni Pandoc en el sistema.

---

## Instalación y arranque

```bash
npm install
npm run setup:tools          # descarga Tectonic + Pandoc en .tools/bin
npm run setup:tools:prewarm  # opcional: descarga también el paquete LaTeX (~100 MB)
npm run dev
```

Abre http://localhost:3000.

> **Nota:** si omites el `prewarm`, la primera compilación descargará el paquete de LaTeX y puede tardar alrededor de un minuto. Las siguientes son rápidas (y quedan en caché).

### Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compilación de producción. |
| `npm start` | Sirve la compilación de producción. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript sin emitir archivos. |
| `npm run setup:tools` | Descarga los binarios nativos que falten. |
| `npm run setup:tools:prewarm` | Además precarga el paquete LaTeX en `.tools/tectonic-cache`. |

`setup:tools` es idempotente: si los binarios ya existen, no vuelve a descargarlos. Usa `--force` para reemplazarlos.

---

## Cómo se usa

1. Escribe en el panel izquierdo. Si la compilación automática está activa (interruptor **Auto**), el PDF se actualiza solo.
2. También puedes compilar manualmente con el botón **Compilar** o `Ctrl`/`Cmd` + `Enter`.
3. Cambia de plantilla desde el selector del encabezado. Si el documento actual tiene cambios, se pedirá confirmación antes de reemplazarlo.
4. Descarga con **PDF** o **Word**, o guarda el código con el icono de descarga `.tex` (o `Ctrl`/`Cmd` + `S`).
5. Si hay errores, se abre el panel **Problemas**; haz clic en un problema para saltar a su línea.

### Documentos completos y fragmentos

- Si el código contiene `\begin{document}`, se compila **tal cual**.
- Si es un **fragmento** (sin `\documentclass` ni `\begin{document}`), se envuelve automáticamente con el preámbulo de la plantilla activa. La interfaz lo indica con la etiqueta `fragmento`.

---

## API

Todas las rutas aceptan `POST` con JSON:

```json
{
  "source": "\\documentclass{article}\n\\begin{document}\nHola\\end{document}",
  "template": "simple"
}
```

`template` es opcional (`simple`, `report`, `cv`); solo se usa para envolver fragmentos.
`files` es opcional: lista de `{ "name": "...", "content": "<base64>" }` con archivos auxiliares (imágenes, `.bib`, `.sty`…) que se escriben en el directorio de compilación.

### Compilar y previsualizar

```bash
curl -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"source":"\\documentclass{article}\\begin{document}Hola\\end{document}"}' \
  --output salida.pdf
```

Devuelve el PDF con `Content-Type: application/pdf` y estas cabeceras:

- `X-Compile-Ms`: duración de la compilación.
- `X-Compile-Cached`: `true` si se sirvió de la caché.
- `X-Pdf-Pages`: número de páginas.
- `X-Source-Wrapped`: `true` si el fragmento se envolvió con una plantilla.

### Exportar

```bash
# PDF (attachment)
curl -X POST http://localhost:3000/api/export/pdf \
  -H "Content-Type: application/json" \
  -d '{"source":"\\documentclass{article}\\begin{document}Hola\\end{document}"}' \
  --output documento.pdf

# Word (.docx)
curl -X POST http://localhost:3000/api/export/docx \
  -H "Content-Type: application/json" \
  -d '{"source":"\\documentclass{article}\\begin{document}Hola\\end{document}"}' \
  --output documento.docx
```

### Salud del servicio

```bash
curl http://localhost:3000/api/health
```

```json
{
  "ready": true,
  "engines": [
    { "name": "tectonic", "available": true, "version": "Tectonic 0.17.0", "origin": ".tools" },
    { "name": "pandoc", "available": true, "version": "pandoc 3.13", "origin": ".tools" }
  ],
  "setupCommand": "npm run setup:tools"
}
```

### Errores

Los fallos de compilación devuelven `422` con un JSON estructurado:

```json
{
  "error": "El documento no compila: 1 error.",
  "issues": [
    { "severity": "error", "line": 4, "message": "Undefined control sequence" }
  ],
  "log": "...salida de Tectonic...",
  "durationMs": 613,
  "kind": "compile"
}
```

Otros códigos: `400` petición inválida, `413` documento demasiado grande (límite 1 MB) y `503` si falta un motor nativo.

---

## Arquitectura

```
src/
  app/
    page.tsx                 Página principal
    layout.tsx               Metadatos, fuentes, favicon
    globals.css              Tema (Tailwind v4)
    api/
      compile/route.ts       POST → PDF inline
      export/pdf/route.ts    POST → PDF adjunto
      export/docx/route.ts   POST → DOCX adjunto
      health/route.ts        Estado de los motores
  components/
    studio.tsx               Estado global, compilación, descargas, atajos
    toolbar.tsx              Encabezado, plantillas, motores
    editor.tsx               CodeMirror 6 (LaTeX + autocompletado)
    preview.tsx              iframe del PDF y aviso de errores
    log-panel.tsx            Problemas / registro
  lib/
    templates.ts             Plantillas (preámbulo + cuerpo)
    latex/document.ts        Detección de fragmentos, metadatos, nombres
    latex/runner.ts          Ejecución de procesos con timeout
    latex/compile.ts         Orquestación PDF/DOCX, caché, semáforo
    latex/pandoc.ts          Preprocesado de LaTeX para Pandoc
    latex/errors.ts          Parseo de errores de Tectonic
    latex/binaries.ts        Resolución de binarios y caché de Tectonic
    latex/api.ts             Manejo común de peticiones y errores
scripts/setup-tools.mjs      Descarga de Tectonic y Pandoc
.tools/                      Binarios y caché (ignorado por git)
```

### Flujo de compilación

1. Se normaliza la entrada y, si es un fragmento, se envuelve con la plantilla.
2. Se calcula una clave `sha256(formato|plantilla|código)` y se consulta la caché LRU (40 entradas / 256 MB).
3. Si no hay caché, se ejecuta Tectonic (PDF) o Pandoc (DOCX) en un directorio temporal, con un semáforo de 2 compilaciones simultáneas y timeouts (240 s PDF, 120 s DOCX).
4. Se cuentan las páginas del PDF y se devuelve el archivo con sus cabeceras.

---

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `TECTONIC_PATH` | Ruta explícita al ejecutable de Tectonic. |
| `PANDOC_PATH` | Ruta explícita al ejecutable de Pandoc. |
| `TECTONIC_CACHE_DIR` | Directorio de caché del paquete LaTeX (por defecto `.tools/tectonic-cache`). |

Orden de resolución de binarios: **variable de entorno → `.tools/bin` → `PATH`**.

---

## Decisiones técnicas

- **Tectonic en lugar de WASM**: produce PDFs de mayor fidelidad que las alternativas WASM y evita descargar un TeX Live completo; el paquete se cachea localmente.
- **CodeMirror en lugar de Monaco**: integración más simple con React 19 y Turbopack, menor peso y buen soporte del modo LaTeX (`@codemirror/legacy-modes/mode/stex`).
- **Pandoc para DOCX**: convierte encabezados, listas, tablas y matemáticas a OMML nativo de Word. Los entornos `align` se preprocesan a ecuaciones independientes porque Pandoc no soporta bien la alineación dentro de DOCX.
- **Next.js App Router** con Server Actions deshabilitadas: toda la conversión ocurre en Route Handlers que ejecutan procesos nativos.

---

## Limitaciones conocidas

- Los archivos adjuntos (imágenes, `.bib`, `.sty`…) se suben desde el botón **Archivos** del editor y se compilan junto con `main.tex`. Se referencian por su nombre (p. ej. `\\includegraphics{logo.png}` o `\\bibliography{refs}`). Los adjuntos viven en memoria durante la sesión y se pierden al recargar la página.
- En DOCX, las referencias cruzadas como `\eqref{...}` se convierten en el texto de la etiqueta, no en campos actualizables de Word.
- La caché vive en memoria del proceso: se pierde al reiniciar el servidor.
- La compilación requiere los binarios nativos; en entornos serverless (Vercel, etc.) hay que aportarlos o usar un contenedor propio.
- El panel de vista previa usa el visor de PDF del navegador; en navegadores sin visor integrado se puede abrir el PDF en una pestaña nueva.

---

## Solución de problemas

**«Faltan los motores nativos»**
Ejecuta `npm run setup:tools` y recarga. Si el binario está en otro sitio, define `TECTONIC_PATH` y `PANDOC_PATH`.

**La primera compilación tarda mucho**
Es la descarga del paquete LaTeX. Ejecuta `npm run setup:tools --prewarm` para hacerlo una sola vez.

**El PDF no se actualiza**
Comprueba que el interruptor **Auto** esté activo o pulsa **Compilar**.

**Error de red al descargar los binarios**
`setup-tools.mjs` admite `--force` para reintentar; también puedes descargar Tectonic y Pandoc manualmente y colocarlos en `.tools/bin`.
"# LaTex" 
