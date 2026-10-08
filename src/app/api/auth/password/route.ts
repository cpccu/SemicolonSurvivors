import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { setPasswordSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { setPassword } from "@/modules/identity/auth-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, setPasswordSchema);
    return setPassword(client, input.password);
  });
}
