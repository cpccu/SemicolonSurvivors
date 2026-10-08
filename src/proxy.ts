import { NextResponse, type NextRequest } from "next/server";
import { readBackendConfiguration } from "@/lib/validation/environment";
import { refreshAuthSession } from "@/lib/auth/refresh-session";

export async function proxy(request: NextRequest) {
  if (readBackendConfiguration(process.env).status !== "ready") return NextResponse.next();
  return refreshAuthSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
