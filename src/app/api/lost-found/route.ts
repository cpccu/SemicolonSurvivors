import type { NextRequest } from "next/server";
import { z } from "zod";
import { body, params, parse, respond } from "@/modules/community/server/http";
import { itemInput, searchSchema } from "@/modules/community/validation";
import { createItem, listItems } from "@/modules/lost-found/server/service";
export async function GET(request: NextRequest) { return respond(request, (database) => { const input = parse(searchSchema.extend({ kind: z.enum(["lost", "found"]).optional() }), params(request)); return listItems(database, input, input.kind); }, { member: true }); }
export async function POST(request: NextRequest) { return respond(request, async (database) => createItem(database, await body(request, itemInput)), { write: true }); }
