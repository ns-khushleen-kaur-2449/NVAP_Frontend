import { Bot, Building2, Users, UsersRound } from 'lucide-react';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';

/** The admin area.  Each item declares the permission it needs; the sidebar and Settings show only those. */
export const ADMIN_NAV = [
  { path: '/settings/tenants', label: 'Tenants', icon: Building2, perm: PERMISSIONS.TENANTS_MANAGE },
  { path: '/settings/agents', label: 'Agent catalog', icon: Bot, perm: PERMISSIONS.AGENTS_MANAGE },
  { path: '/settings/users', label: 'Users', icon: Users, perm: PERMISSIONS.USERS_VIEW },
  { path: '/settings/teams', label: 'Teams', icon: UsersRound, perm: PERMISSIONS.TEAMS_MANAGE },
];

export const visibleNavItems = (user, items = ADMIN_NAV) => items.filter((item) => !item.perm || hasPermission(user, item.perm));
