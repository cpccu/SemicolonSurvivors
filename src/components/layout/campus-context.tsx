"use client";

import { createContext, useContext } from "react";
import type { Destination, ModuleId } from "@/modules/campus/data/modules";
import type { SessionView } from "@/modules/identity/schemas";

export type DetailSelection = { kind: "event" | "resource" | "article" | "notice"; id: string };

export interface CampusContextValue {
  session: SessionView | null;
  sessionLoading: boolean;
  sessionError: string | null;
  signOut: () => Promise<void>;
  active: Destination;
  navigate: (destination: Destination) => void;
  openSearch: () => void;
  openModules: () => void;
  openAuth: () => void;
  openDetail: (selection: DetailSelection) => void;
  requireIntegration: (action: string) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
  filters: Partial<Record<ModuleId, string>>;
  setFilter: (module: ModuleId, filter: string) => void;
}

export const CampusContext = createContext<CampusContextValue | null>(null);

export function useCampus() {
  const context = useContext(CampusContext);
  if (!context) throw new Error("Campus components must be rendered inside CampusShell.");
  return context;
}
