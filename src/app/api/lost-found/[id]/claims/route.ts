import type { NextRequest } from "next/server";
import { body, parse, respond } from "@/modules/community/server/http";
import { claimInput, uuid } from "@/modules/community/validation";
import { claimItem } from "@/modules/lost-found/server/service";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => claimItem(database, parse(uuid, (await context.params).id), (await body(request, claimInput)).evidence), { write: true }); }
