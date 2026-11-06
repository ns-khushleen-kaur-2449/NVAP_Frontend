import { Navigate, useLocation } from 'react-router-dom';
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

/**
 * A Super Admin works only in the platform area: any tenant page sends them to /admin/overview. Navigation only; the
 * backend refuses every tenant route for them.
 */
export function SuperAdminBoundary({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const allowed = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/login' || pathname === '/403';
  return canUseAdmin(user) && !allowed ? <Navigate to="/admin/overview" replace /> : children;
}

/** A tenant page whose Super Admin version moved to the platform area: a Super Admin goes to `to`, others stay. */
export function SuperAdminGoesTo({ to, children }) {
  const { user } = useAuth();
  return canUseAdmin(user) ? <Navigate to={to} replace /> : children;
}
