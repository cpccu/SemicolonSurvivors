import { describe, expect, it } from "vitest";
import { validateUpload } from "./upload-validation";

describe("resource upload validation", () => {
  it("accepts bounded UTF-8 plain text and returns safe preview text", () => {
    const bytes = new TextEncoder().encode("A reviewed campus note");
    expect(validateUpload(bytes, "text/plain", "note.txt")).toMatchObject({ mime: "text/plain", text: "A reviewed campus note" });
  });
  it("requires matching supported MIME, extension, and signatures", () => {
    expect(() => validateUpload(new TextEncoder().encode("%PDF-1.7\nwrong"), "application/pdf", "note.pdf")).toThrow();
    expect(() => validateUpload(new TextEncoder().encode("text"), "application/pdf", "note.pdf")).toThrow();
    expect(() => validateUpload(new TextEncoder().encode("text"), "text/plain", "note.pdf")).toThrow();
  });
  it("rejects binary controls and oversized text", () => {
    expect(() => validateUpload(new Uint8Array([65, 0, 66]), "text/plain", "note.txt")).toThrow();
    expect(() => validateUpload(new TextEncoder().encode("x".repeat(60001)), "text/plain", "note.txt")).toThrow();
  });
});
