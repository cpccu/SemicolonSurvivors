"use client";
import { useState } from "react";
import { z } from "zod";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { complaintSchema, officeSchema } from "@/modules/community/models";
import { campusTime } from "@/modules/community/client";
import { LoadState, Pager, useCommunityLoad } from "@/modules/community/components/live-shared";
import { SupportDraftDialog } from "./support-draft-dialog";
import { LiveComplaintDetail } from "./live-complaint-detail";

const listSchema = z.object({ complaints: z.array(complaintSchema), page: z.number(), hasMore: z.boolean() });
const officesSchema = z.object({ offices: z.array(officeSchema) });
export function LiveComplaints() {
  const { session } = useCampusSession(); const [page, setPage] = useState(1); const [create, setCreate] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const result = useCommunityLoad(`/api/complaints?page=${page}`, listSchema);
  const offices = useCommunityLoad("/api/complaints/offices", officesSchema);
  return <section className="detail-section"><div className="section-heading"><div><p className="eyebrow">Private persisted requests</p><h2>Your support requests</h2></div><button className="button button--primary" disabled={session?.account?.status !== "active"} onClick={() => setCreate(true)}>New private request</button></div><p>Only your requests and cases specifically assigned to you appear here. Assigned office staff require MFA. Moderation and system administration do not grant private case access.</p><button className="text-button" onClick={result.reload}>Refresh requests</button><LoadState loading={result.loading} error={result.error} />{result.data && <>{!result.data.complaints.length && <p>No authorized support requests yet. Submit a private request to a configured office to receive a persistent receipt.</p>}{result.data.complaints.map((complaint) => <article className="detail-source" key={complaint.id}><small>{complaint.state.replaceAll("_", " ")} · Updated {campusTime(complaint.updated_at)}</small><h3>{complaint.subject}</h3><p>Office: {offices.data?.offices.find((office) => office.id === complaint.office_id)?.title ?? complaint.office_id} · {complaint.assigned_staff_id ? "Staff assigned" : "Awaiting assignment"}</p><button className="button button--secondary" onClick={() => setSelected(complaint.id)}>Open private conversation and history</button></article>)}<Pager page={page} hasMore={result.data.hasMore} onPage={setPage} /></>}
    <SupportDraftDialog open={create} onClose={() => setCreate(false)} onCreated={(id) => { result.reload(); setSelected(id); }} />
    {selected && <LiveComplaintDetail id={selected} onClose={() => { setSelected(null); result.reload(); }} />}
  </section>;
}
