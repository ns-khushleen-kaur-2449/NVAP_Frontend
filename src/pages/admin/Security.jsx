import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, MonitorSmartphone, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { RecoveryCodes } from '@/components/auth/MfaParts';
import { useAuth } from '@/lib/AuthContext';
import {
  getMfaStatus, listOwnSessions, listPlatformUsers, listUserSessions, regenerateRecoveryCodes, resetUserMfa, revokeSession,
} from '@/lib/api';

const when = (value) => (value ? new Date(value).toLocaleString() : '—');
const errorText = (e, fallback) => (typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : fallback);
// A cancelled step-up leaves the request refused: say so instead of a generic failure.
const refusedText = (e, fallback) => (e?.response?.headers?.['x-auth-required-action'] === 'step_up_required'
  ? 'Not done: the code check was cancelled or expired.' : errorText(e, fallback));

/** "Chrome on macOS"-style label from a user agent, else the raw (shortened) string. */
function device(userAgent) {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent)
    ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : null;
  const os = /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Android/.test(userAgent)
    ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Linux/.test(userAgent) ? 'Linux' : null;
  return browser && os ? `${browser} on ${os}` : userAgent.slice(0, 60);
}

function SessionList({ sessions, onRevoke, busyId }) {
  if (!sessions.length) return <p className="text-sm text-muted-foreground">No active sessions.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Sessions">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
          <MonitorSmartphone className="hidden sm:block w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {device(s.user_agent)} {s.current && <Badge variant="secondary" className="ml-1 text-[10px]">This session</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.ip_address || 'Unknown address'} · signed in {when(s.created_at)} · last active {when(s.last_seen_at)} · ends {when(s.expires_at)}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={busyId === s.id} onClick={() => onRevoke(s)}>
            {busyId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-1.5" />}
            {s.current ? 'Sign out' : 'Revoke'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * /admin/security: your two-factor status and recovery codes, your sessions, and (for other Super Admins) their
 * sessions and a two-factor reset for a lost device. Sensitive actions ask for a code first (the step-up dialog);
 * the backend enforces every rule.
 */
export default function SecurityPage() {
  const { user, logout } = useAuth();
  const [mfa, setMfa] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [opened, setOpened] = useState(null);  // { admin, sessions } another Super Admin's sessions, when shown
  const [revoking, setRevoking] = useState(null);  // another Super Admin's session awaiting a reason
  const [resetting, setResetting] = useState(null);  // a Super Admin whose MFA reset awaits a reason

  const load = useCallback(async () => {
    try {
      const [status, own, users] = await Promise.all([getMfaStatus(), listOwnSessions(), listPlatformUsers({ page_size: 100 })]);
      setMfa(status.data);
      setSessions(own.data.sessions);
      setAdmins((users.data.users || []).filter((u) => u.id !== user?.id));
      setError(null);
    } catch (e) {
      setError(errorText(e, 'Could not load security settings'));
    }
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  const regenerate = async () => {
    if (!window.confirm('Make new recovery codes? Your current ones stop working.')) return;
    setRegenerating(true);
    try {
      setCodes((await regenerateRecoveryCodes()).data.recovery_codes);
      load();
    } catch (e) {
      toast.error(refusedText(e, 'Could not make new recovery codes'));
    } finally {
      setRegenerating(false);
    }
  };

  const revokeOwn = async (session) => {
    if (session.current) {
      if (window.confirm('Sign out of this session?')) logout();
      return;
    }
    setBusyId(session.id);
    try {
      await revokeSession(session.id);
      toast.success('Session signed out');
      load();
    } catch (e) {
      toast.error(errorText(e, 'Could not sign that session out'));
    } finally {
      setBusyId(null);
    }
  };

  const openSessions = async (admin) => {
    try {
      setOpened({ admin, sessions: (await listUserSessions(admin.id)).data.sessions });
    } catch (e) {
      toast.error(errorText(e, 'Could not load sessions'));
    }
  };

  const revokeOther = async (reason) => {
    try {
      await revokeSession(revoking.id, reason);
      toast.success('Session signed out');
      if (opened) openSessions(opened.admin);
      return true;
    } catch (e) {
      toast.error(refusedText(e, 'Could not sign that session out'));
      return false;
    }
  };

  const resetMfa = async (reason) => {
    try {
      await resetUserMfa(resetting.id, reason);
      toast.success(`Two-factor authentication removed for ${resetting.name}; they set it up at their next sign-in`);
      setOpened(null);
      load();
      return true;
    } catch (e) {
      toast.error(refusedText(e, 'Could not reset two-factor authentication'));
      return false;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="admin-security-page">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Security</h1>
        <p className="text-sm text-muted-foreground mt-1">Two-factor authentication and sign-in sessions for Super Admin accounts.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <Card className="card-base p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Two-factor authentication</h2>
            {mfa ? (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  {mfa.enrolled ? `On since ${when(mfa.enrolled_at)}.` : 'Not set up.'} {mfa.enrolled
                    && `${mfa.recovery_codes_left} recovery ${mfa.recovery_codes_left === 1 ? 'code' : 'codes'} left.`}
                </p>
                {!mfa.required && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1" role="note">
                    Switched off on this server (SUPER_ADMIN_MFA_REQUIRED=false): Super Admins sign in with their password
                    only, and sensitive actions don't ask for a code.
                  </p>
                )}
              </>
            ) : <Loader2 className="w-4 h-4 animate-spin mt-2" />}
          </div>
          {mfa?.enrolled && (
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              New recovery codes
            </Button>
          )}
        </div>
        {mfa?.enrolled && mfa.recovery_codes_left <= 2 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">You're running low on recovery codes; make new ones.</p>
        )}
      </Card>

      <Card className="card-base p-5 space-y-3">
        <h2 className="font-semibold">Your sessions</h2>
        <p className="text-xs text-muted-foreground">A signed-out session stops working on its next request.</p>
        {sessions ? <SessionList sessions={sessions} onRevoke={revokeOwn} busyId={busyId} />
          : <Loader2 className="w-4 h-4 animate-spin" />}
      </Card>

      <Card className="card-base p-5 space-y-3">
        <h2 className="font-semibold">Other Super Admins</h2>
        <p className="text-xs text-muted-foreground">
          Sign out someone's session (a lost laptop), or remove their two-factor authentication when they've lost their
          phone. Both need a reason and a fresh code from you, and are recorded in the audit log. You can't reset your own.
        </p>
        {admins.length === 0 ? <p className="text-sm text-muted-foreground">No other Super Admins.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {admins.map((admin) => (
              <li key={admin.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{admin.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                </div>
                <Badge variant={admin.mfa_status === 'enrolled' ? 'secondary' : 'outline'} className="self-start sm:self-auto">
                  {admin.mfa_status === 'enrolled' ? '2FA on' : '2FA not set up'}
                </Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openSessions(admin)}>Sessions</Button>
                  <Button variant="outline" size="sm" disabled={admin.mfa_status !== 'enrolled'} onClick={() => setResetting(admin)}>
                    <ShieldOff className="w-4 h-4 mr-1.5" /> Reset 2FA
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={Boolean(codes)} onOpenChange={(open) => { if (!open) setCodes(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your new recovery codes</DialogTitle>
            <DialogDescription>Your old codes no longer work.</DialogDescription>
          </DialogHeader>
          {codes && <RecoveryCodes codes={codes} doneLabel="Done" onDone={() => setCodes(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(opened)} onOpenChange={(open) => { if (!open) setOpened(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{opened?.admin.name}'s sessions</DialogTitle>
            <DialogDescription>Revoking one needs a reason and a code from you.</DialogDescription>
          </DialogHeader>
          {opened && <SessionList sessions={opened.sessions} onRevoke={setRevoking} busyId={null} />}
        </DialogContent>
      </Dialog>

      <ReasonDialog open={Boolean(revoking)} onOpenChange={(open) => { if (!open) setRevoking(null); }}
        title="Sign out this session" description={`${opened?.admin.name || 'This Super Admin'} is signed out of it at once.`}
        confirmLabel="Sign out session" danger onConfirm={revokeOther} />
      <ReasonDialog open={Boolean(resetting)} onOpenChange={(open) => { if (!open) setResetting(null); }}
        title={`Reset two-factor authentication for ${resetting?.name || ''}`}
        description="Their authenticator and recovery codes stop working and every session is signed out. They set it up again at their next sign-in."
        confirmLabel="Reset 2FA" danger onConfirm={resetMfa} />
    </div>
  );
}
