import { z } from "zod";

export const aiSourceSchema = z.strictObject({
  id: z.uuid(), version: z.number().int().positive(), title: z.string().max(180),
  text: z.string().min(10).max(18000), url: z.string().max(2048),
});
export type AiSource = z.infer<typeof aiSourceSchema>;
const statementSchema = z.strictObject({ text: z.string().trim().min(1).max(800), sourceId: z.uuid(), quote: z.string().trim().min(10).max(700) });
export const modelAnswerSchema = z.strictObject({ supported: z.boolean(), statements: z.array(statementSchema).max(6) });
export const aiAnswerSchema = z.strictObject({
  available: z.boolean(), reason: z.enum(["ready", "disabled", "unavailable", "unsupported", "quota"]),
  statements: z.array(statementSchema).max(6), sources: z.array(aiSourceSchema.omit({ text: true })).max(5),
});
export type AiAnswer = z.infer<typeof aiAnswerSchema>;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
export function verifyAnswer(input: unknown, sources: AiSource[]) {
  const answer = modelAnswerSchema.parse(input);
  if (answer.supported !== (answer.statements.length > 0)) throw new Error("Invalid supported state.");
  for (const statement of answer.statements) {
    const source = sources.find((candidate) => candidate.id === statement.sourceId);
    if (!source || !normalize(source.text).includes(normalize(statement.quote))) throw new Error("Unverified citation.");
    if (/https?:\/\/|<\/?[a-z]|\b(?:execute|system prompt|api key)\b/i.test(statement.text)) throw new Error("Unsafe generated output.");
  }
  return answer;
}
export function boundSources(sources: AiSource[]): AiSource[] {
  let remaining = 18000;
  return sources.slice(0, 5).flatMap((source) => {
    const text = source.text.slice(0, Math.min(6000, remaining)); remaining -= text.length;
    return text.length >= 10 ? [{ ...source, text }] : [];
  });
}
export function fallbackAnswer(reason: AiAnswer["reason"], sources: AiSource[]): AiAnswer {
  return { available: false, reason, statements: [], sources: sources.map((source) => ({ id: source.id, version: source.version, title: source.title, url: source.url })) };
}
