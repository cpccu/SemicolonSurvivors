"use client";

import { Dialog } from "@/components/ui/dialog";
import { articles, events, resources } from "@/modules/campus/data/fixtures";
import { CourseChange } from "@/modules/academics/components/course-notice";
import { EventDetail } from "@/modules/events/components/event-detail";
import { ResourceDetail } from "@/modules/resources/components/resource-detail";
import { ArticleDetail } from "@/modules/helpdesk/components/article-detail";
import type { DetailSelection } from "./campus-context";

export function DetailDialog({ selection, onClose }: { selection: DetailSelection | null; onClose: () => void }) {
  const event = selection?.kind === "event" ? events.find((item) => item.id === selection.id) : undefined;
  const resource = selection?.kind === "resource" ? resources.find((item) => item.id === selection.id) : undefined;
  const article = selection?.kind === "article" ? articles.find((item) => item.id === selection.id) : undefined;
  const title = event?.title ?? resource?.title ?? article?.title ?? "Database Systems: class correction";
  return <Dialog open={Boolean(selection)} onClose={onClose} title={title} className="detail-dialog">{event && <EventDetail event={event} />}{resource && <ResourceDetail resource={resource} />}{article && <ArticleDetail article={article} />}{selection?.kind === "notice" && <CourseChange expanded />}</Dialog>;
}
