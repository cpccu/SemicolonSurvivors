"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIdentity, notifySessionChanged, postIdentity } from "./client-api";
import { mfaRemovedSchema, mfaStateSchema, totpChallengeSchema, totpSetupSchema,
  type MfaState, type TotpChallenge, type TotpSetup } from "./mfa-schemas";

export function useMfaWorkflow(onSignedOut: () => void) {
  const mounted = useRef(false);
  const operation = useRef(0);
  const [state, setState] = useState<MfaState | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [challenge, setChallenge] = useState<TotpChallenge | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const isCurrent = useCallback((version: number) => mounted.current && version === operation.current, []);

  const load = useCallback(async (version: number) => {
    try {
      const result = await getIdentity("/api/auth/mfa", mfaStateSchema);
      if (isCurrent(version)) { setState(result); setUncertain(false); }
    } catch (failure) {
      if (isCurrent(version)) setError(failure instanceof Error ? failure.message : "Factor status could not be loaded.");
    } finally { if (isCurrent(version)) setBusy(false); }
  }, [isCurrent]);

  const refresh = useCallback(async () => {
    const version = ++operation.current;
    setBusy(true); setError(null);
    await load(version);
  }, [load]);

  const invalidate = useCallback(() => { mounted.current = false; operation.current++; }, []);

  useEffect(() => {
    mounted.current = true;
    void load(++operation.current);
    return invalidate;
  }, [load, invalidate]);

  async function enroll() {
    if (busy || uncertain) return;
    const version = ++operation.current;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await postIdentity("/api/auth/mfa/enroll", {}, totpSetupSchema);
      if (!isCurrent(version)) return;
      setSetup(result); setMessage("Setup created. Save it in your authenticator, then verify a code.");
      const listed = await getIdentity("/api/auth/mfa", mfaStateSchema);
      if (isCurrent(version)) setState(listed);
    } catch (failure) {
      if (isCurrent(version)) {
        setUncertain(true);
        setError(`${failure instanceof Error ? failure.message : "Setup could not be completed."} Reload factor status before trying again; a pending setup may already exist.`);
      }
    } finally { if (isCurrent(version)) setBusy(false); }
  }

  async function startChallenge(factorId: string) {
    if (busy) return;
    const version = ++operation.current;
    setBusy(true); setError(null); setMessage(null); setChallenge(null);
    try {
      const result = await postIdentity("/api/auth/mfa/challenge", { factorId }, totpChallengeSchema);
      if (isCurrent(version)) setChallenge(result);
    } catch (failure) {
      if (isCurrent(version)) setError(failure instanceof Error ? failure.message : "A challenge could not be started.");
    } finally { if (isCurrent(version)) setBusy(false); }
  }

  async function verify(code: string) {
    if (busy || !challenge) return;
    const version = ++operation.current;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await postIdentity("/api/auth/mfa/verify", { factorId: challenge.factorId, challengeId: challenge.challengeId, code }, mfaStateSchema);
      if (!isCurrent(version)) return;
      setState(result); setSetup(null); setChallenge(null);
      setMessage("Authenticator verified. Managed Auth confirmed an aal2 session."); notifySessionChanged();
    } catch (failure) {
      if (isCurrent(version)) setError(`${failure instanceof Error ? failure.message : "The code could not be verified."} Check the current code or explicitly start a new challenge if this one expired.`);
    } finally { if (isCurrent(version)) setBusy(false); }
  }

  async function remove(factorId: string) {
    if (busy || uncertain) return false;
    const version = ++operation.current;
    setBusy(true); setError(null); setMessage(null);
    try {
      await postIdentity("/api/auth/mfa/remove", { factorId, confirmRemoval: true }, mfaRemovedSchema);
      if (isCurrent(version)) { setSetup(null); setChallenge(null); onSignedOut(); notifySessionChanged(); }
      return true;
    } catch (failure) {
      if (isCurrent(version)) {
        setUncertain(true);
        setError(`${failure instanceof Error ? failure.message : "Removal could not be completed."} The factor may have changed. Reload status before retrying; removal requires MFA verified within the last five minutes.`);
      }
      return false;
    } finally { if (isCurrent(version)) setBusy(false); }
  }

  const hideSetup = useCallback(() => {
    setSetup(null); setMessage("Setup details hidden. If you saved the authenticator, verify its code using the pending factor below.");
  }, []);
  return { state, setup, challenge, busy, error, message, uncertain, refresh, enroll, startChallenge, verify, remove, hideSetup };
}
