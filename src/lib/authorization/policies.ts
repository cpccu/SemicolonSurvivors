import type {
  AccessScope, AuthorizationActor, AuthorizationRole, PolicyDecision,
} from "./models";

export type ScopedOperation =
  | "manage_event" | "publish_notice" | "manage_transport" | "moderate_content"
  | "manage_enrollment" | "manage_configuration" | "manage_role_assignments";

const operationRequirements: Record<ScopedOperation, {
  role: AuthorizationRole;
  scopeKinds: readonly AccessScope["kind"][];
}> = {
  manage_event: { role: "club_organizer", scopeKinds: ["club"] },
  publish_notice: { role: "academic_publisher", scopeKinds: ["department", "course", "section"] },
  manage_transport: { role: "transport_editor", scopeKinds: ["route"] },
  moderate_content: { role: "moderator", scopeKinds: ["institution"] },
  manage_enrollment: { role: "enrollment_admin", scopeKinds: ["institution"] },
  manage_configuration: { role: "system_admin", scopeKinds: ["institution"] },
  manage_role_assignments: { role: "system_admin", scopeKinds: ["institution"] },
};

function activeAccount(actor: AuthorizationActor | null): PolicyDecision {
  if (!actor) return { allowed: false, reason: "authentication_required" };
  if (actor.status !== "active") return { allowed: false, reason: "account_inactive" };
  return { allowed: true };
}

function matchesScope(left: AccessScope, right: AccessScope): boolean {
  return left.kind === right.kind && left.id === right.id;
}

export function isScopedOperation(operation: string): operation is ScopedOperation {
  return Object.hasOwn(operationRequirements, operation);
}

export function authorizeScopedOperation(
  actor: AuthorizationActor | null,
  operation: string,
  scope: AccessScope,
): PolicyDecision {
  const account = activeAccount(actor);
  if (!account.allowed || !actor) return account;
  if (!isScopedOperation(operation)) return { allowed: false, reason: "unknown_action" };
  const requirement = operationRequirements[operation];
  if (actor.assurance !== "aal2") return { allowed: false, reason: "mfa_required" };

  // An institution assignment never implies authority over every domain or child scope.
  const assigned = requirement.scopeKinds.includes(scope.kind) && actor.assignments.some(
    (assignment) => assignment.role === requirement.role && matchesScope(assignment.scope, scope),
  );
  return assigned ? { allowed: true } : { allowed: false, reason: "scope_denied" };
}

export function authorizeOwnership(
  actor: AuthorizationActor | null,
  ownerId: string,
): PolicyDecision {
  const account = activeAccount(actor);
  if (!account.allowed || !actor) return account;
  return actor.userId === ownerId
    ? { allowed: true }
    : { allowed: false, reason: "ownership_denied" };
}

export type PrivateCaseAccess = {
  ownerId: string;
  officeId: string;
  assignedStaffIds: readonly string[];
};

export function authorizePrivateCaseRead(
  actor: AuthorizationActor | null,
  target: PrivateCaseAccess,
): PolicyDecision {
  const account = activeAccount(actor);
  if (!account.allowed || !actor) return account;
  if (actor.userId === target.ownerId) return { allowed: true };
  const assigned = target.assignedStaffIds.includes(actor.userId) && actor.assignments.some(
    (assignment) => assignment.role === "support_staff"
      && matchesScope(assignment.scope, { kind: "office", id: target.officeId }),
  );
  if (!assigned) return { allowed: false, reason: "scope_denied" };
  return actor.assurance === "aal2"
    ? { allowed: true }
    : { allowed: false, reason: "mfa_required" };
}

export type ResourceVisibility = {
  visibility: "public" | "campus" | "private" | "restricted";
  ownerId?: string;
  allowedUserIds?: readonly string[];
};

export function authorizeResourceRead(
  actor: AuthorizationActor | null,
  resource: ResourceVisibility,
): PolicyDecision {
  if (resource.visibility === "public") return { allowed: true };
  const account = activeAccount(actor);
  if (!account.allowed || !actor) return account;
  if (resource.visibility === "campus") return { allowed: true };
  if (resource.visibility === "private" && resource.ownerId === actor.userId) return { allowed: true };
  if (resource.visibility === "restricted" && resource.allowedUserIds?.includes(actor.userId)) {
    return { allowed: true };
  }
  return { allowed: false, reason: "visibility_denied" };
}
