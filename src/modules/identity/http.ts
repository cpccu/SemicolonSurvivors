import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createRequestDatabaseContext } from "@/lib/database/request";
import { errorResponse } from "@/lib/observability/server";

export type IdentityRequestContext = ReturnType<typeof createRequestDatabaseContext>;

export async function identityRoute(
  request: NextRequest,
  operation: (context: IdentityRequestContext) => Promise<unknown>,
): Promise<NextResponse> {
  let context: IdentityRequestContext | undefined;
  try {
    context = createRequestDatabaseContext(request);
    const result = await operation(context);
    return context.finalizeResponse(NextResponse.json(result));
  } catch (error) {
    const response = errorResponse(error);
    // Authentication may have updated cookies before a later policy/database failure.
    return context ? context.finalizeResponse(response) : response;
  }
}
