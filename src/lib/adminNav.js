import { Bot, Building2, ClipboardList, LayoutDashboard, PlugZap, ShieldCheck, Users, UsersRound, Wrench } from 'lucide-react';
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
  { path: '/admin/tenant-users', label: 'Tenant users', icon: UsersRound, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/integrations', label: 'CRM integrations', icon: PlugZap, perm: PERMISSIONS.TENANTS_MANAGE },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/agents', label: 'Agents', icon: Bot, perm: PERMISSIONS.ADMIN_ACCESS },
  { path: '/admin/tools', label: 'Tools', icon: Wrench, perm: PERMISSIONS.PLATFORM_TOOLS_MANAGE },
  { path: '/admin/security', label: 'Security', icon: ShieldCheck, perm: PERMISSIONS.ADMIN_ACCESS },
];

export const visibleNavItems = (user, items = ADMIN_NAV) => items.filter((item) =>
  (!item.perm || hasPermission(user, item.perm)) && !(item.tenantOnly && canUseAdmin(user)));
