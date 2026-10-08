import { describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { ApplicationError } from "@/lib/observability/errors";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database/request", () => ({
  createRequestDatabaseContext: () => ({
    client: {},
    finalizeResponse(response: NextResponse) {
      response.cookies.set("synthetic-session", "cleared", { path: "/", maxAge: 0 });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    },
  }),
}));
import { identityRoute } from "./http";

describe("auth response finalization", () => {
  it("preserves cookie clearing and private caching when a later policy check fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await identityRoute(new NextRequest("https://campus.example.invalid/api/auth/example"), async () => {
      throw new ApplicationError("authorization", { cause: new Error("private SQL/token detail") });
    });
    expect(response.status).toBe(403);
    expect(response.cookies.get("synthetic-session")?.value).toBe("cleared");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ error: { code: "authorization", message: "This action is not available to your account." } });
    expect(JSON.stringify(body)).not.toContain("private SQL/token detail");
  });
});
