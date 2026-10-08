import "server-only";
import { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import { configuredAi, groundedGemini } from "@/lib/ai/gemini";
import { fallbackAnswer, type AiSource } from "@/lib/ai/grounding";
import { checkDatabase, parseContent, type ContentContext } from "@/modules/content/server/http";
import { contentRowSchema } from "@/modules/content/models";
import { searchPattern } from "@/modules/content/server/service";
import { enforceContentRate } from "@/modules/content/server/rate";

export const helpdeskQuestionSchema = z.strictObject({
  question: z.string().trim().min(3).max(500).refine((value) => !/[\w.+-]+@[\w.-]+|\b\d{7,}\b/.test(value), "Do not include personal identifiers."),
  consent: z.literal(true),
});
export async function helpdeskAnswer(context: ContentContext, input: unknown) {
  if (!context.actor) throw new ApplicationError("authentication");
  const body = parseContent(helpdeskQuestionSchema, input);
  const keywords = body.question.split(/\s+/).filter((word) => word.length > 3).slice(0, 4);
  let request = context.database.from("campus_content").select("*").eq("kind", "article").eq("status", "published").eq("approved_ai", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (keywords.length) request = request.or(keywords.map((word) => `body.ilike.${searchPattern(word)},title.ilike.${searchPattern(word)}`).join(","));
  const result = await request.order("reviewed_at", { ascending: false }).limit(5);
  checkDatabase(result.error);
  const articles = parseContent(z.array(contentRowSchema), result.data);
  const sources: AiSource[] = articles.map((article) => ({ id: article.id, version: article.version, title: article.title, text: article.body, url: `/helpdesk?article=${article.id}` }));
  const config = configuredAi(process.env, "helpdesk");
  if (!config) return fallbackAnswer("disabled", sources);
  try { await enforceContentRate("ai", context.actor.userId); }
  catch (error) { if (error instanceof ApplicationError && error.code === "quota") return fallbackAnswer("quota", sources); throw error; }
  return groundedGemini(config, body.question, sources);
}
