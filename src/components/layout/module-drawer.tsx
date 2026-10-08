"use client";

import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { Dialog } from "@/components/ui/dialog";
import { campusModules } from "@/modules/campus/data/modules";
import { useCampus } from "./campus-context";
import { campusAccountPresentation } from "./account-presentation";

export function ModuleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, active, navigate } = useCampus();
  const groupHeadingId = useId();
  const account = campusAccountPresentation(session);
  const visibleModules = campusModules.filter((module) => module.group !== "Staff" || account.hasStaffAccess);
  const groups = Array.from(new Set(visibleModules.map((module) => module.group)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="One campus. A place for everything."
      description={`${CAMPUS_INSTITUTION_LABEL} campus spaces. Sample records are labeled; connected workflows check your account and assigned scope.`}
      className="module-dialog"
    >
      <div className="module-drawer-grid">
        {groups.map((group, groupIndex) => {
          const headingId = `${groupHeadingId}-${groupIndex}`;

          return (
            <section className="module-drawer-group" key={group} aria-labelledby={headingId}>
              <h3 className="module-drawer-group-heading" id={headingId}>
                <span>{group === "Staff" ? "Your workspace" : group}</span>
                <i aria-hidden="true" />
              </h3>
              <div className="module-drawer-group-list">
                {visibleModules
                  .filter((module) => module.group === group)
                  .map(({ id, title, description, icon: Icon, number }) => {
                    const isCurrent = id === active;

                    return (
                      <button
                        key={id}
                        type="button"
                        className={`module-drawer-item ${isCurrent ? "is-active" : ""}`}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => {
                          onClose();
                          navigate(id);
                        }}
                      >
                        <span className="module-drawer-icon">
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <span className="module-drawer-copy">
                          <small>
                            MODULE {number}
                            {id === "administration" ? " · SCOPED ACCESS" : ""}
                            {isCurrent && <span className="module-drawer-current"> · Current</span>}
                          </small>
                          <strong>{title}</strong>
                          <span>{description}</span>
                        </span>
                        <ArrowUpRight className="module-drawer-arrow" size={17} aria-hidden="true" />
                      </button>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
