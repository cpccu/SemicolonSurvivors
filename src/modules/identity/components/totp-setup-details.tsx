"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { TotpSetup } from "../mfa-schemas";

export function TotpSetupDetails({ setup, busy, onHide, onContinue }: {
  setup: TotpSetup; busy: boolean; onHide: () => void; onContinue: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onHide, 300000);
    window.addEventListener("pagehide", onHide);
    return () => { window.clearTimeout(timeout); window.removeEventListener("pagehide", onHide); };
  }, [setup.factorId, onHide]);
  return <section className="mfa-setup" aria-labelledby="mfa-setup-heading"><h2 id="mfa-setup-heading">Add CampusOS to your authenticator</h2>
    <p>Scan this QR code in your authenticator app. The setup key is private and shown only during this flow; this page hides it after five minutes.</p>
    {setup.qrCode ? <Image className="mfa-qr" src={setup.qrCode} width={256} height={256} unoptimized alt="CampusOS authenticator setup QR code; use the manual setup key below if you cannot scan it." /> : <p>QR rendering is unavailable for this response. Use the manual setup key instead.</p>}
    <details><summary>Manual setup key</summary><p>Account label: CampusOS. Type: time-based (TOTP), SHA-1, 6 digits, 30 seconds.</p><code className="mfa-secret" aria-label="Private authenticator setup key">{setup.secret}</code></details>
    <p>Keep the setup key private. Refreshing or leaving this page will not recover it. A setup is not verified until Auth accepts your code.</p>
    <div className="identity-actions"><button type="button" className="button button--primary" disabled={busy} onClick={onContinue}>Continue to code verification</button><button type="button" className="text-button" disabled={busy} onClick={onHide}>Hide setup details</button></div>
  </section>;
}
