import { BookOpen, BusFront, CalendarDays, CircleHelp, Compass, FileText, GraduationCap, LayoutDashboard, LifeBuoy, Search, ShieldCheck, type LucideIcon } from "lucide-react";

export type ModuleId = "today" | "directory" | "events" | "academics" | "resources" | "transport" | "helpdesk" | "lost-found" | "complaints" | "services" | "administration";
export type Destination = ModuleId | "actions";

export interface CampusModule {
  id: ModuleId;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  group: "Overview" | "Campus life" | "Academics" | "Support" | "Staff";
}

export const campusModules: CampusModule[] = [
  { id: "today", number: "02", title: "My Campus Today", shortTitle: "Today", description: "The important things, all in one place.", icon: LayoutDashboard, group: "Overview" },
  { id: "directory", number: "01", title: "Campus directory", shortTitle: "Campus directory", description: "Find your people, places, and first steps.", icon: Compass, group: "Campus life" },
  { id: "events", number: "03", title: "Clubs & events", shortTitle: "Clubs & events", description: "Meet your community. Make something happen.", icon: CalendarDays, group: "Campus life" },
  { id: "transport", number: "06", title: "Transport", shortTitle: "Transport", description: "Routes, stops, and the next scheduled bus.", icon: BusFront, group: "Campus life" },
  { id: "lost-found", number: "08", title: "Lost & found", shortTitle: "Lost & found", description: "A little help getting things back home.", icon: Search, group: "Campus life" },
  { id: "academics", number: "04", title: "Academic updates", shortTitle: "Academic updates", description: "Course changes and deadlines, clearly explained.", icon: GraduationCap, group: "Academics" },
  { id: "resources", number: "05", title: "Resource Hub", shortTitle: "Resource Hub", description: "Good material for your next big idea.", icon: BookOpen, group: "Academics" },
  { id: "helpdesk", number: "07", title: "Campus Decision Desk", shortTitle: "Decision Desk", description: "Answer, evidence, and a clear next step for approved campus questions.", icon: CircleHelp, group: "Support" },
  { id: "complaints", number: "09", title: "Support tickets", shortTitle: "Support tickets", description: "Private questions. A traceable way forward.", icon: LifeBuoy, group: "Support" },
  { id: "services", number: "10", title: "Forms & services", shortTitle: "Forms & services", description: "Find the right process before the deadline.", icon: FileText, group: "Support" },
  { id: "administration", number: "11", title: "Staff workspace", shortTitle: "Staff workspace", description: "Scoped publishing, enrollment, and review.", icon: ShieldCheck, group: "Staff" },
];

export function getModule(id: ModuleId) {
  const destination = campusModules.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown campus module: ${id}`);
  return destination;
}
