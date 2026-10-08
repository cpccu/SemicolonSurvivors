import type { NextRequest } from "next/server";
import { contentResponse, readContentBody } from "@/modules/content/server/http";
import { getResource, updateResource, resourceAction } from "@/modules/resources/server/service";
type Route = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, route: Route) { return contentResponse(request, async (context) => ({ item: await getResource(context, (await route.params).id) })); }
export function PATCH(request: NextRequest, route: Route) { return contentResponse(request, async (context) => updateResource(context, (await route.params).id, await readContentBody(request)), true); }
export function POST(request: NextRequest, route: Route) { return contentResponse(request, async (context) => resourceAction(context, (await route.params).id, await readContentBody(request)), true); }
export function DELETE(request: NextRequest, route: Route) { return contentResponse(request, async (context) => resourceAction(context, (await route.params).id, { ...Object(await readContentBody(request)), action: "remove" }), true); }
