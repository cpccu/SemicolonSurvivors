import type { ContentRow } from "./models";
import type { ResourceRow } from "../resources/models";

export type ContentJson = string | number | boolean | null | { [key: string]: ContentJson | undefined } | ContentJson[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type Rpc<Args, Returns = ContentJson> = { Args: Args; Returns: Returns };
export type ContentTables = {
  academic_audiences: Table<{ id: string; kind: "department" | "course" | "section"; label: string; department_match: string | null }>;
  academic_memberships: Table<{ user_id: string; audience_id: string; verified_at: string }>;
  campus_content: Table<ContentRow>;
  content_revisions: Table<{ id: string; content_id: string; version: number; actor_name: string; reason: string; created_at: string; snapshot: ContentJson }>;
  campus_resources: Table<ResourceRow>;
  resource_reports: Table<{ id: string; resource_id: string; reporter_id: string; reason: string; status: string; created_at: string; reviewed_at: string | null }>;
};
export type ContentFunctions = {
  content_capabilities: Rpc<Record<string, never>>;
  content_save: Rpc<{ p_id: string | null; p_expected_version: number | null; p_input: ContentJson }>;
  content_delete: Rpc<{ p_id: string; p_expected_version: number }>;
  resource_begin: Rpc<{ p_metadata: ContentJson }>;
  resource_update: Rpc<{ p_id: string; p_expected_version: number; p_metadata: ContentJson }>;
  resource_remove: Rpc<{ p_id: string; p_expected_version: number }>;
  resource_report: Rpc<{ p_id: string; p_reason: string }>;
  resource_review: Rpc<{ p_id: string; p_scope_id: string; p_action: "remove" | "approve_ai" | "dismiss"; p_reason: string }>;
  resource_preview: Rpc<{ p_id: string }>;
  resource_storage_record: Rpc<{ p_id: string; p_actor_id: string | null }>;
  resource_finish: Rpc<{ p_id: string; p_actor_id: string; p_size: number; p_mime: string; p_text: string | null }>;
  resource_storage_outcome: Rpc<{ p_id: string; p_actor_id: string; p_outcome: "failed" | "cleanup_pending" | "cleaned" }>;
};
