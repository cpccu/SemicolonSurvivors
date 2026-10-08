"use client";

import { useCampus } from "@/components/layout/campus-context";
import { AcademicsScreen } from "@/modules/academics/components/academics-screen";
import { AdministrationScreen } from "@/modules/administration/components/administration-screen";
import { ComplaintsScreen } from "@/modules/complaints/components/complaints-screen";
import { ActionsScreen } from "@/modules/dashboard/components/actions-screen";
import { DirectoryScreen } from "@/modules/directory/components/directory-screen";
import { EventsScreen } from "@/modules/events/components/events-screen";
import { HelpdeskScreen } from "@/modules/helpdesk/components/helpdesk-screen";
import { LostFoundScreen } from "@/modules/lost-found/components/lost-found-screen";
import { ResourcesScreen } from "@/modules/resources/components/resources-screen";
import { ServicesScreen } from "@/modules/services/components/services-screen";
import { TransportScreen } from "@/modules/transport/components/transport-screen";
import { ModuleWorkspace } from "./module-workspace";

export function ModuleScreen() {
  const { active } = useCampus();
  // Keep module-local filters mounted while switching modules.
  return <>
    <div className="module-screen-frame" hidden={active !== "directory"}><ModuleWorkspace module="directory"><DirectoryScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "events"}><ModuleWorkspace module="events"><EventsScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "academics"}><ModuleWorkspace module="academics"><AcademicsScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "resources"}><ModuleWorkspace module="resources"><ResourcesScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "transport"}><ModuleWorkspace module="transport"><TransportScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "helpdesk"}><ModuleWorkspace module="helpdesk"><HelpdeskScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "lost-found"}><ModuleWorkspace module="lost-found"><LostFoundScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "complaints"}><ModuleWorkspace module="complaints"><ComplaintsScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "services"}><ModuleWorkspace module="services"><ServicesScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "administration"}><ModuleWorkspace module="administration"><AdministrationScreen /></ModuleWorkspace></div>
    <div className="module-screen-frame" hidden={active !== "actions"}><ModuleWorkspace module="actions"><ActionsScreen /></ModuleWorkspace></div>
  </>;
}
