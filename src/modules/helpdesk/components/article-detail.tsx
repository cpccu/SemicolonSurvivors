import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { KnowledgeArticle } from "@/modules/campus/data/fixtures";

export function ArticleDetail({ article }: { article: KnowledgeArticle }) {
  return <div className="article-detail"><div className="detail-badges"><Badge tone="warm">Demo knowledge article</Badge><Badge>{article.category}</Badge></div><p className="detail-intro">{article.excerpt}</p><ol className="numbered-steps">{article.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol><div className="detail-source"><strong><BookOpen size={17} />Source & review</strong><p>Original CampusOS demonstration article · fixture review date: 7 October 2026. This is product guidance, not an approved university policy. No AI answer or official source is fabricated.</p></div></div>;
}
