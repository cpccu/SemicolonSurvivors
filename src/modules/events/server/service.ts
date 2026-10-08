import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import type { EventFunctions, EventJson, EventTables } from "../db-types";
import { liveEventSchema, organizerCapabilitiesSchema, ticketSchema } from "../models";
import { literalSearch, type CreateEventInput, type EventListInput } from "../validation";

// This module's migrated contract is also merged into the shared CampusDatabase type.
export type EventDatabase = { public: {
  Tables: EventTables; Views: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  Functions: EventFunctions & { campus_access: { Args: Record<string, never>; Returns: EventJson } };
} };
export type EventClient = SupabaseClient<EventDatabase>;
export class EventFailure extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); }
}

export function assertDatabaseResult(error: PostgrestError | null) {
  if (!error) return;
  if (["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) throw new ApplicationError("configuration");
  if (["PGRST301", "PGRST302", "PGRST303"].includes(error.code)) throw new ApplicationError("authentication");
  if (error.code === "42501") throw new ApplicationError("authorization");
  if (error.code === "P0002") throw new EventFailure("not_found", 404, "This event or ticket is not available.");
  if (["22023", "23502", "23503", "23514", "22P02"].includes(error.code)) throw new ApplicationError("validation");
  if (["P0001", "23505"].includes(error.code)) {
    const messages: Record<string, string> = {
      event_closed: "Registration has closed for this event.",
      event_waitlist_full: "This event's waitlist is full.",
      event_cancellation_closed: "Cancellation is closed after check-in or the event's start.",
      event_checkin_closed: "Check-in opens two hours before the event and closes at its end.",
      event_publish_closed: "This event cannot be published after its deadline or cancellation.",
    };
    throw new EventFailure("conflict", 409, messages[error.message] ?? "This event changed. Refresh before continuing.");
  }
  throw new ApplicationError("unexpected");
}

export async function requireActiveMember(database: EventClient) {
  const identity = await database.auth.getUser();
  if (identity.error || !identity.data.user) throw new ApplicationError("authentication");
  const access = await database.rpc("campus_access", {});
  assertDatabaseResult(access.error);
  if (!z.object({ status: z.literal("active") }).safeParse(access.data).success) throw new ApplicationError("authorization");
}

export async function listEvents(database: EventClient, input: EventListInput) {
  const offset = (input.page - 1) * input.limit;
  let query = database.from("campus_events").select("*")
    .in("status", ["published", "cancelled"]).order("starts_at").order("id").range(offset, offset + input.limit);
  if (input.query) query = query.ilike("title", literalSearch(input.query));
  if (input.category) query = query.eq("category", input.category);
  const result = await query;
  assertDatabaseResult(result.error);
  const rows = z.array(liveEventSchema).parse(result.data);
  return { events: rows.slice(0, input.limit), page: input.page, hasMore: rows.length > input.limit };
}

export async function getEvent(database: EventClient, eventId: string) {
  const result = await database.from("campus_events").select("*").eq("id", eventId).maybeSingle();
  assertDatabaseResult(result.error);
  if (!result.data) throw new EventFailure("not_found", 404, "This event is not available.");
  const club = await database.from("clubs").select("name").eq("id", result.data.club_id).maybeSingle();
  assertDatabaseResult(club.error);
  return { event: liveEventSchema.parse(result.data), host: club.data?.name ?? "Campus club" };
}

export async function ownTicket(database: EventClient, eventId: string) {
  const result = await database.rpc("event_own_ticket", { p_event_id: eventId });
  assertDatabaseResult(result.error);
  return { ticket: ticketSchema.nullable().parse(result.data) };
}

export async function registerOrCancel(database: EventClient, eventId: string, action: "register" | "cancel") {
  const result = await database.rpc(action === "register" ? "event_register" : "event_cancel_registration", { p_event_id: eventId });
  assertDatabaseResult(result.error);
  return { ticket: ticketSchema.nullable().parse(result.data) };
}

export async function createEvent(database: EventClient, input: CreateEventInput) {
  const result = await database.rpc("event_create", {
    p_club_id: input.clubId, p_title: input.title, p_description: input.description,
    p_category: input.category, p_venue: input.venue, p_starts_at: input.startsAt,
    p_ends_at: input.endsAt, p_registration_deadline: input.registrationDeadline,
    p_capacity: input.capacity, p_visibility: input.visibility,
  });
  assertDatabaseResult(result.error);
  return { event: liveEventSchema.parse(result.data) };
}

export async function publishOrCancelEvent(database: EventClient, eventId: string, action: "publish" | "cancel-event") {
  const result = await database.rpc(action === "publish" ? "event_publish" : "event_cancel", { p_event_id: eventId });
  assertDatabaseResult(result.error);
  return { event: liveEventSchema.parse(result.data) };
}

export async function checkIn(database: EventClient, eventId: string, token: string) {
  const result = await database.rpc("event_check_in", { p_event_id: eventId, p_token: token });
  assertDatabaseResult(result.error);
  return z.object({ already_checked_in: z.boolean(), checked_in_at: z.string() }).parse(result.data);
}

export async function organizerCapabilities(database: EventClient) {
  const result = await database.rpc("event_organizer_capabilities", {});
  assertDatabaseResult(result.error);
  return organizerCapabilitiesSchema.parse(result.data);
}

export async function promoteWaitlist(database: EventClient, eventId: string) {
  const result = await database.rpc("event_promote_waitlist", { p_event_id: eventId });
  assertDatabaseResult(result.error);
  return z.object({ promoted: z.number().int().min(0).max(10000) }).parse(result.data);
}
