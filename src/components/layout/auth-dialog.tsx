"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { Dialog } from "@/components/ui/dialog";
import { IntegrationNote } from "@/components/ui/primitives";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { sessionSchema } from "@/modules/identity/schemas";
import { notifySessionChanged, postIdentity } from "@/modules/identity/client-api";

type AuthView = "sign-in" | "activate" | "reset" | "help";
const messageSchema = z.strictObject({ message: z.string() });

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<AuthView>("sign-in");
  const { session, loading, error: sessionError } = useCampusSession(open);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = session?.readiness.signInAvailable === true;
  const emailReady = session?.readiness.emailAvailable === true;
  function changeView(next: AuthView) { setView(next); setError(null); setMessage(null); setPassword(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage(null);
    try {
      if (view === "sign-in") {
        const result = await postIdentity("/api/auth/sign-in", { email, password }, sessionSchema);
        notifySessionChanged();
        if (result.account?.status === "pending") setMessage("Your account is pending. Continue password setup to finish activation.");
        else onClose();
      } else {
        const result = await postIdentity(view === "activate" ? "/api/enrollment/claim" : "/api/auth/password-reset",
          view === "activate" ? { studentId } : { email }, messageSchema);
        setMessage(result.message);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setPending(false); setPassword(""); }
  }
  return <Dialog open={open} onClose={onClose} title="Your campus, a little closer." description="Sign in to keep your campus life connected." className="auth-dialog">
     <div className="auth-identity"><span className="auth-identity-icon"><GraduationIcon /></span><span>CampusOS<small>{CAMPUS_INSTITUTION_LABEL} · Approved campus accounts only</small></span></div>
     <div className="filter-tabs auth-tabs"><button className={view === "sign-in" ? "is-active" : ""} aria-pressed={view === "sign-in"} onClick={() => changeView("sign-in")}>Sign in</button><button className={view === "help" || view === "activate" ? "is-active" : ""} aria-pressed={view === "help" || view === "activate"} onClick={() => changeView("help")}>Get help</button></div>
    {loading && <p role="status">Checking account service…</p>}
    {!loading && !ready && <IntegrationNote title="Authentication backend required">Account access is unavailable until the configured service and identity database are ready. No sample accounts exist; preview names are fictional.</IntegrationNote>}
    {!loading && ready && !emailReady && <IntegrationNote title="Email delivery is disabled">Sign-in is available for existing approved accounts. Activation and reset emails remain disabled until SMTP is verified and rollout is enabled.</IntegrationNote>}
    {(error || sessionError) && <p className="identity-error" role="alert">{error || sessionError}</p>}
    {message && <p className="identity-status" role="status">{message}{view === "sign-in" && <> <Link href="/auth/password" onClick={onClose}>Continue setup</Link></>}</p>}
    {(view === "sign-in" || view === "reset") && <form className="auth-form" onSubmit={submit}>
      {view === "reset" && <h3>Reset your password</h3>}
      <label htmlFor="auth-email">Approved email address</label><div className="input-icon"><Mail size={18} /><input id="auth-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@your-campus.edu" autoComplete="username" required disabled={!ready || pending} /></div>
      {view === "sign-in" && <><label htmlFor="auth-password">Password</label><div className="input-icon"><LockKeyhole size={18} /><input id="auth-password" type="password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={!ready || pending} /></div></>}
      <button className="button button--primary" disabled={pending || (view === "sign-in" ? !ready : !emailReady)}>{pending ? "Please wait…" : view === "reset" ? "Request reset instructions" : ready ? "Sign in" : "Sign in unavailable"}<ArrowRight size={17} /></button>
      <button type="button" className="text-button" onClick={() => changeView(view === "sign-in" ? "reset" : "sign-in")}>{view === "sign-in" ? "Forgot your password?" : "Back to sign in"}</button>
    </form>}
    {view === "activate" && <form className="activation-content auth-form" onSubmit={submit}><h3>A secure start, in three steps.</h3><ol className="numbered-steps"><li><span>01</span><div><strong>Find your approved student record</strong><p>Enrollment must add your student ID to the campus roster first.</p></div></li><li><span>02</span><div><strong>Check your approved email</strong><p>When delivery is enabled, activation goes only to your roster-approved address.</p></div></li><li><span>03</span><div><strong>Set up your account</strong><p>Explicitly confirm the link and choose a password. Opening the link alone does not activate your account.</p></div></li></ol><label htmlFor="auth-student-id">Student ID</label><input id="auth-student-id" className="form-input" maxLength={40} value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Your approved student ID" required disabled={!emailReady || pending} /><button className="button button--primary" disabled={!emailReady || pending}>{pending ? "Please wait…" : emailReady ? "Request activation instructions" : "Activation unavailable"}<ArrowRight size={17} /></button></form>}
     {view === "help" && <div className="auth-help"><h3>Need a hand getting in?</h3><p>An approved roster record is required. If your student ID or email is incorrect, contact your institution’s enrollment office through a verified campus channel.</p><div className="auth-help-actions"><button className="button button--secondary" onClick={() => changeView("activate")}>Activate an approved account<ArrowRight size={17} /></button><button className="text-button" onClick={() => changeView("reset")}>Reset your password<ArrowRight size={17} /></button></div></div>}
    <p className="auth-footer"><ShieldCheck size={15} /> No public role selection. No sample login credentials.</p>
  </Dialog>;
}

function GraduationIcon() {
  return <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="m3 11 12-6 12 6-12 6-12-6Z" stroke="currentColor" strokeWidth="1.6" /><path d="M8 14v7c5 4 9 4 14 0v-7M27 11v10" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
