"use client";

import { Bookmark, Download, FileText } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { Badge } from "@/components/ui/primitives";
import type { CampusResource } from "@/modules/campus/data/fixtures";

export function ResourceDetail({ resource }: { resource: CampusResource }) {
  const { saved, toggleSaved } = useCampus();
  const isSaved = saved.includes(resource.id);
  return (
    <div className="resource-detail">
      <div className="resource-detail-header">
         <span className="resource-file"><FileText size={30} /><small>PDF</small></span>
        <div>
           <div className="detail-badges"><Badge tone="warm">Course material</Badge><Badge tone="blue">{resource.course}</Badge></div>
           <p>{resource.category} · PDF · English</p>
        </div>
      </div>
      <p className="detail-intro">{resource.description}</p>
      <div className="detail-actions">
         <a className="button button--primary" href={resource.file} download><Download size={17} />Download PDF</a>
        <button className={`button button--secondary ${isSaved ? "is-saved" : ""}`} onClick={() => toggleSaved(resource.id)} aria-pressed={isSaved}>
          <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />{isSaved ? "Saved in preview" : "Save for preview"}
        </button>
      </div>
      <section className="document-preview" aria-label="Sample resource preview">
        <div className="document-preview-label"><FileText size={16} />A look inside<span>Original excerpt</span></div>
        <h3>{resource.title}</h3>
        {resource.preview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
         <p className="document-disclaimer">City University demo workspace material · PDF preview.</p>
      </section>
      <div className="detail-source">
        <strong>Source & access</strong>
         <p>{resource.publisher} · PDF available to active campus accounts. Connected resources use authorized private storage, publisher review, and version control.</p>
        <p>Saved items are session-only and do not persist after a refresh.</p>
      </div>
    </div>
  );
}
