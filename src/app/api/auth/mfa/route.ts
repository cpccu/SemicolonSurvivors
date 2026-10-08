import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { getMfaState } from "@/modules/identity/mfa-service";

export async function GET(request: NextRequest) {
  return identityRoute(request, ({ client }) => getMfaState(client));
}
