import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createRequestDatabaseContext } from "@/lib/database/request";

export async function refreshAuthSession(request: NextRequest): Promise<NextResponse> {
  const context = createRequestDatabaseContext(request);
  // Refresh transport is separate from route authorization; a missing session grants no access.
  await context.client.auth.getUser();
  return context.finalizeResponse(NextResponse.next({ request }));
}
