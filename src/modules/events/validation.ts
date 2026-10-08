import { z } from "zod";
import { entityIdSchema } from "@/lib/validation/input";

export const eventCategorySchema = z.enum(["Technology", "Community", "Creative", "Academic", "Other"]);
export const eventIdSchema = entityIdSchema;
export const eventActionSchema = z.strictObject({});
export const checkInSchema = z.strictObject({ token: entityIdSchema });
export const eventListSchema = z.strictObject({
  query: z.string().trim().max(120).default(""),
  category: eventCategorySchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const createEventSchema = z.strictObject({
  clubId: entityIdSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  category: eventCategorySchema,
  venue: z.string().trim().min(2).max(200),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  registrationDeadline: z.iso.datetime({ offset: true }),
  capacity: z.number().int().min(1).max(10000),
  visibility: z.enum(["public", "campus"]),
}).superRefine((value, context) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must follow start time." });
  }
  if (Date.parse(value.registrationDeadline) > Date.parse(value.startsAt)) {
    context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration closes before the event starts." });
  }
});
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventListInput = z.infer<typeof eventListSchema>;

export function isSameOrigin(origin: string | null, requestUrl: string, fetchSite: string | null): boolean {
  if (!origin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) return false;
  try {
    const supplied = new URL(origin);
    return supplied.origin === new URL(requestUrl).origin && supplied.pathname === "/"
      && !supplied.username && !supplied.password && !supplied.search && !supplied.hash;
  }
  catch { return false; }
}

// Escape wildcard characters so a search cannot silently become an unbounded pattern.
export function literalSearch(query: string): string {
  return `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
