"use client";

import type { ReactNode } from "react";
import { Layers3, MapPinned } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { campusModules, getModule, type Destination } from "../data/modules";
import styles from "./module-workspace.module.css";

type WorkspaceModule = Destination;

const actionMeta = {
  number: "12",
  shortTitle: "My actions",
  group: "Overview",
} as const;

function getWorkspaceMeta(module: WorkspaceModule) {
  return module === "actions" ? actionMeta : getModule(module);
}

export function ModuleWorkspace({ module, children }: { module: WorkspaceModule; children: ReactNode }) {
  const { active, navigate, openModules } = useCampus();
  const item = getWorkspaceMeta(module);
  const neighbors = module === "actions"
    ? campusModules.filter((entry) => entry.group === "Overview")
    : campusModules.filter((entry) => entry.group === item.group && entry.id !== module).slice(0, 3);

  return (
    <section className={styles.workspace} data-workspace-module={module} aria-label={`${item.shortTitle} workspace`}>
      <div className={styles.workspaceBar}>
        <div className={styles.workspaceLocation}>
          <span className={styles.locationMark} aria-hidden="true"><MapPinned size={16} /></span>
          <span className={styles.locationCopy}>
            <small>{item.group} / module {item.number}</small>
            <strong>{item.shortTitle}</strong>
          </span>
        </div>
         <div className={styles.workspaceTools}>
           <button className={styles.moduleMapButton} type="button" onClick={openModules}>
            <Layers3 size={15} aria-hidden="true" />
            Module map
          </button>
        </div>
      </div>

      <div id={`module-${module}-content`} className={styles.workspaceContent}>{children}</div>

      <nav className={styles.moduleRail} aria-label={`${item.shortTitle} area navigation`}>
        <span className={styles.railLabel}>Continue in {item.group}</span>
        <div className={styles.moduleLinks}>
          {neighbors.map((neighbor) => (
            <button
              className={`${styles.moduleLink} ${active === neighbor.id ? styles.moduleLinkActive : ""}`}
              type="button"
              key={neighbor.id}
              aria-current={active === neighbor.id ? "page" : undefined}
              onClick={() => navigate(neighbor.id)}
            >
              <span className={styles.moduleNumber}>{neighbor.number}</span>
              {neighbor.shortTitle}
            </button>
          ))}
          <button className={styles.moduleLink} type="button" onClick={openModules}>
            Browse all modules
          </button>
        </div>
      </nav>
    </section>
  );
}
