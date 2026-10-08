"use client";

import { Search } from "lucide-react";
import { CAMPUS_INSTITUTION_LABEL, CAMPUS_PRODUCT_NAME } from "@/lib/branding";
import { getModule } from "@/modules/campus/data/modules";
import { CampusMark } from "./navigation";
import { useCampus } from "./campus-context";
import { AccountActions } from "./account-actions";
import { campusAccountPresentation } from "./account-presentation";

export function CampusHeader() {
  const { session, active, navigate, openSearch } = useCampus();
  const account = campusAccountPresentation(session);
  const title = active === "actions" ? "My Actions" : getModule(active).shortTitle;
  return (
    <header className="campus-header">
      <div className="header-location">
        <button className="mobile-brand brand-button" aria-label={`${CAMPUS_PRODUCT_NAME} · ${CAMPUS_INSTITUTION_LABEL} home`} onClick={() => navigate("today")}><CampusMark compact /></button>
        <div className="header-desktop-location"><span className="header-location-label"><span aria-hidden="true" />{CAMPUS_INSTITUTION_LABEL}</span><span className="header-breadcrumb"><strong>{title}</strong><span>Workspace view</span></span></div>
      </div>
      <div className="header-controls">
         <div className="header-status" aria-label="Workspace content status"><span aria-hidden="true" /> <span>Campus workspace</span><small>Account-scoped data when required</small></div>
        <button className="header-search" aria-label="Search campus (Control or Command K)" aria-haspopup="dialog" onClick={openSearch}>
           <Search size={17} /><span>Search campus</span><kbd>⌘ K</kbd>
        </button>
        {account.active && <div className="header-account-summary"><strong title={account.name}>{account.name}</strong><small title={account.roleSummary}>{account.roleSummary}</small></div>}
        <AccountActions />
      </div>
    </header>
  );
}
