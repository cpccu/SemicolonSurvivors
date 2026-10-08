import { eventIdSchema } from "./validation";

export const ticketQrPrefix = "campusos-ticket:v1:";
export const maximumTicketInputLength = 160;
export type ParsedTicketCode = Readonly<{ eventId: string; token: string; source: "qr" | "manual" }>;
export type TicketCodeResult = { success: true; ticket: ParsedTicketCode } | {
  success: false; code: "invalid_code" | "wrong_event"; message: string;
};

function normalizedUuid(value: string): string | null {
  const parsed = eventIdSchema.safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

export function createTicketQrPayload(eventId: string, token: string): string {
  const event = normalizedUuid(eventId);
  const opaqueToken = normalizedUuid(token);
  if (!event || !opaqueToken) throw new Error("A valid event and private ticket are required.");
  return `${ticketQrPrefix}${event}:${opaqueToken}`;
}

// Treat decoded text strictly as data; never parse or open it as a navigable URL.
export function parseTicketCode(input: unknown, expectedEventId: string): TicketCodeResult {
  const invalid: TicketCodeResult = { success: false, code: "invalid_code", message: "Enter a complete CampusOS ticket QR payload or manual ticket code." };
  const expected = normalizedUuid(expectedEventId);
  if (!expected || typeof input !== "string" || input.length > maximumTicketInputLength) return invalid;
  const value = input.trim();
  const manualToken = normalizedUuid(value);
  if (manualToken) return { success: true, ticket: { eventId: expected, token: manualToken, source: "manual" } };
  if (!value.startsWith(ticketQrPrefix)) return invalid;
  const parts = value.slice(ticketQrPrefix.length).split(":");
  if (parts.length !== 2) return invalid;
  const eventId = normalizedUuid(parts[0] ?? "");
  const token = normalizedUuid(parts[1] ?? "");
  if (!eventId || !token) return invalid;
  if (eventId !== expected) return { success: false, code: "wrong_event", message: "This QR ticket belongs to a different event. Select the correct event before checking in." };
  return { success: true, ticket: { eventId, token, source: "qr" } };
}
