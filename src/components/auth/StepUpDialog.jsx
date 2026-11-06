import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeInput, codeError } from '@/components/auth/MfaParts';
import { verifyStepUp } from '@/lib/api';
import { setStepUpHandler } from '@/lib/stepUp';

/**
 * The one step-up dialog (mounted once in App). When the server refuses a high-risk action with
 * `step_up_required`, api.js opens it; a correct code verifies this session for a few minutes and the action is
 * retried. Cancelling leaves the action refused.
 */
export default function StepUpDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(null);  // resolve() of the request waiting for this dialog

  const finish = useCallback((verified) => {
    pending.current?.(verified);
    pending.current = null;
    setOpen(false);
    setCode('');
    setError(null);
  }, []);

  useEffect(() => setStepUpHandler(() => new Promise((resolve) => {
    // A second refusal while the dialog is open waits for the same answer.
    const previous = pending.current;
    pending.current = (verified) => { previous?.(verified); resolve(verified); };
    setOpen(true);
  })), []);

  const submit = async (event) => {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyStepUp(code);
      finish(true);
    } catch (e) {
      setError(codeError(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) finish(false); }}>
      <DialogContent className="max-w-sm" data-testid="step-up-dialog">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Confirm it's you</DialogTitle>
            <DialogDescription>
              This action needs a fresh check. Enter the code from your authenticator app; it covers sensitive actions
              for the next 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <CodeInput id="step-up-code" value={code} onChange={setCode} disabled={busy} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Verify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
