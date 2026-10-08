import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  // Liveness describes this process, not unverified external-service readiness.
  return NextResponse.json(
    { status: "ok", service: "campusos" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
