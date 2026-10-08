import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { resetSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { requestPasswordReset } from "@/modules/identity/auth-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, resetSchema);
    return requestPasswordReset(client, input.email);
  });
}
