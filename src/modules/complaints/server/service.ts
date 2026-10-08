import "server-only";
import { z } from "zod";
import { checkResult, CommunityFailure, type CommunityClient } from "@/modules/community/server/database";
import { complaintSchema, historySchema, messageSchema, officeSchema } from "@/modules/community/models";
import type { complaintInput, complaintTransitionInput, messageInput, searchSchema } from "@/modules/community/validation";

export async function listComplaints(database: CommunityClient, input: z.infer<typeof searchSchema>) {
  const start = (input.page - 1) * input.limit;
  const result = await database.from("community_complaints").select("*").order("updated_at", { ascending: false }).order("id").range(start, start + input.limit); checkResult(result.error);
  const rows = z.array(complaintSchema).parse(result.data);
  return { complaints: rows.slice(0, input.limit), page: input.page, hasMore: rows.length > input.limit };
}
export async function listOffices(database: CommunityClient) {
  const result = await database.from("community_offices").select("*").eq("active", true).order("title").limit(100); checkResult(result.error);
  return { offices: z.array(officeSchema).parse(result.data) };
}
export async function complaintDetail(database: CommunityClient, id: string) {
  const result = await database.from("community_complaints").select("*").eq("id", id).maybeSingle(); checkResult(result.error);
  if (!result.data) throw new CommunityFailure("not_found", 404, "This request is unavailable.");
  const messages = await database.from("community_messages").select("*").eq("complaint_id", id).order("created_at", { ascending: false }).limit(100); checkResult(messages.error);
  const history = await database.from("community_history").select("*").eq("complaint_id", id).order("created_at", { ascending: false }).limit(100); checkResult(history.error);
  return { complaint: complaintSchema.parse(result.data), messages: z.array(messageSchema).parse(messages.data), history: z.array(historySchema).parse(history.data), timelineLimit: 100 };
}
export async function createComplaint(database: CommunityClient, input: z.infer<typeof complaintInput>) {
  const result = await database.rpc("community_create_complaint", { p_office_id: input.officeId, p_subject: input.subject, p_description: input.description }); checkResult(result.error);
  return { complaint: complaintSchema.parse(result.data) };
}
export async function sendMessage(database: CommunityClient, id: string, input: z.infer<typeof messageInput>) {
  const result = await database.rpc("community_complaint_message", { p_id: id, p_body: input.body, p_attachment_id: input.attachmentId ?? null }); checkResult(result.error);
  return { message: messageSchema.parse(result.data) };
}
export async function transitionComplaint(database: CommunityClient, id: string, input: z.infer<typeof complaintTransitionInput>) {
  const result = await database.rpc("community_complaint_transition", { p_id: id, p_version: input.version, p_state: input.state, p_note: input.note }); checkResult(result.error);
  return { complaint: complaintSchema.parse(result.data) };
}
