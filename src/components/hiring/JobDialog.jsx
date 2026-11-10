import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { createHiringJob, updateHiringJob } from '@/lib/api';

/** Create a job, or rename `job`. `onSaved(job, created)` gets the saved job. */
export default function JobDialog({ open, job = null, onOpenChange, onSaved }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setTitle(job?.title || '');
      setError(null);
    }
  }, [open, job]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const value = title.trim();
    if (!value) {
      setError('A job needs a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = job ? await updateHiringJob(job.id, { title: value }) : await createHiringJob({ title: value });
      toast.success(job ? 'Job renamed' : 'Job created');
      onOpenChange(false);
      onSaved?.(response.data, !job);
    } catch (e) {
      setError(errorMessage(e, 'The job could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-md rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{job ? 'Rename job' : 'New job'}</DialogTitle>
            <DialogDescription>
              {job ? 'Bookings and calls keep their link to the job.' : 'Next, add the questions its intake call asks.'}
            </DialogDescription>
          </DialogHeader>
          <Field label="Job title" required>
            {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
              className={CONTROL} placeholder="Backend engineer" />}
          </Field>
          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant="primary" busy={busy}>{job ? 'Save' : 'Create job'}</OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
