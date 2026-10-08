import type { NextRequest } from "next/server";
import { body, parse, respond } from "@/modules/community/server/http";
import { messageInput, uuid } from "@/modules/community/validation";
import { sendMessage } from "@/modules/complaints/server/service";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => sendMessage(database, parse(uuid, (await context.params).id), await body(request, messageInput)), { write: true }); }
