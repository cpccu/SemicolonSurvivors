import type { NextRequest } from "next/server";
import { contentResponse } from "@/modules/content/server/http";
import { downloadResource } from "@/modules/resources/server/service";
export function GET(request: NextRequest, route: { params: Promise<{ id: string }> }) { return contentResponse(request, async (context) => downloadResource(context, (await route.params).id)); }
