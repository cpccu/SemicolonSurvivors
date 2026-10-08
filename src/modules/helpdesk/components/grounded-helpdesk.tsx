"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, FileSearch, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { useContentSessionRevision } from "@/modules/content/use-live-query";
import { contentFetch, jsonOptions } from "@/modules/content/client";
import { aiAnswerSchema, type AiAnswer } from "@/lib/ai/grounding";
import { AiResult } from "@/modules/content/components/ai-result";

const topics = [
  { label: "Enrollment & access", question: "How do I get help with enrollment and campus account access?", icon: ClipboardCheck },
  { label: "Event registration", question: "How do I register for a campus event?", icon: CalendarDays },
  { label: "Lost & found", question: "How do I report or claim a lost item?", icon: Search },
  { label: "Resource summary", question: "Can you summarize this approved campus resource?", icon: BookOpen },
] as const;

export function GroundedHelpdesk() {
  const revision = useContentSessionRevision(); return <AnswerForm key={revision} />;
}
function AnswerForm() {
  const { navigate } = useCampus();
  const [question, setQuestion] = useState(""); const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [answer, setAnswer] = useState<AiAnswer | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setAnswer(null);
    try { setAnswer(await contentFetch("/api/helpdesk/answer", aiAnswerSchema, jsonOptions("POST", { question, consent }))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Answer unavailable. Browse articles instead."); }
    finally { setPending(false); }
  }
  return <section className="live-content ai-helpdesk" id="campus-ai" aria-label="Campus Decision Desk">
    <div className="decision-hero">
      <div className="ai-helpdesk-intro">
        <div className="ai-helpdesk-mark" aria-hidden="true"><Sparkles size={25} /></div><div className="ai-helpdesk-copy"><div className="ai-helpdesk-kicker"><span className="eyebrow">CAMPUS DECISION DESK</span><span className="ai-powered-badge"><CheckCircle2 size={13} />Grounded by evidence</span></div><h2>Answer. Evidence. Next step.</h2>
          <p>Turn an approved campus question into a clear decision path. The Desk shows the source evidence it used, then points you to the real campus module where you can continue.</p></div>
      </div>
      <div className="decision-steps" aria-label="How the Campus Decision Desk works">
        <div className="decision-step"><span>01</span><div><strong>Ask</strong><p>Name the campus decision in plain language.</p></div></div>
        <div className="decision-step"><span>02</span><div><strong>Verify</strong><p>Check approved source excerpts and review status.</p></div></div>
        <div className="decision-step"><span>03</span><div><strong>Act</strong><p>Open the right live module for the next step.</p></div></div>
      </div>
    </div>
    <div className="ai-helpdesk-trust" aria-label="Campus Decision Desk safeguards"><span><ShieldCheck size={15} />Approved sources only</span><span><FileSearch size={15} />Verified quotations</span><span><CheckCircle2 size={15} />Consent required</span></div>
    <div className="decision-topics" aria-labelledby="decision-topics-heading"><div><p className="eyebrow">START WITH A REAL CAMPUS QUESTION</p><h3 id="decision-topics-heading">Choose a topic to fill the question</h3></div><div className="decision-topic-list">{topics.map(({ label, question: topicQuestion, icon: Icon }) => <button key={label} type="button" className="decision-topic" aria-pressed={question === topicQuestion} onClick={() => setQuestion(topicQuestion)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</div></div>
    <aside className="decision-boundary" aria-labelledby="decision-boundary-heading"><div className="decision-boundary-heading"><ShieldCheck size={18} aria-hidden="true" /><h3 id="decision-boundary-heading">What this can/cannot do</h3></div><div className="decision-boundary-grid"><div><strong>Can</strong><p>Explain published campus guidance, quote approved sources, and route you to a live module.</p></div><div><strong>Cannot</strong><p>See private records, verify identity, make an institutional decision, or submit an action on your behalf.</p></div></div></aside>
    <form className="content-form" onSubmit={submit}><label>Campus question<input value={question} minLength={3} maxLength={500} required onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about an approved campus procedure" /></label>
      <p className="small-note">Do not include student IDs, emails, private complaints, personal records or document contents. AI cannot confirm private cases or make institutional decisions.</p>
      <label className="content-checkbox"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to sending this non-personal question and approved source excerpts to the configured AI provider</label>
      <button className="button button--primary" disabled={pending || !consent}>{pending ? "Checking sources…" : "Ask with sources"}</button>
    </form>{error && <p role="alert" className="content-error">{error}</p>}{answer && <AiResult answer={answer} variant="decision" />}
    <section className="decision-next-steps" aria-labelledby="decision-next-steps-heading"><div className="decision-next-steps-heading"><div><p className="eyebrow">CONTINUE IN CAMPUSOS</p><h3 id="decision-next-steps-heading">Where to act next</h3></div><span>Links open the live module; nothing is submitted from this desk.</span></div><div className="decision-route-list"><button type="button" onClick={() => navigate("events")}><CalendarDays size={17} aria-hidden="true" /><span><strong>Events</strong><small>Browse registration and event details</small></span><ArrowRight size={15} aria-hidden="true" /></button><button type="button" onClick={() => navigate("lost-found")}><Search size={17} aria-hidden="true" /><span><strong>Lost & found</strong><small>Review reports and private claim steps</small></span><ArrowRight size={15} aria-hidden="true" /></button><button type="button" onClick={() => navigate("resources")}><BookOpen size={17} aria-hidden="true" /><span><strong>Resource Hub</strong><small>Browse approved materials and summaries</small></span><ArrowRight size={15} aria-hidden="true" /></button><button type="button" onClick={() => navigate("administration")}><ClipboardCheck size={17} aria-hidden="true" /><span><strong>Administration</strong><small>Open scoped enrollment and review tools</small></span><ArrowRight size={15} aria-hidden="true" /></button><a href="/auth/enrollment"><ClipboardCheck size={17} aria-hidden="true" /><span><strong>Enrollment</strong><small>Open the enrollment workflow</small></span><ArrowRight size={15} aria-hidden="true" /></a></div></section>
  </section>;
}
