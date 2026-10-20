/**
 * Role-based access control: the single source of truth on the frontend.
 *
 * Mirrors the backend (smartsdr-platform app/core/permissions.py). When the
 * current-user endpoint (/api/auth/me) has supplied `permissions` and
 * `creatable_roles`, those are used; the maps below are the fallback and the
 * reference the tests check against. The frontend only hides things: the
 * backend enforces every rule.
 *
 * Roles (one per user). The Sales Rep role is stored as `rep`.
 *   super_admin  -> creates/manages tenant_admin, in any tenant
 *   tenant_admin -> manager, rep in their own tenant
 *   manager      -> rep in their own tenant and their own team
 *   rep          -> nobody
 * A team is a manager and the reps whose `manager_user_id` is that manager.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  MANAGER: 'manager',
  REP: 'rep',
});

export const ROLE_LABELS = Object.freeze({
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  manager: 'Manager',
  rep: 'Sales Rep',
});

export const PERMISSIONS = Object.freeze({
  TENANTS_MANAGE: 'tenants.manage',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_MANAGE: 'users.manage',
  TEAMS_VIEW: 'teams.view',
  TEAMS_MANAGE: 'teams.manage',
  DASHBOARD_PLATFORM: 'dashboard.platform',
  DASHBOARD_TENANT: 'dashboard.tenant',
  DASHBOARD_TEAM: 'dashboard.team',
  DASHBOARD_OWN: 'dashboard.own',
});

/** Who may create whom. Managing (edit, deactivate, reactivate) follows the same map, narrowed by scope. */
export const CAN_CREATE = Object.freeze({
  super_admin: Object.freeze(['tenant_admin']),
  tenant_admin: Object.freeze(['manager', 'rep']),
  manager: Object.freeze(['rep']),
  rep: Object.freeze([]),
});

const P = PERMISSIONS;
export const ROLE_PERMISSIONS = Object.freeze({
  super_admin: Object.freeze([P.TENANTS_MANAGE, P.USERS_VIEW, P.USERS_CREATE, P.USERS_MANAGE, P.DASHBOARD_PLATFORM]),
  tenant_admin: Object.freeze([P.USERS_VIEW, P.USERS_CREATE, P.USERS_MANAGE, P.TEAMS_VIEW, P.TEAMS_MANAGE, P.DASHBOARD_TENANT]),
  manager: Object.freeze([P.USERS_VIEW, P.USERS_CREATE, P.USERS_MANAGE, P.TEAMS_VIEW, P.DASHBOARD_TEAM]),
  rep: Object.freeze([P.DASHBOARD_OWN]),
});

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** The permissions of `actor`: from the server when known, else from the role. */
export function permissionsOf(actor) {
  if (!actor) return [];
  if (Array.isArray(actor.permissions)) return actor.permissions;
  return ROLE_PERMISSIONS[actor.role] || [];
}

export function hasPermission(actor, permission) {
  return permissionsOf(actor).includes(permission);
}

// Who may view assistants: the backend's AssistantAction.VIEW (Manager and up).
// /api/v1/assistants and the Voice Agent dashboard both follow it; a Sales Rep
// gets 403 from the dashboard, so its nav entry is hidden.
export const ASSISTANT_VIEWER_ROLES = Object.freeze(['super_admin', 'tenant_admin', 'manager']);

export function canViewAssistants(actor) {
  return Boolean(actor) && ASSISTANT_VIEWER_ROLES.includes(actor.role);
}

/** The roles `actor` may create, highest first. */
export function creatableRoles(actor) {
  if (!actor) return [];
  if (Array.isArray(actor.creatable_roles)) return actor.creatable_roles;
  return [...(CAN_CREATE[actor.role] || [])];
}

export function canCreate(actor, targetRole) {
  return creatableRoles(actor).includes(targetRole);
}

/**
 * Whether `actor` may edit, deactivate or reactivate `target`. Both need `id`, `role`,
 * `tenant_id` and `manager_user_id`. Nobody manages themselves.
 */
export function canManageUser(actor, target) {
  if (!actor || !target || sameId(actor.id, target.id)) return false;
  if (!(CAN_CREATE[actor.role] || []).includes(target.role)) return false;
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (!sameId(actor.tenant_id, target.tenant_id)) return false;
  if (actor.role === ROLES.MANAGER) return sameId(target.manager_user_id, actor.id);
  return actor.role === ROLES.TENANT_ADMIN;
}

export const roleLabel = (role) => ROLE_LABELS[role] || role;
