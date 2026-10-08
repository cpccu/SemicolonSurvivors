"use client";

import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { CommunityBoundary } from "@/modules/community/components/live-shared";
import { LiveTransport } from "./live-transport";

export function TransportScreen() {
  return <div className="module-page">
    <ModulePageHeader module="transport" preview={false}>
      Reviewed routes and scheduled departures are published by authorized campus staff; vehicle tracking is not provided.
    </ModulePageHeader>
    <CommunityBoundary><LiveTransport /></CommunityBoundary>
  </div>;
}
