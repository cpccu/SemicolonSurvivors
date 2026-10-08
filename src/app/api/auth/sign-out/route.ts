import type { NextRequest } from "next/server";
import { z } from "zod";
import { identityRoute } from "@/modules/identity/http";
import { readBoundedJson } from "@/lib/security/request";
import { ApplicationError } from "@/lib/observability/errors";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    await readBoundedJson(request, z.strictObject({}));
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new ApplicationError("unexpected");
    return { signedOut: true };
  });
}
