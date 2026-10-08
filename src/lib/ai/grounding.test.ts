import { describe, expect, it } from "vitest";
import { fallbackAnswer, verifyAnswer, type AiSource } from "./grounding";

const source: AiSource = { id: "00000000-0000-4000-8000-000000000001", version: 2, title: "Approved guide", text: "Submit the signed form at the reviewed office before Friday.", url: "/helpdesk?article=1" };
describe("grounded AI response validation", () => {
  it("accepts only exact quotations from retrieved sources", () => {
    expect(verifyAnswer({ supported: true, statements: [{ text: "The form is submitted at the reviewed office.", sourceId: source.id, quote: "Submit the signed form at the reviewed office" }] }, [source]).statements).toHaveLength(1);
    expect(() => verifyAnswer({ supported: true, statements: [{ text: "Use the form.", sourceId: source.id, quote: "Invented evidence that is not in the source" }] }, [source])).toThrow();
  });
  it("returns a useful source fallback without claiming an AI answer", () => {
    expect(fallbackAnswer("disabled", [source])).toMatchObject({ available: false, reason: "disabled", statements: [], sources: [{ id: source.id, version: 2 }] });
  });
});
