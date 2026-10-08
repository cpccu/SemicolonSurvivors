import type { Metadata } from "next";
import { AccessEntry } from "@/components/access/access-entry";
import { CampusShell } from "@/components/layout/campus-shell";
import { createServerDatabaseClient } from "@/lib/database/server";
import { readBackendConfiguration } from "@/lib/validation/environment";
import { TodayScreen } from "@/modules/dashboard/components/today-screen";
import { unavailableReadiness } from "@/modules/identity/readiness";
import type { SessionView } from "@/modules/identity/schemas";
import { getSessionView } from "@/modules/identity/session-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your campus, connected | CampusOS",
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  let session: SessionView = {
    authenticated: false, account: null, fullName: null, assurance: null,
    readiness: unavailableReadiness,
  };
  let sessionError: string | null = null;

  if (readBackendConfiguration(process.env).status === "ready") {
    try {
      session = await getSessionView(await createServerDatabaseClient());
    } catch {
      sessionError = "Account access could not be verified. Please try again.";
    }
  }

  // Never construct protected server children for anonymous or inactive accounts.
  // A client-only visibility gate would still serialize TodayScreen into the RSC payload.
  const allowed = session.authenticated && session.account?.status === "active";
  return (
    <AccessEntry initialSession={session} initialError={sessionError}>
      {allowed ? <CampusShell initialSession={session}><TodayScreen /></CampusShell> : null}
    </AccessEntry>
  );
}
