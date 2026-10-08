import { z } from "zod";

export const audienceSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(["department", "course", "section"]), label: z.string().min(1).max(120),
});
export const contentKindSchema = z.enum(["notice", "article", "service"]);
export type ContentKind = z.infer<typeof contentKindSchema>;
export const httpsUrl = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});
const nullableDate = z.iso.datetime({ offset: true }).nullable();
export const contentInputSchema = z.strictObject({
  kind: contentKindSchema, audienceId: z.uuid(), title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(10).max(12000), category: z.string().trim().min(1).max(80),
  sourceUrl: httpsUrl, ownerLabel: z.string().trim().min(2).max(120),
  visibility: z.enum(["public", "campus"]), reviewedAt: z.iso.datetime({ offset: true }),
  expiresAt: nullableDate, opensAt: nullableDate, closesAt: nullableDate,
  eligibility: z.string().trim().max(2000), destinationUrl: httpsUrl.nullable(),
  noticeType: z.enum(["general", "class_cancelled", "room_change", "time_change", "exam", "deadline"]),
  changeBefore: z.string().trim().max(1000), changeAfter: z.string().trim().max(1000),
  approvedAi: z.boolean(), status: z.enum(["draft", "published", "archived"]),
  revisionReason: z.string().trim().min(3).max(500),
}).superRefine((value, context) => {
  if (value.opensAt && value.closesAt && Date.parse(value.closesAt) <= Date.parse(value.opensAt)) {
    context.addIssue({ code: "custom", path: ["closesAt"], message: "Closing must follow opening." });
  }
  if (value.kind === "service" && (!value.destinationUrl || !value.eligibility)) {
    context.addIssue({ code: "custom", path: ["destinationUrl"], message: "Services need eligibility and a reviewed destination." });
  }
});
export type ContentInput = z.infer<typeof contentInputSchema>;
export const contentRowSchema = z.object({
  id: z.uuid(), kind: contentKindSchema, audience_id: z.uuid(), title: z.string(), body: z.string(),
  category: z.string(), source_url: httpsUrl, owner_label: z.string(), publisher_id: z.uuid(),
  publisher_name: z.string(), visibility: z.enum(["public", "campus"]), reviewed_at: z.string(),
  expires_at: z.string().nullable(), opens_at: z.string().nullable(), closes_at: z.string().nullable(),
  eligibility: z.string(), destination_url: httpsUrl.nullable(), notice_type: z.string(),
  change_before: z.string(), change_after: z.string(), approved_ai: z.boolean(),
  status: z.enum(["draft", "published", "archived"]), version: z.number().int().positive(),
  created_at: z.string(), updated_at: z.string(),
});
export type ContentRow = z.infer<typeof contentRowSchema>;
export const revisionSchema = z.object({
  id: z.uuid(), content_id: z.uuid(), version: z.number().int().positive(),
  actor_name: z.string(), reason: z.string(), created_at: z.string(), snapshot: contentRowSchema,
});
export const contentPageSchema = z.strictObject({ items: z.array(contentRowSchema), nextOffset: z.number().nullable() });
export const capabilitiesSchema = z.strictObject({
  audiences: z.array(audienceSchema), publishAudiences: z.array(audienceSchema), moderatorScopes: z.array(z.uuid()),
});
export const listQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(""), offset: z.coerce.number().int().min(0).max(1000).default(0),
  audience: z.uuid().optional(), category: z.string().trim().max(80).optional(),
  manage: z.enum(["true", "false"]).default("false"),
});
