"use client";

import { useState } from "react";
import { CircleAlert, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { IntegrationNote } from "@/components/ui/primitives";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { ComplaintCreateForm } from "./complaint-create-form";

export function SupportDraftDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { session } = useCampusSession();
  if (session?.account?.status === "active") return <Dialog open={open} onClose={onClose} title="Submit a private support request" description="Your request is persisted privately. Only you and specifically assigned office staff can read it."><ComplaintCreateForm onCreated={(id) => { onCreated?.(id); onClose(); }} /></Dialog>;
  return <DemoSupportDraftDialog open={open} onClose={onClose} />;
}
function DemoSupportDraftDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Campus facilities");
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);
   return <Dialog open={open} onClose={onClose} title="Try a support-request draft" description="Use fictional content only. This preview cannot create a private ticket or contact an office." className="support-draft-dialog"><IntegrationNote title="No support backend is connected">This draft stays in page memory while you explore. It is never submitted or saved, and will be lost on refresh. Do not enter personal or sensitive information.</IntegrationNote><form className="support-draft-form" onSubmit={(event) => { event.preventDefault(); setUnavailable(true); }}><label htmlFor="support-category">Sample category</label><select id="support-category" className="form-input" value={category} onChange={(event) => setCategory(event.target.value)}><option>Campus facilities</option><option>Account access</option><option>Academic guidance</option><option>Transport information</option></select><label htmlFor="support-subject">Subject</label><input id="support-subject" aria-label="Subject" className="form-input" value={subject} maxLength={120} required placeholder="Example: a light in the sample study room" onChange={(event) => setSubject(event.target.value)} /><label htmlFor="support-message">Fictional description</label><textarea id="support-message" aria-label="Fictional description" className="form-input" rows={4} value={message} required minLength={10} maxLength={1500} placeholder="Describe a fictional situation to explore the interface." onChange={(event) => setMessage(event.target.value)} /><span className="field-helper">{message.length}/1500 characters · No attachments in preview</span>{unavailable && <p className="form-error" role="alert"><CircleAlert size={19} />Submission unavailable. No ticket was created. Your preview draft has been kept in this dialog.</p>}<button className="button button--primary" type="submit"><Send size={17} />Check submission availability</button></form></Dialog>;
}
