import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { confirmSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { confirmManagedLink } from "@/modules/identity/auth-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, confirmSchema);
    return confirmManagedLink(client, input.tokenHash, input.type);
  });
}
