import type { NextRequest } from "next/server";
import { contentResponse, readContentBody } from "@/modules/content/server/http";
import { summarizeResource } from "@/modules/resources/server/summary";
export function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) { return contentResponse(request, async (context) => summarizeResource(context, (await route.params).id, await readContentBody(request)), true); }
