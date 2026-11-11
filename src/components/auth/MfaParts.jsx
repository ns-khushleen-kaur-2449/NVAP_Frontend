import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** A 6-digit authenticator code field (digits only; the phone's one-time-code autofill works). */
export function CodeInput({ value, onChange, id, autoFocus = true, disabled = false, label = 'Authentication code' }) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="123456"
      aria-label={label}
      autoFocus={autoFocus}
      disabled={disabled}
      className="h-11 text-center text-lg tracking-[0.4em] font-mono"
    />
  );
}

/** The error to show for a failed code or sign-in request: lockout and expiry get their own words. */
export function codeError(error, fallback = "That code didn't work. Try again.") {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (status === 429) return 'Too many attempts. Wait a few minutes, then try again.';
  if (status === 401 && detail === 'Sign in again') return 'This sign-in expired. Start again with your password.';
  if (typeof detail === 'string') return detail;
  return fallback;
}

/** Recovery codes, shown once: copy or download them, then confirm they're saved. */
export function RecoveryCodes({ codes, onDone, doneLabel = "I've saved these codes" }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch { /* clipboard unavailable: the codes are on screen */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`SmartSDR recovery codes\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartsdr-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3" data-testid="recovery-codes">
      <p className="text-sm text-muted-foreground">
        Each code signs you in once if you lose your phone. They won't be shown again; store them somewhere safe.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted p-3 font-mono text-sm" aria-label="Recovery codes">
        {codes.map((code) => <li key={code} className="text-center">{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? 'Copied' : 'Copy'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="w-4 h-4 mr-1.5" /> Download
        </Button>
      </div>
      {onDone && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I've stored these codes somewhere safe
          </label>
          <Button type="button" className="w-full" disabled={!saved} onClick={onDone}>{doneLabel}</Button>
        </>
      )}
    </div>
  );
}
