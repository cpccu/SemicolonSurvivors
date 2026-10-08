export type EventJson = string | number | boolean | null | { [key: string]: EventJson | undefined } | EventJson[];

export type ClubRow = { id: string; name: string; description: string; created_at: string };
export type EventRow = {
  id: string; club_id: string; title: string; description: string; category: string;
  venue: string; starts_at: string; ends_at: string; registration_deadline: string;
  capacity: number; visibility: "public" | "campus"; status: "draft" | "published" | "cancelled";
  created_at: string; updated_at: string;
};
export type RegistrationRow = {
  id: string; event_id: string; user_id: string; status: "registered" | "waitlisted" | "cancelled";
  ticket_token: string | null; queued_at: string; created_at: string; updated_at: string;
  checked_in_at: string | null; checked_in_by: string | null;
};
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type EventTables = {
  clubs: Table<ClubRow>;
  campus_events: Table<EventRow>;
  event_registrations: Table<RegistrationRow>;
};
type Rpc<Args> = { Args: Args; Returns: EventJson };
export type EventFunctions = {
  event_register: Rpc<{ p_event_id: string }>;
  event_cancel_registration: Rpc<{ p_event_id: string }>;
  event_own_ticket: Rpc<{ p_event_id: string }>;
  event_check_in: Rpc<{ p_event_id: string; p_token: string }>;
  event_promote_waitlist: Rpc<{ p_event_id: string }>;
  event_create: Rpc<{
    p_club_id: string; p_title: string; p_description: string; p_category: string; p_venue: string;
    p_starts_at: string; p_ends_at: string; p_registration_deadline: string; p_capacity: number;
    p_visibility: "public" | "campus";
  }>;
  event_publish: Rpc<{ p_event_id: string }>;
  event_cancel: Rpc<{ p_event_id: string }>;
  event_organizer_capabilities: Rpc<Record<string, never>>;
};
