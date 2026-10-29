import { handleCompile } from "@/lib/latex/api";

export const maxDuration = 300;

/**
 * POST /api/export/docx
 * Body: { source: string, template?: string }
 * Respuesta: Microsoft Word (.docx) como descarga adjunta, vía Pandoc.
 */
export async function POST(request: Request) {
  return handleCompile(request, "docx", true);
}
