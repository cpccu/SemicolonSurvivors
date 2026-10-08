"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import type { TotpFactor } from "../mfa-schemas";

export function MfaRemovalDialog({ factor, busy, blocked, error, onClose, onRemove }: {
  factor: TotpFactor; busy: boolean; blocked: boolean; error: string | null;
  onClose: () => void; onRemove: () => Promise<boolean>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const failure = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) failure.current?.focus(); }, [error]);
  async function remove() {
    if (!confirmed || busy || blocked) return;
    if (await onRemove()) onClose();
  }
  return <Dialog open className="mfa-removal-dialog" onClose={() => { if (!busy) onClose(); }} initialFocus={cancel} title="Remove authenticator?" description="This requires an active profile and MFA verified within the last five minutes.">
    <p>Remove “{factor.friendlyName}” from your account and sign out of this browser session. Staff actions will continue to require managed aal2 assurance.</p>
    {error && <p ref={failure} tabIndex={-1} className="identity-error" role="alert">{error}</p>}
    <label className="identity-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} /><span>I confirm removal of this authenticator and understand this session will be signed out.</span></label>
    <div className="identity-actions"><button ref={cancel} type="button" className="button button--secondary" disabled={busy} onClick={onClose}>{error ? "Close and review status" : "Keep authenticator"}</button><button type="button" className="button button--danger" disabled={!confirmed || busy || blocked} onClick={remove}>{busy ? "Removing…" : "Remove and sign out"}</button></div>
  </Dialog>;
}
