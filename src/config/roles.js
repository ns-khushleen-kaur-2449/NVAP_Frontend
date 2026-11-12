/**
 * NVIP roles (architecture doc §23, FR-CORE-03).
 * Every role is tenant-scoped except platform_admin. MSP admins are tenant
 * admins of a parent tenant (doc §28) — they get the extra Sub-tenants page.
 */
export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_ADMIN: 'tenant_admin',
  AGENT_USER: 'agent_user',
  REPORTING: 'reporting',
};

export const ROLE_LABELS = {
  [ROLES.PLATFORM_ADMIN]: 'Platform admin',
  [ROLES.TENANT_ADMIN]: 'Tenant admin',
  [ROLES.AGENT_USER]: 'Agent user',
  [ROLES.REPORTING]: 'Reporting (read-only)',
};

/** Where each role lands after sign-in. */
export const HOME_BY_ROLE = {
  [ROLES.PLATFORM_ADMIN]: '/app/admin/tenants',
  [ROLES.TENANT_ADMIN]: '/app/dashboard',
  [ROLES.AGENT_USER]: '/app/queue',
  [ROLES.REPORTING]: '/app/reports',
};

export const homeFor = (role) => HOME_BY_ROLE[role] || '/app/dashboard';
