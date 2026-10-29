import { handleCompile } from "@/lib/latex/api";

export const maxDuration = 300;

/**
 * POST /api/compile
 * Body: { source: string, template?: "simple" | "report" | "cv" }
 * Respuesta: PDF en línea (para la vista previa) o JSON con los errores.
 */
export async function POST(request: Request) {
  return handleCompile(request, "pdf", false);
}
