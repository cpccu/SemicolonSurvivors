import { ArrowRight, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warm" | "blue" | "green" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action && onAction && <button className="text-button" onClick={onAction}>{action}<ArrowRight size={16} /></button>}</div>;
}

export function IntegrationNote({ title = "A connected campus makes this possible.", children }: { title?: string; children: ReactNode }) {
  return <div className="integration-note"><CircleAlert size={19} aria-hidden="true" /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function EmptyState({ icon: Icon, title, children, action, onAction }: { icon: LucideIcon; title: string; children: ReactNode; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon size={26} /></span><h3>{title}</h3><p>{children}</p>{action && onAction && <button className="button button--secondary" onClick={onAction}>{action}<ArrowRight size={16} /></button>}</div>;
}
