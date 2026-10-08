"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TotpChallenge } from "../mfa-schemas";

export function TotpVerificationForm({ challenge, busy, onVerify, onRestart }: {
  challenge: TotpChallenge; busy: boolean; onVerify: (code: string) => Promise<void>; onRestart: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  useEffect(() => { input.current?.focus(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    try { await onVerify(code); }
    finally { setCode(""); input.current?.focus(); }
  }
  return <section className="mfa-challenge" aria-labelledby="mfa-code-heading"><h2 id="mfa-code-heading">Verify your authenticator code</h2>
    <p>Enter the current six-digit code. Supabase controls challenge expiry and replay protection. Nothing is verified until the server confirms the new session.</p>
    <form className="auth-form" onSubmit={submit}><label htmlFor="mfa-code">Authenticator code</label><input ref={input} className="form-input mfa-code" id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={busy} aria-describedby="mfa-code-note" /><p id="mfa-code-note">Challenge expiry: {new Date(challenge.expiresAt * 1000).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka" })} (Dhaka).</p><div className="identity-actions"><button className="button button--primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify code"}</button><button type="button" className="text-button" disabled={busy} onClick={onRestart}>Start a new challenge</button></div></form>
  </section>;
}
