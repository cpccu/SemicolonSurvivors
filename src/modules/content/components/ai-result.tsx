"use client";
import { FileSearch, ShieldCheck } from "lucide-react";
import type { AiAnswer } from "@/lib/ai/grounding";

const messages = {
  ready: "Source-verified excerpts. Read the original guidance for the full context.",
  disabled: "AI is disabled pending rollout, privacy and quota checks. Browse approved sources below.",
  unavailable: "AI is temporarily unavailable. Approved sources remain available.",
  unsupported: "The approved sources do not support an answer. No institutional guidance has been invented.",
  quota: "The AI request budget is exhausted. Browse approved sources or try later.",
};
export function AiResult({ answer, variant = "default" }: { answer: AiAnswer; variant?: "default" | "decision" }) {
  const decision = variant === "decision";
  const evidenceSupported = answer.available && answer.reason === "ready" && answer.statements.length > 0;
  return <section className={`content-ai-result${decision ? " decision-answer" : ""}`} aria-label={decision ? "Campus decision answer" : "Grounded answer"}>{decision && <><div className="decision-answer-heading"><div><p className="eyebrow">DECISION READOUT</p><h3>Evidence-backed answer</h3></div><div className="decision-confidence"><ShieldCheck size={17} aria-hidden="true" /><span>Confidence</span><strong>{evidenceSupported ? "Evidence-supported" : "Not established"}</strong></div></div><div className="decision-evidence"><FileSearch size={17} aria-hidden="true" /><span>Source evidence</span><strong>{answer.sources.length} approved {answer.sources.length === 1 ? "source" : "sources"}</strong><span>{answer.statements.length ? `${answer.statements.length} quoted ${answer.statements.length === 1 ? "finding" : "findings"}` : "No verified finding"}</span></div></>}<p role="status">{messages[answer.reason]}</p>
    {answer.statements.map((statement, index) => {
      const source = answer.sources.find((candidate) => candidate.id === statement.sourceId);
      return <article key={`${statement.sourceId}-${index}`}><p className="content-body">{statement.text}</p><blockquote>{statement.quote}</blockquote>
        {source && <a href={source.url}>{source.title} · Revision {source.version}</a>}</article>;
    })}
    {!answer.statements.length && answer.sources.map((source) => <p key={source.id}><a href={source.url}>{source.title} · Revision {source.version}</a></p>)}
  </section>;
}
