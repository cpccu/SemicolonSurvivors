"use client";
import { useState } from "react";
import { z } from "zod";
import { useLiveQuery } from "@/modules/content/use-live-query";
import { contentFetch, jsonOptions } from "@/modules/content/client";
import { AiResult } from "@/modules/content/components/ai-result";
import { aiAnswerSchema, type AiAnswer } from "@/lib/ai/grounding";
import { previewSchema, resourceRowSchema, type ResourceRow } from "../models";

const actionResponse = z.object({ item: resourceRowSchema.optional(), reported: z.boolean().optional(), cleanupRequired: z.boolean().optional() });
const downloadSchema = z.strictObject({ url: z.string().url(), expiresIn: z.literal(60) });
export function LiveResourceDetail({ item, owner, moderatorScope, onEdit, onChanged }: {
  item: ResourceRow; owner: boolean; moderatorScope?: string | undefined; onEdit: () => void; onChanged: () => void;
}) {
  const preview = useLiveQuery(item.upload_state === "ready" ? `/api/resources/${item.id}/preview` : null, previewSchema);
  const [reason, setReason] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [message, setMessage] = useState(""); const [confirm, setConfirm] = useState(false); const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  async function action(input: unknown, refresh = true) {
    setPending(true); setError(""); setMessage("");
    try {
      const result = await contentFetch(`/api/resources/${item.id}`, actionResponse, jsonOptions("POST", input));
      if (refresh) onChanged(); else setMessage(result.reported ? "Report saved for review." : "Action saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Action failed."); }
    finally { setPending(false); }
  }
  async function download() {
    setPending(true); setError("");
    try {
      const result = await contentFetch(`/api/resources/${item.id}/download`, downloadSchema);
      window.location.assign(result.url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Download is unavailable."); }
    finally { setPending(false); }
  }
  async function summarize() {
    setPending(true); setError("");
    try { setAnswer(await contentFetch(`/api/resources/${item.id}/summary`, aiAnswerSchema, jsonOptions("POST", { consent }))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Summary unavailable."); }
    finally { setPending(false); }
  }
  return <div className="content-detail"><p className="content-provenance">Community · {item.publisher_name} · {item.visibility} · {item.upload_state}</p>
    <p>{[item.department, item.course, item.semester, item.category].filter(Boolean).join(" · ")}</p><p className="content-body">{item.description}</p>
    <p>{item.mime_type ?? "File not finalized"} · {item.byte_size ? `${Math.ceil(item.byte_size / 1024)} KB` : "No finalized size"} · Metadata revision {item.version}</p>
    {item.upload_state === "ready" && <div className="content-actions"><button className="button button--primary" disabled={pending} onClick={() => void download()}>Download file</button>
      {owner && <button className="button button--secondary" disabled={pending} onClick={onEdit}>Edit metadata</button>}</div>}
    {preview.loading && <p role="status">Loading safe text preview…</p>}{preview.error && <p role="alert">{preview.error}</p>}
    {preview.data?.text && <section><h3>Plain-text preview</h3><p className="content-body content-document">{preview.data.text}</p></section>}
    {preview.data && !preview.data.supported && <p>PDF text preview and extraction are unavailable. Download the PDF to read it.</p>}
    <p className="small-note">Uploaded files are untrusted. Signature checks are not malware scanning; no scanner is installed. Signed downloads expire after 60 seconds, including after later removal.</p>
    {item.approved_ai && item.mime_type === "text/plain" && item.upload_state === "ready" && <section><h3>Source-bound text excerpt summary</h3>
      <p className="small-note">Uses only a reviewed public/campus text excerpt (up to 6,000 characters), never private documents. AI may be disabled.</p>
      <label className="content-checkbox"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to sending the reviewed excerpt to the configured AI provider</label>
      <button className="button button--secondary" disabled={pending || !consent} onClick={() => void summarize()}>Summarize reviewed text</button>{answer && <AiResult answer={answer} />}</section>}
    {item.upload_state === "ready" && <section><h3>Report a resource</h3><label>Reason<textarea minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <button className="button button--secondary" disabled={pending || reason.trim().length < 3} onClick={() => void action({ action: "report", reason }, false)}>Send report</button></section>}
    {moderatorScope && item.visibility !== "private" && <section><h3>Scoped moderation review</h3><p>Use the report reason field above for your decision (3–500 characters).</p><div className="content-actions">
      {["dismiss", "approve_ai", "remove"].map((decision) => <button className="button button--secondary" key={decision} disabled={pending || reason.trim().length < 3 || reason.length > 500 || (decision === "approve_ai" && (item.mime_type !== "text/plain" || item.upload_state !== "ready"))}
        onClick={() => void action({ action: "review", scopeId: moderatorScope, decision, reason })}>{decision === "approve_ai" ? "Approve text for AI" : decision === "dismiss" ? "Dismiss reports" : "Remove resource"}</button>)}</div></section>}
    {owner && item.upload_state !== "removed" && <div className="content-actions">{!confirm ? <button className="button button--secondary" disabled={pending} onClick={() => setConfirm(true)}>Remove my resource</button>
      : <><span>Remove this resource and its stored file?</span><button className="button button--primary" disabled={pending} onClick={() => void action({ action: "remove", expectedVersion: item.version })}>Confirm removal</button><button className="text-button" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button></>}</div>}
    {(owner || moderatorScope) && ["pending", "failed", "cleanup_pending"].includes(item.upload_state) && <section><p>Upload/removal needs reconciliation. Pending uploads can be cleaned after 10 minutes. Cleanup runs only when requested.</p>
      <button className="button button--secondary" disabled={pending} onClick={() => void action({ action: "reconcile" })}>Reconcile / retry file cleanup</button></section>}
    {pending && <p role="status">Working…</p>}{error && <p className="content-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </div>;
}
