import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CodeInput, RecoveryCodes, codeError } from '@/components/auth/MfaParts';
import { useAuth } from '@/lib/AuthContext';
import { startMfaEnrollment } from '@/lib/api';

/**
 * Two-factor setup for a Super Admin (shown by AuthGate until it's done). The server keeps this session to setup
 * only: scan the QR code (or type the key), confirm with a code, save the recovery codes.
 */
export default function MfaSetupPage() {
  const { completeMfaEnrollment, refreshMe, logout } = useAuth();
  const [setup, setSetup] = useState(null);  // { secret, qr_svg, issuer }
  const [loadError, setLoadError] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState(null);

  useEffect(() => {
    startMfaEnrollment()
      .then((r) => setSetup(r.data))
      .catch((e) => setLoadError(codeError(e, 'Two-factor setup could not start. Try again.')));
  }, []);

  const verify = async (event) => {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await completeMfaEnrollment(code);
      setCodes(result.recovery_codes);
    } catch (e) {
      setError(codeError(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10" data-testid="mfa-setup">
      <Card className="card-base w-full max-w-md p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> {codes ? 'Save your recovery codes' : 'Set up two-factor authentication'}
          </h1>
          {!codes && (
            <p className="text-sm text-muted-foreground">
              Super Admin accounts need an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
            </p>
          )}
        </div>

        {codes ? (
          <RecoveryCodes codes={codes} doneLabel="Continue to the console" onDone={() => refreshMe()} />
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-600">{loadError}</p>
        ) : !setup ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <ol className="space-y-4 text-sm">
              <li className="space-y-2">
                <p><span className="font-medium">1.</span> Scan this code with your authenticator app.</p>
                {/* An <img>, not inline markup: the SVG can't run anything. */}
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qr_svg)}`} alt="QR code for your authenticator app"
                  className="mx-auto w-48 h-48 rounded-lg border border-border bg-white p-1" />
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Can't scan it? Enter this key instead</summary>
                  <code className="mt-2 block break-all rounded bg-muted px-2 py-1.5 text-sm text-foreground select-all"
                    data-testid="mfa-setup-key">{setup.secret.match(/.{1,4}/g).join(' ')}</code>
                  <span className="mt-1 block">Account: {setup.issuer}; time-based, 6 digits.</span>
                </details>
              </li>
              <li className="space-y-2">
                <label htmlFor="mfa-setup-code"><span className="font-medium">2.</span> Enter the 6-digit code it shows.</label>
                <CodeInput id="mfa-setup-code" value={code} onChange={setCode} disabled={busy} />
              </li>
            </ol>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Verify and turn on
            </Button>
          </form>
        )}
        {!codes && <Button variant="ghost" size="sm" className="w-full" onClick={logout}>Sign out</Button>}
      </Card>
    </div>
  );
}
