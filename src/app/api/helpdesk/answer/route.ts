import type { NextRequest } from "next/server";
import { contentResponse, readContentBody } from "@/modules/content/server/http";
import { helpdeskAnswer } from "@/modules/helpdesk/server/answer";
export function POST(request: NextRequest) { return contentResponse(request, async (context) => helpdeskAnswer(context, await readContentBody(request)), true); }
