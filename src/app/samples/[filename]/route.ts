import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { createRequestDatabaseContext } from "@/lib/database/request";
import { getRequestActor } from "@/lib/auth/request-actor";
import { errorResponse } from "@/lib/observability/server";
import { ApplicationError } from "@/lib/observability/errors";

const samples = new Map([
  ["sql-study-guide.txt", { source: "sql-study-guide.txt", type: "text/plain" }],
  ["algorithms-practice.txt", { source: "algorithms-practice.txt", type: "text/plain" }],
  ["presentation-checklist.txt", { source: "presentation-checklist.txt", type: "text/plain" }],
  ["sql-study-guide.pdf", { source: "sql-study-guide.txt", type: "application/pdf" }],
  ["algorithms-practice.pdf", { source: "algorithms-practice.txt", type: "application/pdf" }],
  ["presentation-checklist.pdf", { source: "presentation-checklist.txt", type: "application/pdf" }],
]);
export const dynamic = "force-dynamic";

function pdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, " ");
}

function createSamplePdf(title: string, source: string) {
  const lines = source.split(/\r?\n/).flatMap((line) => line.match(/.{1,88}/g) ?? [""]).slice(0, 38);
  const commands = ["BT", "/F1 16 Tf", "50 742 Td", `(${pdfText(title)}) Tj`, "/F1 10 Tf", "0 -28 Td", ...lines.flatMap((line) => [`(${pdfText(line)}) Tj`, "0 -16 Td"]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

export async function GET(request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    const database = createRequestDatabaseContext(request);
    finalize = database.finalizeResponse;
    await getRequestActor(database.client);
    const { filename } = await context.params;
    const sample = samples.get(filename);
    if (!sample) throw new ApplicationError("validation");
    const text = await readFile(join(process.cwd(), "src/modules/resources/samples", sample.source), "utf8");
    const body = sample.type === "application/pdf" ? createSamplePdf(filename.replace(/\.pdf$/, ""), text) : text;
    return finalize(new NextResponse(body, { headers: {
      "Content-Type": sample.type === "application/pdf" ? sample.type : `${sample.type}; charset=utf-8`, "Content-Disposition": `attachment; filename="${filename}"`,
    } }));
  } catch (error) {
    const response = errorResponse(error);
    return finalize ? finalize(response) : response;
  }
}
