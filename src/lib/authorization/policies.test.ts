import { describe, expect, it } from "vitest";
import type { AccessScope, AuthorizationActor, RoleAssignment } from "./models";
import {
  authorizeOwnership, authorizePrivateCaseRead, authorizeResourceRead,
  authorizeScopedOperation, isScopedOperation, type ScopedOperation,
} from "./policies";

const userId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const scopeId = "00000000-0000-4000-8000-000000000003";
const otherScopeId = "00000000-0000-4000-8000-000000000004";
const club: AccessScope = { kind: "club", id: scopeId };

function actor(overrides: Partial<AuthorizationActor> = {}): AuthorizationActor {
  return { userId, status: "active", assurance: "aal2", assignments: [], ...overrides };
}

const organizer: RoleAssignment = { role: "club_organizer", scope: club };

describe("scoped operations", () => {
  const permissions: { operation: ScopedOperation; assignment: RoleAssignment }[] = [
    { operation: "manage_event", assignment: organizer },
    { operation: "publish_notice", assignment: { role: "academic_publisher", scope: { kind: "course", id: scopeId } } },
    { operation: "manage_transport", assignment: { role: "transport_editor", scope: { kind: "route", id: scopeId } } },
    { operation: "moderate_content", assignment: { role: "moderator", scope: { kind: "institution", id: scopeId } } },
    { operation: "manage_enrollment", assignment: { role: "enrollment_admin", scope: { kind: "institution", id: scopeId } } },
    { operation: "manage_configuration", assignment: { role: "system_admin", scope: { kind: "institution", id: scopeId } } },
    { operation: "manage_role_assignments", assignment: { role: "system_admin", scope: { kind: "institution", id: scopeId } } },
  ];

  it.each(permissions)("permits an exact MFA-backed assignment for $operation", ({ operation, assignment }) => {
    expect(authorizeScopedOperation(actor({ assignments: [assignment] }), operation, assignment.scope))
      .toEqual({ allowed: true });
    expect(authorizeScopedOperation(actor({ assignments: [assignment] }), operation, {
      ...assignment.scope, id: otherScopeId,
    })).toEqual({ allowed: false, reason: "scope_denied" });
  });

  it("denies unauthenticated or unassigned actors", () => {
    expect(authorizeScopedOperation(null, "manage_event", club))
      .toEqual({ allowed: false, reason: "authentication_required" });
    expect(authorizeScopedOperation(actor(), "manage_event", club))
      .toEqual({ allowed: false, reason: "scope_denied" });
  });

  it.each(["pending", "suspended", "deactivated"] as const)("denies a %s account", (status) => {
    expect(authorizeScopedOperation(actor({ status, assignments: [organizer] }), "manage_event", club))
      .toEqual({ allowed: false, reason: "account_inactive" });
  });

  it("requires MFA for privileged operations", () => {
    expect(authorizeScopedOperation(actor({ assurance: "aal1", assignments: [organizer] }), "manage_event", club))
      .toEqual({ allowed: false, reason: "mfa_required" });
  });

  it("does not elevate system administrators to unrelated domains", () => {
    const administrator = actor({ assignments: [{ role: "system_admin", scope: { kind: "institution", id: scopeId } }] });
    expect(authorizeScopedOperation(administrator, "manage_event", club))
      .toEqual({ allowed: false, reason: "scope_denied" });
  });

  it("denies unknown and prototype property actions", () => {
    for (const operation of ["delete_everything", "constructor", "toString", "__proto__"]) {
      expect(isScopedOperation(operation)).toBe(false);
      expect(authorizeScopedOperation(actor(), operation, club))
        .toEqual({ allowed: false, reason: "unknown_action" });
    }
  });

  it("does not confuse identical IDs in different scope types", () => {
    expect(authorizeScopedOperation(actor({ assignments: [organizer] }), "manage_event", { kind: "office", id: scopeId }))
      .toEqual({ allowed: false, reason: "scope_denied" });
  });
});

describe("ownership and private cases", () => {
  const target = { ownerId: otherId, officeId: scopeId, assignedStaffIds: [userId] };
  const support = actor({ assignments: [{ role: "support_staff", scope: { kind: "office", id: scopeId } }] });

  it("allows an active owner without imposing a staff MFA requirement", () => {
    expect(authorizeOwnership(actor({ assurance: "aal1" }), userId)).toEqual({ allowed: true });
    expect(authorizePrivateCaseRead(actor({ userId: otherId, assurance: "aal1" }), target))
      .toEqual({ allowed: true });
  });

  it("denies another person's records and suspended owners", () => {
    expect(authorizeOwnership(actor(), otherId)).toEqual({ allowed: false, reason: "ownership_denied" });
    expect(authorizeOwnership(actor({ status: "suspended" }), userId))
      .toEqual({ allowed: false, reason: "account_inactive" });
  });

  it("requires a specific assignment, correct office scope, and staff MFA", () => {
    expect(authorizePrivateCaseRead(support, target)).toEqual({ allowed: true });
    expect(authorizePrivateCaseRead(support, { ...target, assignedStaffIds: [] }))
      .toEqual({ allowed: false, reason: "scope_denied" });
    expect(authorizePrivateCaseRead(support, { ...target, officeId: otherScopeId }))
      .toEqual({ allowed: false, reason: "scope_denied" });
    expect(authorizePrivateCaseRead({ ...support, assurance: "aal1" }, target))
      .toEqual({ allowed: false, reason: "mfa_required" });
  });

  it("does not allow moderators to read private support cases", () => {
    const moderator = actor({ assignments: [{ role: "moderator", scope: { kind: "institution", id: scopeId } }] });
    expect(authorizePrivateCaseRead(moderator, target)).toEqual({ allowed: false, reason: "scope_denied" });
  });
});

describe("record visibility", () => {
  it("allows intentionally public records without authentication", () => {
    expect(authorizeResourceRead(null, { visibility: "public" })).toEqual({ allowed: true });
  });

  it("requires an active account for campus records", () => {
    expect(authorizeResourceRead(actor(), { visibility: "campus" })).toEqual({ allowed: true });
    expect(authorizeResourceRead(null, { visibility: "campus" }))
      .toEqual({ allowed: false, reason: "authentication_required" });
    expect(authorizeResourceRead(actor({ status: "suspended" }), { visibility: "campus" }))
      .toEqual({ allowed: false, reason: "account_inactive" });
  });

  it("requires ownership or an explicit restricted-record allowlist", () => {
    expect(authorizeResourceRead(actor(), { visibility: "private", ownerId: userId })).toEqual({ allowed: true });
    expect(authorizeResourceRead(actor(), { visibility: "private", ownerId: otherId }))
      .toEqual({ allowed: false, reason: "visibility_denied" });
    expect(authorizeResourceRead(actor(), { visibility: "restricted" }))
      .toEqual({ allowed: false, reason: "visibility_denied" });
    expect(authorizeResourceRead(actor(), { visibility: "restricted", allowedUserIds: [userId] }))
      .toEqual({ allowed: true });
  });
});
