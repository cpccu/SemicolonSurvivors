"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { CommunityBoundary } from "@/modules/community/components/live-shared";
import { LiveLostFound } from "./live-lost-found";

export function LostFoundScreen() {
  const { session } = useCampusSession();
  const [reportOpen, setReportOpen] = useState(false);
  const active = session?.account?.status === "active";

  return <div className="module-page">
    <ModulePageHeader module="lost-found" preview={false} action={<button className="button button--primary" disabled={!active} onClick={() => setReportOpen(true)}><Plus size={17} />Report an item</button>}>
      Browse persisted campus reports and keep ownership evidence inside private claim workflows.
    </ModulePageHeader>
    <CommunityBoundary><LiveLostFound reportOpen={reportOpen} onReportOpenChange={setReportOpen} /></CommunityBoundary>
  </div>;
}
