import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { publicError, type ApplicationErrorCode } from "./errors";

type DiagnosticEvent = {
  event: "request_failed";
  requestId: string;
  code: ApplicationErrorCode;
};

function recordDiagnostic(event: DiagnosticEvent) {
  // A fixed allowlist keeps errors, identities, cookies, and arbitrary payloads out of logs.
  console.error(JSON.stringify({ event: event.event, requestId: event.requestId, code: event.code }));
}

export function errorResponse(error: unknown): NextResponse {
  const requestId = randomUUID();
  const failure = publicError(error);
  recordDiagnostic({ event: "request_failed", requestId, code: failure.code });
  return NextResponse.json(
    { error: { code: failure.code, message: failure.message, requestId } },
    { status: failure.status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
  );
}
