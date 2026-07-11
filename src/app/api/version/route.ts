import { NextResponse } from "next/server";

// Espone lo SHA del commit da cui è stato buildato questo deployment.
// Usato da /api/admin/deploy-status per capire quando una modifica è live.
export async function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
