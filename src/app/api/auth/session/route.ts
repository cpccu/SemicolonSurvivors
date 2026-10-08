import { NextResponse, type NextRequest } from "next/server";
import { readBackendConfiguration } from "@/lib/validation/environment";
import { identityRoute } from "@/modules/identity/http";
import { getSessionView } from "@/modules/identity/session-service";
import { unavailableReadiness } from "@/modules/identity/readiness";

export async function GET(request: NextRequest) {
  if (readBackendConfiguration(process.env).status !== "ready") {
    return NextResponse.json({ authenticated: false, account: null, fullName: null, assurance: null, readiness: unavailableReadiness }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return identityRoute(request, ({ client }) => getSessionView(client));
}
