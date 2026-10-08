import { z } from "zod";
import { eventCategorySchema, eventIdSchema } from "./validation";

export const liveEventSchema = z.object({
  id: eventIdSchema, club_id: eventIdSchema, title: z.string(), description: z.string(),
  category: eventCategorySchema, venue: z.string(), starts_at: z.string(), ends_at: z.string(),
  registration_deadline: z.string(), capacity: z.number().int(),
  visibility: z.enum(["public", "campus"]), status: z.enum(["draft", "published", "cancelled"]),
  created_at: z.string(), updated_at: z.string(),
});
export const ticketSchema = z.object({
  id: eventIdSchema, event_id: eventIdSchema,
  status: z.enum(["registered", "waitlisted", "cancelled"]),
  ticket_token: eventIdSchema.nullable(), checked_in_at: z.string().nullable(),
  queued_at: z.string(), updated_at: z.string(), waitlist_position: z.number().int().nullable(),
});
export const organizerCapabilitiesSchema = z.object({
  clubs: z.array(z.object({ id: eventIdSchema, name: z.string() })),
  events: z.array(liveEventSchema),
});
export type LiveEvent = z.infer<typeof liveEventSchema>;
export type EventTicket = z.infer<typeof ticketSchema>;
export type OrganizerCapabilities = z.infer<typeof organizerCapabilitiesSchema>;
