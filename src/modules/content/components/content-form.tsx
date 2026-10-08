"use client";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { contentFetch, jsonOptions } from "../client";
import { contentInputSchema, contentRowSchema, type ContentKind, type ContentRow, type audienceSchema } from "../models";

type Audience = z.infer<typeof audienceSchema>;
function localDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const itemResponse = z.strictObject({ item: contentRowSchema });
export function ContentForm({ kind, endpoint, audiences, initial, onSaved }: {
  kind: ContentKind; endpoint: string; audiences: Audience[]; initial?: ContentRow | undefined; onSaved: (item: ContentRow) => void;
}) {
  const id = useId(); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const date = (name: string) => text(name) ? new Date(text(name)).toISOString() : null;
    setPending(true); setError("");
    try {
      const result = contentInputSchema.safeParse({
        kind, audienceId: initial?.audience_id ?? text("audience"), title: text("title"), body: text("body"), category: text("category"),
        sourceUrl: text("source"), ownerLabel: text("owner"), visibility: text("visibility"), reviewedAt: date("reviewed"),
        expiresAt: date("expires"), opensAt: date("opens"), closesAt: date("closes"), eligibility: text("eligibility"), destinationUrl: text("destination") || null,
        noticeType: text("noticeType") || "general", changeBefore: text("before"), changeAfter: text("after"),
        approvedAi: form.get("ai") === "on", status: text("status"), revisionReason: text("reason"),
      });
      if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Check the fields.");
      const response = await contentFetch(initial ? `${endpoint}/${initial.id}` : endpoint, itemResponse, jsonOptions(initial ? "PATCH" : "POST", {
        content: result.data, expectedVersion: initial?.version ?? null,
      }));
      onSaved(response.item);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save."); }
    finally { setPending(false); }
  }
  return <form className="content-form" onSubmit={submit}>
    <p className="small-note">Publishing requires your exact academic assignment and verified staff MFA. Source and review information are required.</p>
    <label htmlFor={`${id}-audience`}>Academic audience<select id={`${id}-audience`} name="audience" required disabled={!!initial || pending} defaultValue={initial?.audience_id ?? audiences[0]?.id}>
      {audiences.map((audience) => <option value={audience.id} key={audience.id}>{audience.label} · {audience.kind}</option>)}
    </select></label>
    <label>Title<input name="title" required minLength={3} maxLength={180} defaultValue={initial?.title} /></label>
    <label>{kind === "service" ? "Instructions" : kind === "article" ? "Answer / guidance" : "Notice"}<textarea name="body" required minLength={10} maxLength={12000} rows={7} defaultValue={initial?.body} /></label>
    <div className="content-form-grid"><label>Category<input name="category" required maxLength={80} defaultValue={initial?.category} /></label>
      <label>Responsible owner<input name="owner" required minLength={2} maxLength={120} defaultValue={initial?.owner_label} /></label></div>
    <label>Approved source URL<input type="url" name="source" required maxLength={2048} placeholder="https://…" defaultValue={initial?.source_url} /></label>
    <div className="content-form-grid"><label>Reviewed on<input type="datetime-local" name="reviewed" required defaultValue={localDate(initial?.reviewed_at ?? new Date().toISOString())} /></label>
      <label>Expires on (optional)<input type="datetime-local" name="expires" defaultValue={localDate(initial?.expires_at)} /></label></div>
    {kind === "notice" && <fieldset><legend>Class or deadline change</legend><label>Notice type<select name="noticeType" defaultValue={initial?.notice_type ?? "general"}>
      {["general", "class_cancelled", "room_change", "time_change", "exam", "deadline"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
    </select></label><div className="content-form-grid"><label>Before<input name="before" maxLength={1000} defaultValue={initial?.change_before} /></label><label>After<input name="after" maxLength={1000} defaultValue={initial?.change_after} /></label></div></fieldset>}
    {kind === "service" && <fieldset><legend>Eligibility & reviewed external form</legend><label>Who is eligible?<textarea name="eligibility" required maxLength={2000} defaultValue={initial?.eligibility} /></label>
      <label>Reviewed HTTPS destination<input type="url" name="destination" required maxLength={2048} defaultValue={initial?.destination_url ?? ""} /></label>
      <div className="content-form-grid"><label>Opens on<input type="datetime-local" name="opens" defaultValue={localDate(initial?.opens_at)} /></label><label>Closes on<input type="datetime-local" name="closes" defaultValue={localDate(initial?.closes_at)} /></label></div>
      <p className="small-note">This directory does not track external form completion.</p></fieldset>}
    <div className="content-form-grid"><label>Visibility<select name="visibility" defaultValue={initial?.visibility ?? "campus"}><option value="campus">Campus · academic audience only</option><option value="public">Public · anyone</option></select></label>
      <label>Publication state<select name="status" defaultValue={initial?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Published</option>{initial?.status === "archived" && <option value="archived">Archived</option>}</select></label></div>
    <label className="content-checkbox"><input name="ai" type="checkbox" defaultChecked={initial?.approved_ai} />Reviewed for AI context: no personal or sensitive content</label>
    <label>Reason for this revision<input name="reason" required minLength={3} maxLength={500} placeholder={initial ? "Explain the correction" : "Initial publication"} /></label>
    {error && <p role="alert" className="content-error">{error}</p>}
    <button type="submit" disabled={pending} className="button button--primary">{pending ? "Saving…" : initial ? "Save revision" : "Save content"}</button>
  </form>;
}
