import { MAX_UPLOAD_BYTES } from "./models";

export type ValidatedUpload = { mime: "text/plain" | "application/pdf"; bytes: Uint8Array; text: string | null };
export function validateUpload(bytes: Uint8Array, declaredMime: string, filename: string): ValidatedUpload {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error("Use a file between 1 byte and 3 MB.");
  if (declaredMime === "application/pdf" && /\.pdf$/i.test(filename)) {
    const header = new TextDecoder().decode(bytes.slice(0, 16));
    const tail = new TextDecoder().decode(bytes.slice(-1024));
    if (!/^%PDF-(1\.[0-7]|2\.0)(?:\r|\n|\s)/.test(header) || !/%%EOF\s*$/.test(tail)) throw new Error("This file does not have a supported PDF signature.");
    return { mime: "application/pdf", bytes, text: null };
  }
  if (declaredMime !== "text/plain" || !/\.txt$/i.test(filename)) throw new Error("Only TXT and PDF files with matching types are supported.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("Text files must use UTF-8 encoding."); }
  // A bounded, complete text preview is the only supported AI document context.
  if (text.length > 60000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text) || /^%PDF-|^PK\u0003\u0004/.test(text)) {
    throw new Error("TXT files must contain at most 60,000 characters of plain text.");
  }
  return { mime: "text/plain", bytes, text };
}
