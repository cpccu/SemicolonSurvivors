import "server-only";
import { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import { configuredAi, groundedGemini } from "@/lib/ai/gemini";
import { fallbackAnswer } from "@/lib/ai/grounding";
import { parseContent, type ContentContext } from "@/modules/content/server/http";
import { enforceContentRate } from "@/modules/content/server/rate";
import { getResource, resourcePreview } from "./service";

export async function summarizeResource(context: ContentContext, id: string, input: unknown) {
  if (!context.actor) throw new ApplicationError("authentication");
  parseContent(z.strictObject({ consent: z.literal(true) }), input);
  const resource = await getResource(context, id);
  if (resource.visibility === "private" || !resource.approved_ai || resource.upload_state !== "ready" || resource.mime_type !== "text/plain") return fallbackAnswer("unsupported", []);
  const preview = await resourcePreview(context, id);
  if (!preview.text) return fallbackAnswer("unsupported", []);
  const sources = [{ id, version: resource.version, title: resource.title, text: preview.text.slice(0, 18000), url: `/resources?resource=${id}` }];
  const config = configuredAi(process.env, "resource");
  if (!config) return fallbackAnswer("disabled", sources);
  try { await enforceContentRate("ai", context.actor.userId); }
  catch (error) { if (error instanceof ApplicationError && error.code === "quota") return fallbackAnswer("quota", sources); throw error; }
  return groundedGemini(config, "Summarize the provided text excerpt. Make no claim about omitted content or PDF extraction.", sources);
}
