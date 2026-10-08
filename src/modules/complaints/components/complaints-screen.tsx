"use client";

import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { CommunityBoundary } from "@/modules/community/components/live-shared";
import { LiveComplaints } from "./live-complaints";

export function ComplaintsScreen() {
  return <div className="module-page">
    <ModulePageHeader module="complaints" preview={false}>
      Private requests are visible only to their owner and specifically assigned support staff.
    </ModulePageHeader>
    <CommunityBoundary><LiveComplaints /></CommunityBoundary>
  </div>;
}
