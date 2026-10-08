import type { NextRequest } from "next/server";
import { z } from "zod";
import { params, parse, respond } from "@/modules/community/server/http";
import { searchSchema } from "@/modules/community/validation";
import { listDirectory } from "@/modules/directory/server/service";
export async function GET(request: NextRequest) {
  return respond(request, (database) => { const input = parse(searchSchema.extend({ kind: z.enum(["department", "club", "office", "place", "guide"]).optional() }), params(request)); return listDirectory(database, input, input.kind); });
}
