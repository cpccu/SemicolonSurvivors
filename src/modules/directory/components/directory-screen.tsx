"use client";

import { useCampus } from "@/components/layout/campus-context";
import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { CommunityBoundary } from "@/modules/community/components/live-shared";
import { LiveDirectory } from "./live-directory";

export function DirectoryScreen() {
  const { filters } = useCampus();
  return <div className="module-page">
    <ModulePageHeader module="directory" preview={false}>
      Reviewed people, places, offices, and guides published by authorized campus staff.
    </ModulePageHeader>
    <CommunityBoundary><LiveDirectory key={filters.directory ?? ""} query={filters.directory ?? ""} /></CommunityBoundary>
  </div>;
}
