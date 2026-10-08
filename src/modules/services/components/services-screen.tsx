"use client";

import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { LiveContent } from "@/modules/content/components/live-content";

export function ServicesScreen() {
  return <div className="module-page"><ModulePageHeader module="services" preview={false}>Reviewed service instructions, eligibility and deadlines. External form completion is not tracked.</ModulePageHeader>
    <LiveContent kind="service" endpoint="/api/services" /></div>;
}
