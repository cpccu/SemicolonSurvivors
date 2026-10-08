import { z } from "zod";
import { exceptionSchema, scheduleSchema } from "./validation";

const reviewed = { id: z.uuid(), title: z.string(), source_label: z.string(), source_url: z.string(), reviewed_at: z.string(), visibility: z.enum(["public", "campus"]), state: z.enum(["draft", "published", "archived"]), version: z.number(), updated_at: z.string(), updated_by: z.uuid() };
export const directorySchema = z.object({ ...reviewed, kind: z.enum(["department", "club", "office", "place", "guide"]), description: z.string(), location: z.string(), contact: z.string() });
export const routeSchema = z.object({ ...reviewed, stops: z.array(z.string()), schedules: z.array(scheduleSchema), exceptions: z.array(exceptionSchema), notice: z.string() });
export const preferencesSchema = z.object({ user_id: z.uuid(), interests: z.array(z.string()), courses: z.array(z.string()), clubs: z.array(z.string()), section: z.string(), saved_route_id: z.uuid().nullable(), updated_at: z.string() });
export const itemSchema = z.object({ id: z.uuid(), owner_id: z.uuid(), kind: z.enum(["lost", "found"]), title: z.string(), description: z.string(), location: z.string(), occurred_on: z.string(), photo_id: z.uuid(), state: z.enum(["open", "handover", "resolved", "withdrawn", "hidden"]), version: z.number(), created_at: z.string(), updated_at: z.string() });
export const claimSchema = z.object({ id: z.uuid(), item_id: z.uuid(), claimant_id: z.uuid(), evidence: z.string(), state: z.enum(["pending", "accepted", "rejected", "completed", "withdrawn"]), created_at: z.string(), updated_at: z.string() });
export const complaintSchema = z.object({ id: z.uuid(), owner_id: z.uuid(), office_id: z.uuid(), assigned_staff_id: z.uuid().nullable(), subject: z.string(), description: z.string(), state: z.enum(["received", "in_review", "awaiting_student", "resolved", "closed", "escalated"]), version: z.number(), created_at: z.string(), updated_at: z.string() });
export const officeSchema = z.object({ id: z.uuid(), title: z.string(), description: z.string(), default_staff_id: z.uuid().nullable(), active: z.boolean() });
export const messageSchema = z.object({ id: z.uuid(), complaint_id: z.uuid(), author_id: z.uuid(), body: z.string(), attachment_id: z.uuid().nullable(), created_at: z.string() });
export const historySchema = z.object({ id: z.uuid(), complaint_id: z.uuid(), actor_id: z.uuid(), from_state: z.string().nullable(), to_state: z.string(), note: z.string(), created_at: z.string() });
export type LiveDirectory = z.infer<typeof directorySchema>;
export type LiveRoute = z.infer<typeof routeSchema>;
export type LiveItem = z.infer<typeof itemSchema>;
export type LiveClaim = z.infer<typeof claimSchema>;
export type LiveComplaint = z.infer<typeof complaintSchema>;
