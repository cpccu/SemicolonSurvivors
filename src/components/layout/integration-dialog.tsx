"use client";

import Link from "next/link";
import { ArrowRight, Cable, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useCampus } from "./campus-context";

export function IntegrationDialog({ action, onClose }: { action: string | null; onClose: () => void }) {
  const { session, navigate, openAuth } = useCampus();
  const active = session?.authenticated && session.account?.status === "active";
  const liveEvents = action === "Event registration";
  const liveLostFound = !!action && (action.includes("Lost or found") || action.includes("item claim"));
  const title = liveEvents && active ? "This sample event is preview-only" : liveLostFound && active ? "This sample item is preview-only" : `${action ?? "This action"} needs a connected campus`;
  const explanation = liveEvents && active
    ? "Your account is active. This sample event cannot reserve a seat; use the separate live-events collection for published database-backed registrations."
    : liveLostFound && active
      ? "Your account is active. This sample item has no owner or private evidence; use persistent campus reports for real claims and handover."
    : active
      ? "Your account is active, but this preview action is not connected to its persistent campus workflow yet."
      : "This action requires managed authentication, server-side permissions, and a persistent campus service. It is unavailable in this preview.";
  const next = () => { onClose(); if (liveEvents && active) navigate("events"); else if (liveLostFound && active) navigate("lost-found"); else openAuth(); };
  const nextLabel = liveEvents && active ? "Open live events" : liveLostFound && active ? "Open live reports" : active ? "Account security" : "Account access";
  return <Dialog open={Boolean(action)} onClose={onClose} title={title} description="You’re exploring a frontend preview, with clearly labeled sample content." className="integration-dialog"><div className="integration-illustration"><Cable size={34} /></div><p className="integration-explanation">{explanation}</p><p className="integration-assurance"><ShieldCheck size={18} /> No registration, submission, upload, or account change has been made.</p><div className="dialog-actions"><button className="button button--secondary" onClick={onClose}>Keep exploring</button>{active && !liveEvents && !liveLostFound ? <Link className="button button--primary" href="/auth/security" onClick={onClose}>Account security<ArrowRight size={16} /></Link> : <button className="button button--primary" onClick={next}>{nextLabel}<ArrowRight size={16} /></button>}</div></Dialog>;
}
