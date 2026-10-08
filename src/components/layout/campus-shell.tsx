"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CampusContext, type DetailSelection } from "./campus-context";
import { Sidebar, MobileNavigation } from "./navigation";
import { CampusHeader } from "./header";
import { SearchDialog } from "./search-dialog";
import { ModuleDrawer } from "./module-drawer";
import { AuthDialog } from "./auth-dialog";
import { DetailDialog } from "./detail-dialog";
import { IntegrationDialog } from "./integration-dialog";
import { ModuleScreen } from "@/modules/campus/components/module-screen";
import { campusModules, type Destination, type ModuleId } from "@/modules/campus/data/modules";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import type { SessionView } from "@/modules/identity/schemas";

const destinations = new Set<string>([...campusModules.map((module) => module.id), "actions"]);

export function CampusShell({ children, initialSession = null }: { children: ReactNode; initialSession?: SessionView | null }) {
  const { session, loading: sessionLoading, error: sessionError, signOut } = useCampusSession(true, initialSession);
  const [active, setActive] = useState<Destination>("today");
  const [searchOpen, setSearchOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const [integration, setIntegration] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [filters, setFilters] = useState<Partial<Record<ModuleId, string>>>({});
  const [announcement, setAnnouncement] = useState("");
  const scrollPositions = useRef<Partial<Record<Destination, number>>>({});
  const main = useRef<HTMLElement>(null);
  const current = useRef<Destination>("today");

  const navigate = useCallback((destination: Destination) => {
    scrollPositions.current[current.current] = window.scrollY;
    // History navigation must also close module-local dialogs before hiding their screen.
    document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((dialog) => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    current.current = destination;
    setActive(destination);
    setSearchOpen(false);
    setModulesOpen(false);
    if (window.location.hash !== `#${destination}`) window.history.pushState(null, "", `#${destination}`);
    requestAnimationFrame(() => { window.scrollTo({ top: scrollPositions.current[destination] ?? 0, behavior: "instant" }); main.current?.focus({ preventScroll: true }); });
  }, []);

  useEffect(() => {
    const readHash = () => {
      const destination = window.location.hash.slice(1);
      if (destinations.has(destination)) navigate(destination as Destination);
      else if (!destination) navigate("today");
    };
    const frame = window.location.hash ? requestAnimationFrame(readHash) : null;
    window.addEventListener("popstate", readHash);
    return () => { if (frame !== null) cancelAnimationFrame(frame); window.removeEventListener("popstate", readHash); };
  }, [navigate]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const dialog = document.querySelector("dialog[open]");
        if (!dialog || dialog.classList.contains("search-dialog")) setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    main.current?.querySelectorAll(".reveal:not(.is-revealed)").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setAnnouncement(""), 3000);
    return () => clearTimeout(timer);
  }, [announcement]);

  const toggleSaved = useCallback((id: string) => {
    setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setAnnouncement("Preview bookmark updated. Saved items are session-only.");
  }, []);

  const value = useMemo(() => ({ session, sessionLoading, sessionError, signOut, active, navigate, saved, filters, toggleSaved,
    openSearch: () => setSearchOpen(true), openModules: () => setModulesOpen(true), openAuth: () => setAuthOpen(true),
    openDetail: (selection: DetailSelection) => { setSearchOpen(false); setDetail(selection); },
    requireIntegration: (action: string) => { setDetail(null); setIntegration(action); },
    setFilter: (module: ModuleId, filter: string) => setFilters((previous) => ({ ...previous, [module]: filter })),
  }), [session, sessionLoading, sessionError, signOut, active, navigate, saved, filters, toggleSaved]);

  return (
    <CampusContext.Provider value={value}>
      <div className="campus-shell">
        <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>Skip to main content</a>
        <Sidebar />
        <div className="campus-workspace">
          <CampusHeader />
          <main id="main-content" className="campus-main" ref={main} tabIndex={-1}>
            <div hidden={active !== "today"}>{children}</div>
            <ModuleScreen />
          </main>
        </div>
        <MobileNavigation />
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        <ModuleDrawer open={modulesOpen} onClose={() => setModulesOpen(false)} />
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
        <DetailDialog selection={detail} onClose={() => setDetail(null)} />
        <IntegrationDialog action={integration} onClose={() => setIntegration(null)} />
        <div className={`preview-toast ${announcement ? "is-visible" : ""}`} role="status" aria-live="polite">{announcement}</div>
      </div>
    </CampusContext.Provider>
  );
}
