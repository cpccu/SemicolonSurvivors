import { importPreviewSchema, type RosterRow } from "./schemas";

export const ENROLLMENT_MAX_BYTES = 32768;
export const ENROLLMENT_MAX_ROWS = 50;
export const ENROLLMENT_HEADERS = ["studentId", "email", "fullName", "department", "batch"] as const;
export type EnrollmentFormat = "csv" | "json";

export type EnrollmentIssue = {
  message: string;
  row?: number;
  field?: string;
};

export type EnrollmentParseResult =
  | { ok: true; rows: RosterRow[] }
  | { ok: false; issues: EnrollmentIssue[] };

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function boundedInput(value: string): EnrollmentIssue[] {
  return byteLength(value) > ENROLLMENT_MAX_BYTES
    ? [{ message: `Keep the source under ${ENROLLMENT_MAX_BYTES.toLocaleString()} UTF-8 bytes.` }]
    : [];
}

function readableField(field: string) {
  return field === "studentId" ? "student ID" : field === "fullName" ? "full name" : field;
}

function schemaIssues(input: unknown, rowOffset: number): EnrollmentIssue[] {
  const parsed = importPreviewSchema.safeParse(input);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const index = typeof issue.path[1] === "number" ? issue.path[1] : undefined;
    const field = typeof issue.path[2] === "string" ? issue.path[2] : undefined;
    const row = index === undefined ? undefined : index + rowOffset;
    let message = "Check this value.";
    if (issue.code === "invalid_format" && field === "email") message = "Enter a valid email address.";
    else if (issue.code === "invalid_format" && field === "studentId") message = "Use letters, numbers, or hyphens only.";
    else if (issue.code === "too_small") message = `Enter a ${readableField(field ?? "value")} (it cannot be empty).`;
    else if (issue.code === "too_big") message = `Keep ${readableField(field ?? "this value")} within its allowed length.`;
    else if (issue.code === "unrecognized_keys") message = "Remove fields that are not part of the enrollment template.";
    else if (issue.path.length === 0) message = "Use an object with a rows array containing 1–50 records.";
    return { message, ...(row === undefined ? {} : { row }), ...(field === undefined ? {} : { field }) };
  });
}

function parseCsvRecords(source: string): { records?: string[][]; issues?: EnrollmentIssue[] } {
  const text = source.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;

  const pushField = () => { record.push(field); field = ""; closedQuote = false; };
  const pushRecord = () => { pushField(); records.push(record); record = []; };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else { inQuotes = false; closedQuote = true; }
      } else field += character;
      continue;
    }
    if (closedQuote) {
      if (character === ",") pushField();
      else if (character === "\r" || character === "\n") { pushRecord(); if (character === "\r" && text[index + 1] === "\n") index += 1; }
      else return { issues: [{ message: "A quoted value must be followed by a comma or a new line." }] };
      continue;
    }
    if (character === '"') {
      if (field.length !== 0) return { issues: [{ message: "Quotes can only start a CSV value." }] };
      inQuotes = true;
    } else if (character === ",") pushField();
    else if (character === "\r" || character === "\n") { pushRecord(); if (character === "\r" && text[index + 1] === "\n") index += 1; }
    else field += character;
  }
  if (inQuotes) return { issues: [{ message: "A quoted CSV value is not closed." }] };
  if (field.length > 0 || record.length > 0) pushRecord();
  if (records.at(-1)?.length === 1 && records.at(-1)?.[0] === "") records.pop();
  return { records };
}

export function parseEnrollmentCsv(source: string): EnrollmentParseResult {
  const sizeIssue = boundedInput(source);
  if (sizeIssue.length) return { ok: false, issues: sizeIssue };
  if (source.trim().length === 0) return { ok: false, issues: [{ message: "Add CSV content before reviewing." }] };
  const parsed = parseCsvRecords(source);
  if (!parsed.records) return { ok: false, issues: parsed.issues ?? [{ message: "The CSV could not be read." }] };
  const [headers, ...data] = parsed.records;
  if (!headers || headers.length !== ENROLLMENT_HEADERS.length || headers.some((header, index) => header !== ENROLLMENT_HEADERS[index])) {
    return { ok: false, issues: [{ message: `The first row must contain exactly: ${ENROLLMENT_HEADERS.join(", ")}.` }] };
  }
  if (data.length === 0) return { ok: false, issues: [{ message: "Add at least one enrollment row below the header." }] };
  if (data.length > ENROLLMENT_MAX_ROWS) return { ok: false, issues: [{ message: "A single import can contain at most 50 rows." }] };
  const issues: EnrollmentIssue[] = [];
  const rows = data.map((cells, index) => {
    const row = index + 2;
    if (cells.length !== ENROLLMENT_HEADERS.length) {
      issues.push({ row, message: `Use exactly ${ENROLLMENT_HEADERS.length} values; this row has ${cells.length}.` });
    }
    return Object.fromEntries(ENROLLMENT_HEADERS.map((header, column) => [header, cells[column] ?? ""]));
  });
  const validated = importPreviewSchema.safeParse({ rows });
  if (!validated.success) issues.push(...schemaIssues({ rows }, 2));
  return issues.length || !validated.success ? { ok: false, issues } : { ok: true, rows: validated.data.rows };
}

export function parseEnrollmentJson(source: string): EnrollmentParseResult {
  const sizeIssue = boundedInput(source);
  if (sizeIssue.length) return { ok: false, issues: sizeIssue };
  if (source.trim().length === 0) return { ok: false, issues: [{ message: "Add JSON content before reviewing." }] };
  let value: unknown;
  try { value = JSON.parse(source.replace(/^\uFEFF/, "")) as unknown; }
  catch { return { ok: false, issues: [{ message: "Use valid JSON. The expected shape is { \"rows\": [ ... ] }." }] }; }
  const parsed = importPreviewSchema.safeParse(value);
  if (!parsed.success) return { ok: false, issues: schemaIssues(value, 1) };
  return { ok: true, rows: parsed.data.rows };
}

export function parseEnrollmentInput(source: string, format: EnrollmentFormat): EnrollmentParseResult {
  return format === "csv" ? parseEnrollmentCsv(source) : parseEnrollmentJson(source);
}

export function serializeEnrollmentPayload(rows: RosterRow[]): string {
  const body = JSON.stringify({ rows });
  if (byteLength(body) > ENROLLMENT_MAX_BYTES) throw new Error(`This import is larger than ${ENROLLMENT_MAX_BYTES.toLocaleString()} UTF-8 bytes after validation.`);
  return body;
}

export function enrollmentTemplate() {
  return `${ENROLLMENT_HEADERS.join(",")}\nSTU-001,student@example.edu,"Sample Student",Computer Science,2026\n`;
}
