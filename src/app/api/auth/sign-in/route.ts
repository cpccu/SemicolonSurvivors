import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { signInSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { signIn } from "@/modules/identity/auth-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, signInSchema);
    return signIn(client, input.email, input.password);
  });
}
