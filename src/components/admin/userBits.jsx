import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { roleLabel } from '@/lib/rbac';

const ROLE_STYLES = {
  super_admin: 'bg-purple-500/10 text-purple-600 border-purple-500/25',
  tenant_admin: 'bg-blue-500/10 text-blue-600 border-blue-500/25',
  manager: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  rep: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
};

export function RoleBadge({ role }) {
  return <Badge variant="outline" className={`text-[11px] ${ROLE_STYLES[role] || ''}`}>{roleLabel(role)}</Badge>;
}

/** Active / Inactive, plus "Not logged in" while last_login_at is empty. */
export function StatusBadge({ user }) {
  const active = (user.status || '').toLowerCase() === 'active';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="outline" className={active
        ? 'text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
        : 'text-[11px] bg-muted text-muted-foreground'}>
        {active ? 'Active' : 'Inactive'}
      </Badge>
      {!user.last_login_at && (
        <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/25">Not logged in</Badge>
      )}
    </div>
  );
}

export function UserIdentity({ user }) {
  const initials = (user.name || user.email || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
    </div>
  );
}

/** Backend errors come as a string detail or Pydantic's list. */
export function errorText(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || String(d)).join('; ');
  return fallback;
}
