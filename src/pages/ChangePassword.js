import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

const POLICY = 'At least 8 characters, with a lowercase letter, an uppercase letter, a number and a special character.';

/** Shown instead of everything else while the user still has a temporary password. */
export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      toast.success('Password changed');
    } catch (e) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="change-password-page">
      <Card className="card-base w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Set your password
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.name ? `Hi ${user.name}, you` : 'You'} signed in with a temporary password. Choose your own to continue.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Temporary password
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" required />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">New password
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1" required />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">Confirm new password
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" required />
          </label>
          <p className="text-[11px] text-muted-foreground">{POLICY}</p>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={logout}>Sign out</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
