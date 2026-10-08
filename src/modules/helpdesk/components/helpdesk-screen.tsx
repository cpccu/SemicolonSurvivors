"use client";

import { ArrowRight } from "lucide-react";
import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { LiveContent } from "@/modules/content/components/live-content";
import { GroundedHelpdesk } from "./grounded-helpdesk";

export function HelpdeskScreen() {
  return <div className="module-page">
    <ModulePageHeader module="helpdesk" preview={false} action={<a className="button button--primary" href="#campus-ai"><ArrowRight size={17} />Open the Decision Desk</a>}>
      A source-grounded campus decision desk for approved guidance. It helps you choose a next step without seeing private cases or completing actions for you.
    </ModulePageHeader>
    <GroundedHelpdesk />
    <LiveContent kind="article" endpoint="/api/helpdesk" />
  </div>;
}
