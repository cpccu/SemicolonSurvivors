"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bookmark, CheckCheck, CircleHelp, ShieldCheck, UsersRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { campusAccountPresentation } from "@/components/layout/account-presentation";
import { useCampus } from "@/components/layout/campus-context";
import { getModule, type ModuleId } from "@/modules/campus/data/modules";

const quickDestinations: ModuleId[] = ["academics", "resources", "events", "transport", "directory", "complaints"];
const quickLabels: Partial<Record<ModuleId, string>> = {
  academics: "Read course changes", resources: "Get a PDF study guide", events: "Find something happening",
  transport: "Check the next bus", directory: "Find a person or place", complaints: "Ask for private help",
};
const quickDescriptions: Partial<Record<ModuleId, string>> = {
  academics: "Rooms, deadlines, and important updates", resources: "Notes, practice, and useful checklists", events: "Clubs, workshops, and campus life",
  transport: "Routes and scheduled departures", directory: "Departments, contacts, and spaces", complaints: "A traceable support conversation",
};

export function CampusQuickActions() {
  const { session, navigate } = useCampus();
  const account = campusAccountPresentation(session);
  return <section className="campus-quick-actions" aria-labelledby="quick-actions-heading">
     <div className="quick-actions-heading"><h2 id="quick-actions-heading">Start with a task</h2><span>Today’s shortcuts</span></div>
    <div className="quick-actions-grid">{quickDestinations.map((id, index) => {
      const destination = getModule(id);
      const Icon = destination.icon;
       return <button key={id} className={`quick-action quick-action--${index + 1}`} onClick={() => navigate(id)}><span className="quick-action-index">0{index + 1}</span><span className="quick-action-icon"><Icon size={20} strokeWidth={1.8} /></span><span><strong>{quickLabels[id]}</strong><small>{quickDescriptions[id]}</small></span><ArrowUpRight size={16} /></button>;
    })}</div>
    {account.active && <div className="account-quick-links"><Link href="/auth/security"><ShieldCheck size={16} />Account security<ArrowUpRight size={14} /></Link>{account.canEnroll && <Link href="/auth/enrollment"><UsersRound size={16} />Enrollment import<ArrowUpRight size={14} /></Link>}{account.hasStaffAccess && <button onClick={() => navigate("administration")}><ShieldCheck size={16} />Staff workspace<ArrowRight size={14} /></button>}<span>Account tools · connected workflows</span></div>}
  </section>;
}

export function AccountWorkspace() {
  const { session, navigate } = useCampus();
  const account = campusAccountPresentation(session);
  if (!account.active) return null;
  return <section className="account-workspace" aria-labelledby="account-workspace-heading">
    <div className="account-workspace-heading"><p className="eyebrow">YOUR ACCOUNT</p><span className="account-live"><i /> Active</span></div>
    <div className="account-workspace-identity"><span className="profile-avatar" aria-hidden="true">{account.initials}</span><div><h2 id="account-workspace-heading">{account.name}</h2><p>{account.roleSummary}</p></div></div>
    <Link className="account-workspace-link" href="/auth/security"><ShieldCheck size={18} /><span><strong>Security & sign-in</strong><small>{account.securityLabel}</small></span><ArrowUpRight size={16} /></Link>
    {account.canEnroll && <Link className="account-workspace-link" href="/auth/enrollment"><UsersRound size={18} /><span><strong>Enrollment import</strong><small>Review approved roster records</small></span><ArrowUpRight size={16} /></Link>}
    {account.hasStaffAccess && <button className="account-workspace-link" onClick={() => navigate("administration")}><ShieldCheck size={18} /><span><strong>Staff workspace</strong><small>Assigned scopes · MFA required</small></span><ArrowRight size={16} /></button>}
     <p className="account-workspace-note">Campus content and actions are filtered by your account and verified on the server.</p>
  </section>;
}

export function ActionsSummary() {
  const { navigate, saved } = useCampus();
  return (
    <section className="actions-summary reveal">
      <div className="aside-title"><h2>My Actions</h2><CheckCheck size={20} /></div>
      <AnimatePresence mode="wait">
        {saved.length ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="saved-summary"
          >
            <span className="saved-count"><Bookmark size={19} />{saved.length} saved items</span>
            <p>Your next read or campus plan is easy to find again. Saved items last for this session.</p>
            <button className="text-button" onClick={() => navigate("actions")}>See saved items<ArrowRight size={16} /></button>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="actions-empty"
          >
            <span className="actions-paper"><CheckCheck size={25} /></span>
            <h3>Keep something<br />for later.</h3>
            <p>Save an event or resource to revisit here. Saved items last for this session.</p>
            <button className="button button--secondary" onClick={() => navigate("events")}>Explore events<ArrowRight size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="aside-footer-button" onClick={() => navigate("actions")}>Explore My Actions<ArrowUpRight size={16} /></button>
    </section>
  );
}

export function GettingStartedCard() {
  const { navigate } = useCampus();
  return (
    <section className="help-card reveal">
      <span className="help-card-icon"><CircleHelp size={25} /></span>
      <p className="eyebrow">NEW HERE? YOU BELONG HERE.</p>
      <h2>A starting point.<br />Not another search.</h2>
      <p>Find your feet with a simple first-week guide.</p>
      <button className="text-button" onClick={() => navigate("directory")}>
        Open the campus directory<ArrowRight size={17} />
      </button>
      <span className="help-card-demo">Orientation guide</span>
      <div className="help-card-links"><button onClick={() => navigate("helpdesk")}>AI Helpdesk<ArrowRight size={15} /></button><button onClick={() => navigate("services")}>Forms & services<ArrowRight size={15} /></button></div>
    </section>
  );
}
