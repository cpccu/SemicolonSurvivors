import type { NextRequest } from "next/server";
import { body, respond } from "@/modules/community/server/http";
import { officeInput } from "@/modules/community/validation";
import { officeChange } from "@/modules/administration/server/service";
export async function POST(request: NextRequest) { return respond(request, async (database) => officeChange(database, await body(request, officeInput)), { write: true }); }
