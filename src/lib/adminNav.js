import { Activity, BarChart3, Bot, Boxes, Building2, ClipboardList, LayoutDashboard, Network, OctagonPause, PlugZap, ShieldCheck, Users, UsersRound, Wrench } from 'lucide-react';
import { PERMISSIONS, canUseAdmin, hasPermission } from '@/lib/rbac';

/**
 * Tenant administration, listed in Settings → General → Administration. Each item declares the permission it
 * needs. A Super Admin manages tenants and their users in the platform area (PLATFORM_NAV), not here.
 */
export const ADMIN_NAV = [
  { path: '/settings/users', label: 'Users', icon: Users, perm: PERMISSIONS.USERS_VIEW, tenantOnly: true },
  { path: '/settings/teams', label: 'Teams', icon: UsersRound, perm: PERMISSIONS.TEAMS_MANAGE },
];

/** The platform control area (/admin, Super Admin only): its own sidebar, not tenant settings. */
export const PLATFORM_NAV = [
  { path: '/admin/overview', label: 'Overview', icon: LayoutDashboard, perm: PERMISSIONS.PLATFORM_OVERVIEW_VIEW },
  { path: '/admin/tenants', label: 'Tenants', icon: Building2, perm: PERMISSIONS.TENANTS_MANAGE },
  { path: '/admin/users', label: 'Platform users', icon: Users, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/tenant-users', label: 'Tenant admins', icon: UsersRound, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/hierarchy', label: 'User hierarchy', icon: Network, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/integrations', label: 'CRM integrations', icon: PlugZap, perm: PERMISSIONS.TENANTS_MANAGE },
  { path: '/admin/operations', label: 'Operations', icon: Activity, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/usage', label: 'Usage', icon: BarChart3, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/controls', label: 'Controls', icon: OctagonPause, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/agents', label: 'Agents', icon: Bot, perm: PERMISSIONS.ADMIN_ACCESS },
  // The shared agent catalog (SDR, Hiring, ...): which agents exist and which tenants may use them (/api/v1/agents).
  { path: '/admin/agent-catalog', label: 'Agent catalog', icon: Boxes, perm: PERMISSIONS.AGENTS_MANAGE },
  { path: '/admin/tools', label: 'Tools', icon: Wrench, perm: PERMISSIONS.PLATFORM_TOOLS_MANAGE },
  { path: '/admin/security', label: 'Security', icon: ShieldCheck, perm: PERMISSIONS.ADMIN_ACCESS },
];

export const visibleNavItems = (user, items = ADMIN_NAV) => items.filter((item) =>
  (!item.perm || hasPermission(user, item.perm)) && !(item.tenantOnly && canUseAdmin(user)));
