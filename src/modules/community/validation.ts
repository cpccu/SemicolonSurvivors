import { z } from "zod";

export const uuid = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const searchSchema = z.object({ query: z.string().trim().max(120).default(""), page: z.coerce.number().int().min(1).max(200).default(1), limit: z.coerce.number().int().min(1).max(30).default(20) });
const reviewed = {
  title: text(2, 120), sourceLabel: text(2, 200), sourceUrl: z.url().max(2048).refine((value) => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }),
  reviewedAt: z.iso.datetime({ offset: true }).refine((value) => Date.parse(value) <= Date.now()), visibility: z.enum(["public", "campus"]), state: z.enum(["draft", "published", "archived"]),
};
export const directoryInput = z.strictObject({ ...reviewed, kind: z.enum(["department", "club", "office", "place", "guide"]), description: text(10, 8000), location: text(0, 200), contact: text(0, 400) });
export const scheduleSchema = z.strictObject({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), days: z.array(z.number().int().min(0).max(6)).min(1).max(7) });
export const exceptionSchema = z.strictObject({ date: z.iso.date(), cancelled: z.boolean(), note: text(0, 500) });
export const routeInput = z.strictObject({ ...reviewed, stops: z.array(text(2, 120)).min(2).max(40), schedules: z.array(scheduleSchema).min(1).max(40), exceptions: z.array(exceptionSchema).max(100), notice: text(0, 1500) });
export const preferenceInput = z.strictObject({ interests: z.array(text(1, 80)).max(20), courses: z.array(text(1, 80)).max(20), clubs: z.array(text(1, 80)).max(20), section: text(0, 80), savedRouteId: uuid.nullable() });
export const itemInput = z.strictObject({ kind: z.enum(["lost", "found"]), title: text(3, 120), description: text(15, 2000), location: text(2, 200), occurredOn: z.iso.date().refine((value) => value <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())), photoId: uuid });
export const claimInput = z.strictObject({ evidence: text(20, 2000) });
export const itemTransitionInput = z.strictObject({ version: z.number().int().positive(), action: z.enum(["accept", "reject", "confirm-handover", "withdraw", "hide"]), claimId: uuid.nullable().optional() });
export const complaintInput = z.strictObject({ officeId: uuid, subject: text(3, 120), description: text(10, 3000) });
export const messageInput = z.strictObject({ body: text(1, 3000), attachmentId: uuid.nullable().optional() });
export const complaintTransitionInput = z.strictObject({ version: z.number().int().positive(), state: z.enum(["in_review", "awaiting_student", "resolved", "closed", "escalated"]), note: text(3, 500) });
export const publishInput = <T extends z.ZodType>(schema: T) => z.strictObject({ id: uuid.nullable(), version: z.number().int().positive().nullable(), data: schema });
export const roleInput = z.strictObject({ role: z.enum(["club_organizer", "academic_publisher", "transport_editor", "support_staff", "moderator", "enrollment_admin", "system_admin"]), scopeKind: z.enum(["club", "department", "course", "section", "route", "office", "institution"]), scopeId: uuid }).refine((input) => ({ club_organizer: ["club"], academic_publisher: ["department", "course", "section"], transport_editor: ["route"], support_staff: ["office"], moderator: ["institution"], enrollment_admin: ["institution"], system_admin: ["institution"] })[input.role].includes(input.scopeKind));
export const adminInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("status"), targetUserId: uuid, reason: text(10, 500), data: z.strictObject({ status: z.enum(["active", "suspended", "deactivated"]) }) }),
  z.strictObject({ action: z.literal("identity"), targetUserId: uuid, reason: text(10, 500), data: z.strictObject({ fullName: text(2, 120), studentId: z.string().regex(/^[A-Z0-9-]{3,40}$/), department: text(1, 100), batch: text(1, 40) }) }),
  z.strictObject({ action: z.literal("grant-role"), targetUserId: uuid, reason: text(10, 500), data: roleInput }),
  z.strictObject({ action: z.literal("revoke-role"), targetUserId: uuid, reason: text(10, 500), data: roleInput }),
]);
export const officeInput = z.strictObject({ id: uuid.nullable(), title: text(2, 120), description: text(0, 1000), staffId: uuid.nullable(), active: z.boolean() });
export const literalSearch = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
