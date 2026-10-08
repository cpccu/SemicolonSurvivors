"use client";
import { useState } from "react";
import { z } from "zod";
import { contentRowSchema, revisionSchema, type ContentRow } from "../models";
import { useLiveQuery } from "../use-live-query";
import { contentFetch, jsonOptions } from "../client";

const detailSchema = z.strictObject({ item: contentRowSchema, revisions: z.array(revisionSchema) });
const itemResponse = z.strictObject({ item: contentRowSchema });
const date = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
export function ContentDetail({ item, endpoint, audience, canEdit, onEdit, onChange }: {
  item: ContentRow; endpoint: string; audience?: string | undefined; canEdit: boolean; onEdit: () => void; onChange: () => void;
}) {
  const detail = useLiveQuery(`${endpoint}/${item.id}`, detailSchema);
  const [confirm, setConfirm] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function archive() {
    setPending(true); setError("");
    try { await contentFetch(`${endpoint}/${item.id}`, itemResponse, jsonOptions("DELETE", { expectedVersion: item.version })); onChange(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to archive."); }
    finally { setPending(false); }
  }
  const current = detail.data?.item ?? item; const [now] = useState(() => Date.now());
  const closed = !!current.closes_at && Date.parse(current.closes_at) <= now;
  const upcoming = !!current.opens_at && Date.parse(current.opens_at) > now;
  return <div className="content-detail">
    <p className="content-provenance">Official · {current.publisher_name} · Revision {current.version} · {current.status}</p>
    <p>Audience: {audience ?? current.audience_id} · {current.visibility === "public" ? "Public" : "Verified academic audience"}</p>
    <p className="content-body">{current.body}</p>
    {(current.change_before || current.change_after) && <dl className="content-change"><div><dt>Before</dt><dd>{current.change_before || "Not specified"}</dd></div><div><dt>After</dt><dd>{current.change_after || "Not specified"}</dd></div></dl>}
    {current.kind === "service" && <section><h3>Eligibility</h3><p className="content-body">{current.eligibility}</p>
      <p>{current.opens_at && `Opens ${date(current.opens_at)}. `}{current.closes_at ? `Closes ${date(current.closes_at)}.` : "No closing date published."}</p>
      {closed ? <p>Closed for submissions.</p> : upcoming ? <p>Not open yet.</p> : current.destination_url && <a className="button button--primary" href={current.destination_url} target="_blank" rel="noopener noreferrer">Open reviewed external form ↗</a>}
      <p className="small-note">External destination. CampusOS does not issue receipts or track completion for this form.</p></section>}
    <section className="detail-source"><h3>Source & review</h3><p>{current.owner_label} · Reviewed {date(current.reviewed_at)} (Dhaka).</p>
      <a href={current.source_url} target="_blank" rel="noopener noreferrer">Read approved source ↗</a>
      <p>Updated {date(current.updated_at)}.{current.expires_at && ` Expires ${date(current.expires_at)}.`}</p></section>
    {canEdit && <div className="content-actions"><button className="button button--secondary" disabled={pending} onClick={onEdit}>Edit / correct</button>
      {!confirm ? <button className="button button--secondary" disabled={pending || current.status === "archived"} onClick={() => setConfirm(true)}>Archive</button>
        : <><span>Archive this publication?</span><button className="button button--primary" disabled={pending} onClick={() => void archive()}>{pending ? "Archiving…" : "Confirm archive"}</button><button className="text-button" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button></>}
    </div>}
    {error && <p className="content-error" role="alert">{error}</p>}
    <section><h3>Revision history</h3>{detail.loading && <p role="status">Loading history…</p>}{detail.error && <p role="alert">{detail.error}</p>}
      {detail.data?.revisions.map((revision) => <details className="content-revision" key={revision.id}><summary>Revision {revision.version} · {revision.reason} · {date(revision.created_at)}</summary>
        <p>{revision.actor_name} · {revision.snapshot.status}</p><p className="content-body">{revision.snapshot.body}</p>
        {revision.snapshot.change_before && <p>Before: {revision.snapshot.change_before}</p>}{revision.snapshot.change_after && <p>After: {revision.snapshot.change_after}</p>}
      </details>)}<p className="small-note">Latest 20 saved revisions. Published content is archived with its history retained.</p></section>
  </div>;
}
