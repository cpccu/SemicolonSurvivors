import type { NextRequest } from "next/server";
import { body, respond } from "@/modules/community/server/http";
import { directoryInput, publishInput } from "@/modules/community/validation";
import { publishDirectory } from "@/modules/administration/server/service";
export async function POST(request: NextRequest) { return respond(request, async (database) => publishDirectory(database, await body(request, publishInput(directoryInput))), { write: true }); }
