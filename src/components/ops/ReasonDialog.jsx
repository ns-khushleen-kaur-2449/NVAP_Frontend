import { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from './OpsButton';

/**
 * Confirm a change that needs a reason (every manual override). The reason is required
 * (whitespace does not count); `changes` lists what will happen, so the person sees it
 * before confirming. `children` adds fields (a date, a corrected number); `canConfirm`
 * gates them. Radix traps focus inside and closes on Esc.
 *
 * onConfirm(reason) may be async; the dialog closes when it resolves to something truthy.
 */
export default function ReasonDialog({
  open, onOpenChange, title, description, changes = [], confirmLabel = 'Confirm', danger = false,
  onConfirm, children, canConfirm = true, requireReason = true, reasonLabel = 'Reason',
  reasonPlaceholder = 'Why are you doing this? It is kept in the history.',
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldId = useId();

  useEffect(() => { if (open) setReason(''); }, [open]);

  const missing = requireReason && !reason.trim();
  const submit = async (event) => {
    event.preventDefault();
    if (missing || !canConfirm || busy) return;
    setBusy(true);
    try {
      const done = await onConfirm?.(reason.trim());
      if (done) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-md rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {changes.length > 0 && (
            <div className="rounded-lg border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What will change</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            </div>
          )}
          {children}
          <div className="space-y-1.5">
            <label htmlFor={fieldId} className="text-sm font-medium">
              {reasonLabel}{requireReason && <span aria-hidden="true"> *</span>}
            </label>
            <textarea id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              required={requireReason} aria-required={requireReason} placeholder={reasonPlaceholder} maxLength={1000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2" />
            {missing && <p className="text-xs text-muted-foreground">A reason is required.</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant={danger ? 'danger' : 'primary'} busy={busy} disabled={missing || !canConfirm}>
              {busy ? 'Working…' : confirmLabel}
            </OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
