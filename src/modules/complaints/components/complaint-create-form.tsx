"use client";
import { useState } from "react";
import { z } from "zod";
import { complaintSchema, officeSchema } from "@/modules/community/models";
import { communityRequest, failureMessage } from "@/modules/community/client";
import { LoadState, useCommunityLoad } from "@/modules/community/components/live-shared";

const officesSchema = z.object({ offices: z.array(officeSchema) });
export function ComplaintCreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const offices = useCommunityLoad("/api/complaints/offices", officesSchema); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <><LoadState loading={offices.loading} error={offices.error} />{offices.data && <form className="support-draft-form" onSubmit={async (event) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try { const result = await communityRequest("/api/complaints", z.object({ complaint: complaintSchema }), { data: { officeId: fields.get("office"), subject: fields.get("subject"), description: fields.get("description") } }); onCreated(result.complaint.id); } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  }}><label>Responsible office<select className="form-input" name="office" required><option value="">Choose an office</option>{offices.data.offices.map((office) => <option key={office.id} value={office.id}>{office.title}{office.default_staff_id ? "" : " · awaiting staff assignment"}</option>)}</select></label>{!offices.data.offices.length && <p>No active support offices are configured. Your input remains in this form; submission is unavailable.</p>}<label>Subject<input className="form-input" name="subject" required minLength={3} maxLength={120} /></label><label>Private description<textarea className="form-input" name="description" required minLength={10} maxLength={3000} rows={5} /></label><p className="field-helper">A receipt acknowledges storage by CampusOS, not an office response. There is no promised university response time. You can attach a PNG image in the private conversation after creation.</p>{message && <p role="alert">{message}</p>}<button className="button button--primary" disabled={busy || !offices.data.offices.length}>{busy ? "Submitting…" : "Submit private request"}</button></form>}</>;
}
