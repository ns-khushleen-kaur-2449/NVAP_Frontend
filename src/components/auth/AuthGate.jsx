import { useLocation } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { REQUIRED_ACTIONS, useAuth } from '@/lib/AuthContext';
import ChangePasswordPage from '@/pages/ChangePassword';

/**
 * Before anything else: a user with a temporary password sees only the change-password
 * screen, and a user whose organisation is suspended sees only that notice.  The backend
 * refuses their other requests anyway (403).
 */
export default function AuthGate({ children }) {
  const { token, requiredAction, logout } = useAuth();
  const { pathname } = useLocation();
  if (!token || pathname === '/login' || !requiredAction) return children;
  if (requiredAction === REQUIRED_ACTIONS.CHANGE_PASSWORD) return <ChangePasswordPage />;
  if (requiredAction === REQUIRED_ACTIONS.TENANT_SUSPENDED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="tenant-suspended">
        <Card className="card-base max-w-md p-6 space-y-3 text-center">
          <Ban className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="font-display text-xl font-semibold">Your organisation's account is suspended</h1>
          <p className="text-sm text-muted-foreground">Contact the platform administrator to restore access.</p>
          <Button variant="outline" onClick={logout}>Sign out</Button>
        </Card>
      </div>
    );
  }
  return children;
}
