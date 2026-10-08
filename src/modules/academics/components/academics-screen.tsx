"use client";

import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { LiveContent } from "@/modules/content/components/live-content";

export function AcademicsScreen() {
  return <div className="module-page">
    <ModulePageHeader module="academics" preview={false}>
      Published academic updates are scoped to verified audiences and include source and revision history.
    </ModulePageHeader>
    <LiveContent kind="notice" endpoint="/api/academics" />
  </div>;
}
