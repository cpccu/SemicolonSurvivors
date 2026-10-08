import "server-only";
import type { NextRequest } from "next/server";
import type { ContentKind } from "../models";
import { contentResponse, readContentBody } from "./http";
import { archiveContent, getContent, listContent, saveContent } from "./service";

export function contentCollectionRoutes(kind: ContentKind) {
  return {
    GET: (request: NextRequest) => contentResponse(request, (context) => listContent(context, kind, Object.fromEntries(request.nextUrl.searchParams))),
    POST: (request: NextRequest) => contentResponse(request, async (context) => saveContent(context, kind, await readContentBody(request)), true),
  };
}
type RouteParams = { params: Promise<{ id: string }> };
export function contentItemRoutes(kind: ContentKind) {
  return {
    GET: (request: NextRequest, route: RouteParams) => contentResponse(request, async (context) => getContent(context, kind, (await route.params).id)),
    PATCH: (request: NextRequest, route: RouteParams) => contentResponse(request, async (context) => saveContent(context, kind, await readContentBody(request), (await route.params).id), true),
    DELETE: (request: NextRequest, route: RouteParams) => contentResponse(request, async (context) => archiveContent(context, kind, (await route.params).id, await readContentBody(request)), true),
  };
}
