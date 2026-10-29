import { handleCompile } from "@/lib/latex/api";

export const maxDuration = 300;

/**
 * POST /api/export/pdf
 * Body: { source: string, template?: string }
 * Respuesta: PDF como descarga adjunta.
 */
export async function POST(request: Request) {
  return handleCompile(request, "pdf", true);
}
