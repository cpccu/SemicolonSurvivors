"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { CityUniversityLogo } from "@/components/branding/city-university-logo";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { sessionSchema } from "../schemas";
import { notifySessionChanged, postIdentity } from "../client-api";

export function PasswordSetup() {
  const { session, loading, error: sessionError } = useCampusSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const eligible = session?.authenticated && ["pending", "active"].includes(session.account?.status ?? "");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setPending(true);
    try {
      const result = await postIdentity("/api/auth/password", { password }, sessionSchema);
      if (result.account?.status !== "active") throw new Error("Account activation is still pending. Contact enrollment.");
      setComplete(true); notifySessionChanged();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Password setup could not be completed."); }
    finally { setPassword(""); setConfirmation(""); setPending(false); }
  }
  return <main className="identity-page"><Link href="/" className="identity-brand"><span>CampusOS</span><span className="identity-brand-institution"><span className="identity-brand-logo-frame"><CityUniversityLogo className="identity-brand-logo" priority /></span><small>{CAMPUS_INSTITUTION_LABEL}</small></span></Link><section className="identity-panel">
    <div className="identity-heading"><span className="identity-mark" aria-hidden="true"><KeyRound size={26} strokeWidth={1.5} /></span><div><p className="eyebrow">Secure account setup</p><h1>Choose your password</h1></div></div>
    <p className="identity-intro">Use at least 12 characters, up to 128. A passphrase is easier to remember.</p>
    {loading && <p role="status">Checking your verified account…</p>}
    {!loading && !eligible && <p className="identity-error" role="alert">Confirm your invitation or recovery link first. No public signup is available.</p>}
    {(error || sessionError) && <p className="identity-error" role="alert">{error || sessionError}</p>}
    {complete ? <div className="identity-complete" role="status"><h2>Your password is saved</h2><p>Your approved account is active.</p><Link className="button button--primary" href="/">Continue to campus</Link></div> :
      <form className="auth-form" onSubmit={submit}><label htmlFor="new-password">New password</label><input className="form-input" id="new-password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!eligible || pending} /><label htmlFor="confirm-password">Confirm password</label><input className="form-input" id="confirm-password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={!eligible || pending} /><button className="button button--primary" disabled={!eligible || pending}>{pending ? "Saving…" : "Save password and continue"}</button></form>}
    <Link href="/">Return to campus</Link>
  </section></main>;
}
