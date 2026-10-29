import { connection } from "next/server";

import { enginesStatus } from "@/lib/latex/api";

/**
 * GET /api/health
 * Informa si Tectonic y Pandoc están instalados y en qué versión.
 */
export async function GET() {
  // Los binarios pueden instalarse mientras el servidor está en marcha.
  await connection();
  return Response.json(enginesStatus(), { headers: { "Cache-Control": "no-store" } });
}
