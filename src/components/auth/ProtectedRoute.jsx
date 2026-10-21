import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/** Signed-in users only; with `roles`, only those roles (others go to /403). */
export default function ProtectedRoute({ children, roles }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
