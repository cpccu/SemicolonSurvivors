import type { NextRequest } from "next/server";
import { contentResponse } from "@/modules/content/server/http";
import { listResources } from "@/modules/resources/server/service";
import { uploadResource } from "@/modules/resources/server/upload";
export function GET(request: NextRequest) { return contentResponse(request, (context) => listResources(context, Object.fromEntries(request.nextUrl.searchParams))); }
export function POST(request: NextRequest) { return contentResponse(request, (context) => uploadResource(context, request), true); }
