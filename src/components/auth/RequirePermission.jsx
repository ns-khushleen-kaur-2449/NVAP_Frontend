import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Route guard: not logged in -> /login; logged in without `perm` (or outside `role`) -> /403.
 */
export default function RequirePermission({ perm, role, children }) {
  const { user, token, loading, can } = useAuth();
  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!user && !token) return <Navigate to="/login" replace />;
  const roles = role == null ? null : Array.isArray(role) ? role : [role];
  const allowed = Boolean(user) && (perm == null || can(perm)) && (roles == null || roles.includes(user.role));
  return allowed ? children : <Navigate to="/403" replace />;
}
