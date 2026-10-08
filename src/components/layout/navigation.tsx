"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCheck, Compass, Menu, Search, ShieldCheck, UsersRound } from "lucide-react";
import { CAMPUS_CONCEPT_LABEL, CAMPUS_INSTITUTION_LABEL, CAMPUS_PRODUCT_NAME } from "@/lib/branding";
import { CityUniversityMark } from "@/components/branding/city-university-logo";
import { campusModules, type Destination } from "@/modules/campus/data/modules";
import { useCampus } from "./campus-context";
import { campusAccountPresentation } from "./account-presentation";

export function CampusMark({ compact = false }: { compact?: boolean }) {
  const mark = <span className={`campus-mark campus-mark--institution ${compact ? "campus-mark--compact" : ""}`}><CityUniversityMark className="campus-mark-logo" priority /></span>;
  return <span className={`campus-brand ${compact ? "campus-brand--compact" : ""}`}>{mark}<span className="campus-brand-copy"><strong>{CAMPUS_PRODUCT_NAME.slice(0, 6)}<span className="brand-os">{CAMPUS_PRODUCT_NAME.slice(6)}</span></strong><small>{CAMPUS_INSTITUTION_LABEL}</small></span></span>;
}

export function Sidebar() {
  const { session, active, navigate, openModules, openAuth } = useCampus();
  const groups = ["Overview", "Campus life", "Academics", "Support", "Staff"] as const;
  const account = campusAccountPresentation(session);
  const accountStatus = session?.authenticated ? session.account?.status : null;
  const accountHref = accountStatus === "pending" ? "/auth/password" : accountStatus === "active" ? "/auth/security" : null;
  const accountTitle = account.active ? "Account security" : accountStatus === "pending" ? "Finish account setup" : "Account access";
  const accountContent = <><ShieldCheck size={18} /><span><strong>{accountTitle}</strong><small>{account.active ? "Password & multi-factor sign-in" : "Manage campus access"}</small></span><ArrowUpRight size={15} /></>;
  return <aside className="sidebar" aria-label="Campus navigation">
    <div className="sidebar-top">
      <button className="brand-button" aria-label={`${CAMPUS_PRODUCT_NAME} · ${CAMPUS_INSTITUTION_LABEL} home`} onClick={() => navigate("today")}><CampusMark /></button>
      <span className="sidebar-private-label"><span aria-hidden="true" />Private campus space</span>
    </div>
    {account.active && <div className="sidebar-account"><span className="profile-avatar" aria-hidden="true">{account.initials}</span><div><span className="sidebar-account-status">VERIFIED ACCOUNT</span><strong>{account.name}</strong><small>{account.roleSummary}</small></div></div>}
    <nav className="sidebar-nav" aria-label="Campus spaces">
      {groups.filter((group) => group !== "Staff" || account.hasStaffAccess).map((group) => <div className={`nav-group ${group === "Staff" ? "nav-group--staff" : ""}`} key={group}><p className="nav-group-label">{group === "Staff" ? "Your workspace" : group}</p>
        {campusModules.filter((module) => module.group === group).map(({ id, shortTitle, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`nav-link ${active === id ? "is-active" : ""}`} aria-current={active === id ? "page" : undefined}><Icon size={18} strokeWidth={1.7} /><span>{shortTitle}</span>{active === id && <span className="active-dot" />}</button>)}
        {group === "Overview" && <button className={`nav-link ${active === "actions" ? "is-active" : ""}`} onClick={() => navigate("actions")} aria-current={active === "actions" ? "page" : undefined}><CheckCheck size={18} strokeWidth={1.7} /><span>My Actions</span>{active === "actions" && <span className="active-dot" />}</button>}
        {group === "Staff" && account.canEnroll && <Link className="nav-link" href="/auth/enrollment"><UsersRound size={18} strokeWidth={1.7} /><span>Enrollment import</span><ArrowUpRight size={14} /></Link>}
      </div>)}
    </nav>
    <div className="sidebar-footer"><button className="sidebar-explore" onClick={openModules}><Compass size={17} /><span>Explore campus spaces</span><ArrowUpRight size={16} /></button>{accountHref ? <Link className="preview-profile" href={accountHref}>{accountContent}</Link> : <button className="preview-profile" onClick={openAuth}>{accountContent}</button>}<p className="sidebar-source-note">{CAMPUS_CONCEPT_LABEL} · Account-scoped content</p></div>
  </aside>;
}

export function MobileNavigation() {
  const { active, navigate, openSearch, openModules } = useCampus();
  const item = (id: Destination, label: string, Icon: typeof Compass) => <button onClick={() => navigate(id)} className={`mobile-nav-item ${active === id ? "is-active" : ""}`} aria-current={active === id ? "page" : undefined}><Icon size={20} /><span>{label}</span></button>;
  return <nav className="mobile-navigation" aria-label="Primary mobile navigation"><span className="mobile-nav-home" aria-hidden="true"><i /><i /></span>{item("today", "Today", CalendarDays)}<button className="mobile-nav-item" onClick={openSearch}><Search size={20} /><span>Search</span></button><button onClick={openModules} className={`mobile-nav-item ${active !== "today" && active !== "actions" ? "is-active" : ""}`}><Menu size={20} /><span>Campus</span></button>{item("actions", "My Actions", CheckCheck)}</nav>;
}
