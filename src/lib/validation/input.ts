import { z } from "zod";

export const entityIdSchema = z.uuid();

function boundedInteger(minimum: number, maximum: number, fallback: number) {
  return z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value,
    z.number().int().min(minimum).max(maximum).default(fallback),
  );
}

export const paginationSchema = z.strictObject({
  page: boundedInteger(1, 10_000, 1),
  limit: boundedInteger(1, 50, 20),
});

export const searchInputSchema = paginationSchema.extend({
  query: z.string().trim().max(120).default(""),
});

export type ValidationIssue = { field: string; message: string };
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      field: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}
