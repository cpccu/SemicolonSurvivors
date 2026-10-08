"use client";

import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { LiveResources } from "./live-resources";

export function ResourcesScreen() {
  return <div className="module-page">
    <ModulePageHeader module="resources" preview={false}>
      Browse persisted course materials with account-scoped access, safe previews, and downloads where permitted.
    </ModulePageHeader>
    <LiveResources />
  </div>;
}
