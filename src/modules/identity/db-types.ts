export type IdentityJson = string | number | boolean | null | { [key: string]: IdentityJson | undefined } | IdentityJson[];

type Table<Row, Insert = Partial<Row>> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };
type ProfileRow = {
  user_id: string; full_name: string; status: "pending" | "active" | "suspended" | "deactivated";
  student_id: string | null; department: string | null; batch: string | null;
};
type RosterRecord = {
  id: string; student_id: string; email: string; full_name: string; department: string; batch: string;
  approved: boolean; user_id: string | null; activated_at: string | null;
  auth_status: string; email_status: string; invitation_attempts: number;
  invitation_lease: string | null; invitation_started_at: string | null;
  created_at: string; updated_at: string;
};

export type IdentityTables = {
  profiles: Table<ProfileRow, Omit<ProfileRow, "status"> & { status?: ProfileRow["status"] }>;
  role_assignments: Table<{ id: string; user_id: string; role: string; scope_kind: string; scope_id: string }>;
  audit_events: Table<{
    id: string; actor_id: string | null; target_type: string; target_id: string | null;
    action: string; created_at: string; details: IdentityJson;
  }>;
  enrollment_roster: Table<RosterRecord>;
  enrollment_imports: Table<{
    id: string; actor_id: string; scope_id: string; state: string; created_at: string; confirmed_at: string | null;
  }>;
  enrollment_import_rows: Table<{
    batch_id: string; row_number: number; student_id: string; email: string; full_name: string;
    department: string; batch: string; result: string; reason: string | null; roster_id: string | null;
  }>;
};

export type IdentityFunctions = {
  campus_access: { Args: Record<string, never>; Returns: IdentityJson };
  identity_health: { Args: Record<string, never>; Returns: string };
  consume_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
  enrollment_stage_import: { Args: { p_scope_id: string; p_rows: IdentityJson }; Returns: IdentityJson };
  enrollment_confirm_import: { Args: { p_batch_id: string; p_scope_id: string }; Returns: IdentityJson };
  enrollment_import_report: { Args: { p_batch_id: string; p_scope_id: string }; Returns: IdentityJson };
  enrollment_recent_imports: { Args: { p_scope_id: string }; Returns: IdentityJson };
  enrollment_begin_invitation: { Args: { p_student_id: string }; Returns: IdentityJson };
  enrollment_finish_invitation: {
    Args: { p_roster_id: string; p_lease_id: string; p_user_id: string | null; p_outcome: "sent" | "failed" | "uncertain" };
    Returns: boolean;
  };
  enrollment_bind_identity: { Args: Record<string, never>; Returns: boolean };
  enrollment_complete_activation: { Args: Record<string, never>; Returns: boolean };
};
