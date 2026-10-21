import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from './OpsButton';

/** A yes/no confirmation without a reason. onConfirm may be async; it closes when that resolves truthy. */
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', danger = false,
  onConfirm, children, canConfirm = true }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      if (await onConfirm?.()) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-md rounded-[14px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2 sm:gap-2">
          <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
          <OpsButton variant={danger ? 'danger' : 'primary'} onClick={confirm} busy={busy} disabled={!canConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </OpsButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
