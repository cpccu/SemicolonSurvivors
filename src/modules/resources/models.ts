import { z } from "zod";

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const resourceMetadataSchema = z.strictObject({
  title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(2000),
  department: z.string().trim().max(100), course: z.string().trim().max(80), semester: z.string().trim().max(40),
  category: z.string().trim().min(1).max(80), visibility: z.enum(["public", "campus", "private"]),
});
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export const resourceRowSchema = z.object({
  id: z.uuid(), owner_id: z.uuid(), publisher_name: z.string(), title: z.string(), description: z.string(),
  department: z.string(), course: z.string(), semester: z.string(), category: z.string(),
  visibility: z.enum(["public", "campus", "private"]),
  upload_state: z.enum(["pending", "ready", "failed", "cleanup_pending", "removed"]),
  mime_type: z.enum(["text/plain", "application/pdf"]).nullable(), byte_size: z.number().int().nullable(),
  approved_ai: z.boolean(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});
export type ResourceRow = z.infer<typeof resourceRowSchema>;
export const resourcePageSchema = z.strictObject({ items: z.array(resourceRowSchema), nextOffset: z.number().nullable() });
export const previewSchema = z.strictObject({ text: z.string().nullable(), supported: z.boolean(), version: z.number().int() });
export const resourceQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(""), offset: z.coerce.number().int().min(0).max(1000).default(0),
  department: z.string().trim().max(100).optional(), course: z.string().trim().max(80).optional(),
  semester: z.string().trim().max(40).optional(), category: z.string().trim().max(80).optional(),
  mine: z.enum(["true", "false"]).default("false"), review: z.enum(["true", "false"]).default("false"),
});
