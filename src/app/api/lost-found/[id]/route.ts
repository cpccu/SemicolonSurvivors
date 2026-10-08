import type { NextRequest } from "next/server";
import { body, parse, respond } from "@/modules/community/server/http";
import { itemTransitionInput, uuid } from "@/modules/community/validation";
import { itemDetail, transitionItem } from "@/modules/lost-found/server/service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => itemDetail(database, parse(uuid, (await context.params).id)), { member: true }); }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => transitionItem(database, parse(uuid, (await context.params).id), await body(request, itemTransitionInput)), { write: true }); }
