import { describe, expect, it } from "vitest";
import { createTicketQrPayload, maximumTicketInputLength, parseTicketCode, ticketQrPrefix } from "./ticket-code";

const eventId = "b088c892-8f00-45c4-b5d4-d377672a01c0";
const token = "8b3b9b8d-d32c-46ec-94c1-70492d7a0ec2";
const otherEvent = "044a6cd5-0311-43c7-a28e-aa3e9433f8fd";
const payload = `${ticketQrPrefix}${eventId}:${token}`;

describe("private ticket QR boundary", () => {
  it("round-trips only a versioned scheme, event UUID, and opaque token", () => {
    expect(createTicketQrPayload(eventId, token)).toBe(payload);
    expect(parseTicketCode(payload, eventId)).toEqual({ success: true, ticket: { eventId, token, source: "qr" } });
  });
  it("retains manual fallback without claiming it encodes an event", () => {
    expect(parseTicketCode(` ${token}\n`, eventId)).toEqual({ success: true, ticket: { eventId, token, source: "manual" } });
  });
  it("compares normalized UUIDs and tolerates outer clipboard whitespace", () => {
    expect(createTicketQrPayload(eventId.toUpperCase(), token.toUpperCase())).toBe(payload);
    expect(parseTicketCode(`\n${ticketQrPrefix}${eventId.toUpperCase()}:${token.toUpperCase()}\n`, eventId.toUpperCase()).success).toBe(true);
  });
  it("rejects a valid ticket for the wrong event before a check-in request", () => {
    expect(parseTicketCode(payload, otherEvent)).toMatchObject({ success: false, code: "wrong_event" });
  });
  it.each([
    "", null, 4, { token }, "event-1", "javascript:alert(1)", `https://evil.example/?ticket=${token}`,
    `https://campus.example/api/events/${eventId}/checkin?token=${token}`,
    `<img src=x onerror=alert(1)>`, `data:text/html,${payload}`, payload.replace("v1", "v2"),
    `${payload}:extra`, `${payload}?token=extra`, `${payload}#fragment`, `${payload}/`,
    `${ticketQrPrefix}${eventId}:${token}\u0000`, `${ticketQrPrefix}${eventId}:%${token}`,
    `${ticketQrPrefix}${eventId}:student-id`, `${ticketQrPrefix}event-1:${token}`,
    `${ticketQrPrefix}${eventId}\n:${token}`, payload.replace("campusos-ticket", "CampusOS-ticket"),
    " ".repeat(maximumTicketInputLength + 1),
  ])("rejects malformed or executable-looking input %j without treating it as navigation", (value) => {
    expect(parseTicketCode(value, eventId)).toMatchObject({ success: false, code: "invalid_code" });
  });
  it("rejects malformed selected events and invalid output inputs without echoing them", () => {
    expect(parseTicketCode(token, "event-1")).toMatchObject({ success: false, code: "invalid_code" });
    expect(() => createTicketQrPayload(eventId, "private unsafe input")).toThrow("A valid event and private ticket are required.");
  });
});
