"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { contentFetch, jsonOptions } from "@/modules/content/client";
import { resourceMetadataSchema, resourceRowSchema, MAX_UPLOAD_BYTES, type ResourceRow } from "../models";
import { validateUpload } from "../upload-validation";

const responseSchema = z.strictObject({ item: resourceRowSchema });
export function ResourceForm({ initial, onSaved }: { initial?: ResourceRow | undefined; onSaved: () => void }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const input = resourceMetadataSchema.safeParse(Object.fromEntries(["title", "description", "department", "course", "semester", "category", "visibility"].map((key) => [key, String(form.get(key) ?? "")])));
      if (!input.success) throw new Error(input.error.issues[0]?.message ?? "Check your metadata.");
      if (initial) await contentFetch(`/api/resources/${initial.id}`, responseSchema, jsonOptions("PATCH", { metadata: input.data, expectedVersion: initial.version }));
      else {
        const file = form.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD_BYTES) throw new Error("Choose a TXT or PDF file up to 3 MB.");
        validateUpload(new Uint8Array(await file.arrayBuffer()), file.type, file.name);
        const upload = new FormData(); upload.append("file", file); upload.append("metadata", JSON.stringify(input.data));
        await contentFetch("/api/resources", responseSchema, { method: "POST", body: upload });
      }
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Upload could not be completed."); }
    finally { setPending(false); }
  }
  return <form className="content-form" onSubmit={submit}>
    <p className="small-note">Resources are community contributions. Course labels organize files and do not verify enrollment or confer an official badge.</p>
    {!initial && <><label>TXT or PDF file<input name="file" type="file" accept=".txt,.pdf,text/plain,application/pdf" required /></label>
      <p className="small-note">Up to 3 MB. TXT: UTF-8, at most 60,000 characters. PDF: download only; text extraction is unavailable. Files are untrusted and no malware scanner is installed.</p></>}
    <label>Title<input name="title" required minLength={3} maxLength={180} defaultValue={initial?.title} /></label>
    <label>Description<textarea name="description" required minLength={3} maxLength={2000} rows={4} defaultValue={initial?.description} /></label>
    <div className="content-form-grid"><label>Department label<input name="department" maxLength={100} defaultValue={initial?.department} /></label>
      <label>Course label<input name="course" maxLength={80} defaultValue={initial?.course} /></label>
      <label>Semester<input name="semester" maxLength={40} defaultValue={initial?.semester} /></label>
      <label>Category<input name="category" required maxLength={80} defaultValue={initial?.category} /></label></div>
    <label>Who can access?<select name="visibility" defaultValue={initial?.visibility ?? "campus"}><option value="campus">Active campus accounts</option><option value="private">Only me</option><option value="public">Anyone (public metadata and authorized download)</option></select></label>
    <p className="small-note">Storage is private; download links expire after 60 seconds. Editing resets approval for AI summaries.</p>
    {error && <p role="alert" className="content-error">{error}</p>}
    <button type="submit" className="button button--primary" disabled={pending}>{pending ? initial ? "Saving…" : "Uploading and validating…" : initial ? "Save metadata" : "Upload resource"}</button>
  </form>;
}
