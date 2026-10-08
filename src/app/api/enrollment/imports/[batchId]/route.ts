import type { NextRequest } from "next/server";
import { z } from "zod";
import { identityRoute } from "@/modules/identity/http";
import { ApplicationError } from "@/lib/observability/errors";
import { getEnrollmentReport } from "@/modules/identity/enrollment-service";

export async function GET(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  return identityRoute(request, async ({ client }) => {
    const params = await context.params;
    const batchId = z.uuid().safeParse(params.batchId);
    if (!batchId.success) throw new ApplicationError("validation");
    return getEnrollmentReport(client, batchId.data);
  });
}
