"use client";
import { useState } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { complaintSchema, historySchema, messageSchema } from "@/modules/community/models";
import { campusTime, communityRequest, failureMessage, uploadPhoto } from "@/modules/community/client";
import { LoadState, Photo, useCommunityLoad } from "@/modules/community/components/live-shared";
import { complaintNextStates } from "../transitions";

const detailSchema = z.object({ complaint: complaintSchema, messages: z.array(messageSchema), history: z.array(historySchema), timelineLimit: z.number() });
export function LiveComplaintDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const result = useCommunityLoad(`/api/complaints/${id}`, detailSchema); const { session } = useCampusSession();
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const complaint = result.data?.complaint; const own = complaint?.owner_id === session?.account?.userId;
  return <Dialog open onClose={onClose} title={complaint?.subject ?? "Private request"} description="Private conversation, assigned office, and persisted state history."><LoadState loading={result.loading} error={result.error} />{complaint && <><p>Receipt: {complaint.id}</p><p>{complaint.state.replaceAll("_", " ")} · Office {complaint.office_id} · {complaint.assigned_staff_id ? "Specifically assigned staff" : "Awaiting staff assignment"}</p><p>{complaint.description}</p><p className="field-helper">Escalation flags this request for the currently assigned office; it does not promise forwarding or a response deadline. Closed requests cannot receive messages. The newest 100 messages and history entries are shown.</p>
    <h3>Private conversation</h3>{!result.data?.messages.length && <p>No responses yet.</p>}{result.data?.messages.map((message) => <article className="detail-source" key={message.id}><small>{message.author_id === complaint.owner_id ? "Student" : "Assigned staff"} · {campusTime(message.created_at)}</small><p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>{message.attachment_id && <Photo id={message.attachment_id} description="Private request attachment" />}</article>)}
    {complaint.state !== "closed" && <form className="support-draft-form" onSubmit={async (event) => {
      event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); setBusy(true); setStatus("");
      try { let mediaId = attachmentId; const file = fields.get("attachment"); if (!mediaId && file instanceof File && file.size) { mediaId = await uploadPhoto(file, "complaint"); setAttachmentId(mediaId); }
        await communityRequest(`/api/complaints/${id}/messages`, z.object({ message: messageSchema }), { data: { body: fields.get("body"), attachmentId: mediaId } }); setStatus("Private message saved."); setAttachmentId(null); form.reset(); result.reload();
      } catch (error) { setStatus(failureMessage(error)); } finally { setBusy(false); }
    }}><label>Private reply<textarea className="form-input" name="body" required maxLength={3000} rows={4} /></label><label>Optional image attachment · PNG<input className="form-input" type="file" name="attachment" accept="image/png" onChange={() => setAttachmentId(null)} /></label><p className="field-helper">PNG only, up to 3 MiB and 2048 × 2048 pixels; metadata is removed. Upload authorization matches this private case.</p><button className="button button--primary" disabled={busy}>{busy ? "Saving…" : "Send private reply"}</button></form>}
    {!!complaintNextStates(complaint.state, own).length && <form className="support-draft-form" onSubmit={async (event) => {
      event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setStatus("");
      try { await communityRequest(`/api/complaints/${id}`, z.object({ complaint: complaintSchema }), { method: "PATCH", data: { version: complaint.version, state: fields.get("state"), note: fields.get("note") } }); setStatus("State and history saved."); result.reload(); } catch (error) { setStatus(failureMessage(error)); } finally { setBusy(false); }
    }}><label>Next state<select name="state" className="form-input">{complaintNextStates(complaint.state, own).map((state) => <option value={state} key={state}>{state.replaceAll("_", " ")}</option>)}</select></label><label>Reason for the change<textarea name="note" className="form-input" required minLength={3} maxLength={500} /></label><button className="button button--secondary" disabled={busy}>Save state change</button></form>}
    <h3>Status timeline</h3><ol>{result.data?.history.map((entry) => <li key={entry.id}><strong>{entry.to_state.replaceAll("_", " ")}</strong> · {campusTime(entry.created_at)}<p>{entry.note}</p></li>)}</ol>
  </>}{status && <p role="status">{status}</p>}</Dialog>;
}
