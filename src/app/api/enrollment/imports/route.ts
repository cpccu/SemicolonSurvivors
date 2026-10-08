import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { listRecentEnrollmentImports } from "@/modules/identity/enrollment-service";

export async function GET(request: NextRequest) {
  return identityRoute(request, ({ client }) => listRecentEnrollmentImports(client));
}
