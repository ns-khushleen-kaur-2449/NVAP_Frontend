import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canUseAdmin } from '@/lib/rbac';

/**
 * Route guard for the platform control area (/admin): not logged in -> /login; logged in without
 * `admin.access` (anyone but a Super Admin) -> /403. Navigation only: every /api/admin request is
 * checked by the backend's require_super_admin.
 */
export default function SuperAdminRoute({ children }) {
  const { user, token, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }
  if (!user && !token) return <Navigate to="/login" replace />;
  return canUseAdmin(user) ? children : <Navigate to="/403" replace />;
}

/** A tenant page whose Super Admin version moved to the platform area: a Super Admin goes to `to`, others stay. */
export function SuperAdminGoesTo({ to, children }) {
  const { user } = useAuth();
  return canUseAdmin(user) ? <Navigate to={to} replace /> : children;
}
