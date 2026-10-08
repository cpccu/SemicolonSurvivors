"use client";

import Link from "next/link";
import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { CommunityBoundary } from "@/modules/community/components/live-shared";
import { LiveAdministration } from "./live-administration";

export function AdministrationScreen() {
  return <div className="module-page">
    <ModulePageHeader module="administration" preview={false} action={<div className="header-action-links"><Link className="button button--secondary" href="/auth/enrollment">Enrollment</Link><Link className="button button--secondary" href="/auth/security">Security</Link></div>}>
      Publishing, enrollment, and review access use institution-scoped assignments and current MFA assurance.
    </ModulePageHeader>
    <CommunityBoundary><LiveAdministration /></CommunityBoundary>
  </div>;
}
