import type { NextRequest } from "next/server";
import { downloadMedia } from "@/modules/community/server/media";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { return downloadMedia(request, (await context.params).id); }
