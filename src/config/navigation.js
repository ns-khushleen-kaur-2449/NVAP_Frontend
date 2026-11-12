/**
 * Workspace sidebar per role (architecture doc §29.3–29.6).
 *
 * `path` is relative to /app. `roles` decides who sees the item AND who may
 * open the route (routes.jsx reads the same list), so nav and access never
 * drift apart. `mspOnly` items show only for an MSP parent tenant.
 */
import {
  LayoutDashboard, Bot, CalendarDays, BarChart3, Users, Plug, Settings,
  Inbox, FileText, Building2, ShieldCheck, Gauge, Receipt, ClipboardList,
} from 'lucide-react';
import { ROLES } from './roles';

const { PLATFORM_ADMIN, TENANT_ADMIN, AGENT_USER, REPORTING } = ROLES;

export const NAV_ITEMS = [
  // Tenant admin (primary role, §29.3)
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [TENANT_ADMIN] },
  { path: 'agents', label: 'My Agents', icon: Bot, roles: [TENANT_ADMIN] },
  { path: 'orders', label: 'Orders & Subscriptions', icon: CalendarDays, roles: [TENANT_ADMIN] },
  { path: 'usage', label: 'Usage & Billing', icon: BarChart3, roles: [TENANT_ADMIN] },
  { path: 'team', label: 'Team & Roles', icon: Users, roles: [TENANT_ADMIN] },
  { path: 'integrations', label: 'Integrations', icon: Plug, roles: [TENANT_ADMIN] },
  { path: 'sub-tenants', label: 'Sub-tenants', icon: Building2, roles: [TENANT_ADMIN], mspOnly: true },
  { path: 'settings', label: 'Settings', icon: Settings, roles: [TENANT_ADMIN] },

  // Tenant agent user (§29.4)
  { path: 'queue', label: 'My Queue', icon: Inbox, roles: [AGENT_USER] },
  { path: 'calls', label: 'Calls & Transcripts', icon: FileText, roles: [AGENT_USER] },
  { path: 'calendar', label: 'Calendar', icon: CalendarDays, roles: [AGENT_USER] },

  // Read-only reporting (§29.5)
  { path: 'reports', label: 'Dashboards', icon: BarChart3, roles: [REPORTING] },

  // Platform admin console (§29.6)
  { path: 'admin/tenants', label: 'Tenants', icon: Building2, roles: [PLATFORM_ADMIN] },
  { path: 'admin/catalog', label: 'Agent Catalog', icon: Bot, roles: [PLATFORM_ADMIN] },
  { path: 'admin/pricing', label: 'Pricing & Quotes', icon: Receipt, roles: [PLATFORM_ADMIN] },
  { path: 'admin/provisioning', label: 'Provisioning', icon: Gauge, roles: [PLATFORM_ADMIN] },
  { path: 'admin/audit', label: 'Audit & Compliance', icon: ShieldCheck, roles: [PLATFORM_ADMIN] },
  { path: 'admin/analytics', label: 'Platform Analytics', icon: BarChart3, roles: [PLATFORM_ADMIN] },
  { path: 'admin/incidents', label: 'Risk & Incidents', icon: ClipboardList, roles: [PLATFORM_ADMIN] },
];

export function navFor(role, { isMspParent = false } = {}) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role) && (!item.mspOnly || isMspParent));
}

export function rolesForPath(path) {
  return NAV_ITEMS.find((item) => item.path === path)?.roles ?? [];
}
