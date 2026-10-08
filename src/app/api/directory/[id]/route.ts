import type { NextRequest } from "next/server";
import { parse, respond } from "@/modules/community/server/http";
import { uuid } from "@/modules/community/validation";
import { directoryDetail } from "@/modules/directory/server/service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return respond(request, async (database) => directoryDetail(database, parse(uuid, (await context.params).id)));
}
