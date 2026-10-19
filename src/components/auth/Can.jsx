import { useAuth } from '@/lib/AuthContext';

/**
 * Renders children only when the current user has `perm`, or one of `role` (a role or a list).
 * Hiding is for convenience only: the backend refuses anything the user may not do.
 *
 *   <Can perm={PERMISSIONS.USERS_CREATE}><Button>Add user</Button></Can>
 *   <Can role={['tenant_admin']} fallback={<p>Read only</p>}>…</Can>
 */
export default function Can({ perm, role, fallback = null, children }) {
  const { user, can } = useAuth();
  const roles = role == null ? null : Array.isArray(role) ? role : [role];
  const allowed = Boolean(user) && (perm == null || can(perm)) && (roles == null || roles.includes(user.role));
  return allowed ? children : fallback;
}
