import { useCallback, useEffect, useState } from 'react';
import { PhoneForwarded } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { canCreateCampaigns } from '@/lib/rbac';
import { getCallCallbackFollowUp, scheduleVoiceCall } from '@/lib/api';

/** "In an hour", as the value of a datetime-local input (the viewer's own clock). */
function inAnHour() {
  const at = new Date(Date.now() + 60 * 60 * 1000);
  at.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function errorText(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return detail?.message || 'The callback could not be scheduled. Try again.';
}

/**
 * The lead asked for a callback on this call, but nothing scheduled one
 * (GET /api/call-logs/{id}/callback-follow-up).  Shows a notice and, for people who may
 * schedule calls, a "Schedule callback" button (POST /api/voice/schedule).  Shows nothing
 * otherwise.
 */
export default function CallbackFollowUp({ callId, assistantId }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(inAnHour);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!callId) return;
    Promise.resolve().then(() => getCallCallbackFollowUp(callId)).then((r) => setState(r?.data ?? null)).catch(() => setState(null));
  }, [callId]);
  useEffect(() => { load(); }, [load]);

  if (!state?.unscheduled) return null;
  const canSchedule = canCreateCampaigns(user) && Boolean(state.prospect_id) && Boolean(assistantId);

  const submit = async () => {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) { setError('Pick a date and time.'); return; }
    if (at.getTime() <= Date.now()) { setError('Pick a time in the future.'); return; }
    setSaving(true);
    setError(null);
    try {
      await scheduleVoiceCall({
        prospect_id: state.prospect_id, assistant_id: assistantId, scheduled_at: at.toISOString(),
        notes: note.trim() || 'Callback the lead asked for on a call',
      });
      toast.success('Callback scheduled');
      setOpen(false);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <PhoneForwarded className="h-4 w-4 shrink-0 text-amber-600" />
        The lead asked for a callback on this call, but none was scheduled.
      </p>
      {canSchedule && (
        <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>Schedule callback</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule callback</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">When</span>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Note (optional)</span>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </label>
            <p className="text-xs text-muted-foreground">The same agent calls the lead, within your calling hours.</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Scheduling…' : 'Schedule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
