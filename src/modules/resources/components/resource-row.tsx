"use client";

import { ArrowUpRight, FileText } from "lucide-react";
import type { CampusResource } from "@/modules/campus/data/fixtures";
import { useCampus } from "@/components/layout/campus-context";

export function ResourceRow({ resource }: { resource: CampusResource }) {
  const { openDetail } = useCampus();
  return <button className="resource-row" onClick={() => openDetail({ kind: "resource", id: resource.id })}><span className={`resource-file resource-file--${resource.category.toLowerCase().replace(" ", "-")}`}><FileText size={23} /><small>PDF</small></span><span className="resource-row-copy"><span className="resource-course">{resource.course} <span>· {resource.category}</span></span><strong>{resource.title}</strong><small>{resource.publisher} · PDF guide</small></span><ArrowUpRight size={19} /></button>;
}
