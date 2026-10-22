import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAssistants, getScheduledCalls, scheduledCallAction } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOperate } from '@/lib/rbac';
import { plural } from '@/lib/ops';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import useDisplayZone from '@/hooks/useDisplayZone';
import { isoToZoned, zonedToIso } from '@/components/voice/CampaignSettingsFields';
import StatusBadge, { SCHEDULED_TONES } from '@/components/ops/StatusBadge';
import ReasonDialog from '@/components/ops/ReasonDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import OpsButton from '@/components/ops/OpsButton';
import { EmptyState, ErrorState, ScrollTable, SkeletonRows } from '@/components/ops/States';

const REFRESH_MS = 30000;
// Tabs group the backend's statuses.
export const CALLBACK_TABS = [
  { id: 'pending', label: 'Pending', statuses: ['PENDING', 'CALLING'] },
  { id: 'missed', label: 'Missed', statuses: ['MISSED'] },
  { id: 'done', label: 'Done', statuses: ['COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'] },
];

// Row actions, in menu order; which apply comes from each row's allowed_actions.
export const CALLBACK_ACTIONS = {
  reschedule: { label: 'Reschedule', path: 'reschedule', success: 'Callback rescheduled' },
  reassign: { label: 'Reassign assistant', path: 'reassign', success: 'Assistant changed' },
  dial_now: { label: 'Dial now', path: 'dial-now', success: 'It will be dialled within a minute' },
  next_attempt: { label: 'Change next attempt', path: 'next-attempt', success: 'Next attempt changed' },
  requeue: { label: 'Requeue', path: 'requeue', success: 'Callback requeued' },
  attempts: { label: 'Reset attempts', path: 'attempts', success: 'Attempts reset' },
  handled: { label: 'Mark handled manually', path: 'handled', success: 'Marked handled' },
  cancel: { label: 'Cancel', path: 'cancel', success: 'Callback cancelled', danger: true },
};

function CallbackActionDialog({ action, call, assistants, zone, onClose, onDone }) {
  const meta = CALLBACK_ACTIONS[action];
  const initial = isoToZoned(call.next_attempt_at || call.scheduled_time, zone);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [assistantId, setAssistantId] = useState(call.assistant_id || '');
  const request = useCallback((reason) => {
    const body = { reason };
    if (action === 'reschedule') body.scheduled_time = zonedToIso(date, time, zone);
    if (action === 'next_attempt') body.next_attempt_at = zonedToIso(date, time, zone);
    if (action === 'reassign') body.assistant_id = assistantId;
    if (action === 'attempts') body.reset = true;
    return scheduledCallAction(call.id, meta.path, body);
  }, [action, call, meta, date, time, zone, assistantId]);
  const { run } = useApiAction(request, { success: meta.success, onSuccess: onDone, onConflict: onDone });
  const needsTime = action === 'reschedule' || action === 'next_attempt';
  const changes = {
    reschedule: ['The callback moves to the new time (inside calling hours in the lead\'s zone).'],
    reassign: ['A different assistant makes the call.'],
    dial_now: ['The call goes out at the next runner tick; the timing rules are skipped once (never do-not-call).'],
    next_attempt: ['The next try happens at the new time.'],
    requeue: ['The callback goes back to Pending.'],
    attempts: ['The attempt count goes back to 0.'],
    handled: ['Someone dealt with the lead: the callback is done and its missed warning is cleared.'],
    cancel: ['The callback will not be made.'],
  }[action];
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }} title={`${meta.label}: ${call.name || 'callback'}`}
      changes={changes} confirmLabel={meta.label} danger={meta.danger}
      canConfirm={(!needsTime || (date && time)) && (action !== 'reassign' || assistantId)}
      onConfirm={async (reason) => Boolean(await run(reason))}>
      {needsTime && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Time ({zone})
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
        </div>
      )}
      {action === 'reassign' && (
        <label className="flex flex-col gap-1 text-sm font-medium">Assistant
          <select value={assistantId} onChange={(e) => setAssistantId(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2">
            <option value="">Choose an assistant</option>
            {(assistants || []).filter((a) => a.is_live && a.vapi_assistant_id).map((a) => <option key={a.id} value={a.vapi_assistant_id}>{a.name}</option>)}
          </select>
        </label>
      )}
    </ReasonDialog>
  );
}

export default function CallbacksPage() {
  const { user } = useAuth();
  const zone = useDisplayZone();
  const operator = canOperate(user);
  const [params, setParams] = useSearchParams();
  const tab = CALLBACK_TABS.find((t) => t.id === params.get('tab')) || CALLBACK_TABS[0];
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState(null);
  const [assistants, setAssistants] = useState([]);
  const [acting, setActing] = useState(null);

  useEffect(() => { getAssistants().then((r) => setAssistants(r.data)).catch(() => setAssistants([])); }, []);
  const load = useCallback(async () => {
    try {
      const res = await getScheduledCalls();
      setCalls(res.data.scheduled_calls);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, []);
  usePolling(load, REFRESH_MS);

  const assistantName = useMemo(() => {
    const byId = new Map(assistants.map((a) => [a.vapi_assistant_id, a.name]));
    return (id) => byId.get(id) || (id ? 'Unknown assistant' : '—');
  }, [assistants]);
  const byTab = useMemo(() => Object.fromEntries(CALLBACK_TABS.map((t) => [t.id, (calls || []).filter((c) => t.statuses.includes(c.status))])), [calls]);
  const rows = byTab[tab.id] || [];
  const missed = byTab.missed?.length || 0;
  const setTab = (id) => setParams({ tab: id });

  return (
    <div className="ops mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Callbacks</h1>
        <p className="text-sm text-muted-foreground">Calls promised to leads and single scheduled calls. Times in {zone}.</p>
      </header>

      {tab.id === 'pending' && missed > 0 && (
        <div role="alert" className="ops-tone ops-tone-bad flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 font-semibold">{plural(missed, 'callback')} missed — follow up</span>
          <OpsButton size="sm" variant="outline" onClick={() => setTab('missed')}>Show missed</OpsButton>
        </div>
      )}

      <div role="tablist" aria-label="Callbacks" className="flex flex-wrap gap-1 border-b border-border">
        {CALLBACK_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab.id === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab.id === t.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label} {calls && <span className="ops-num rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs">{byTab[t.id].length}</span>}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && calls === null && <SkeletonRows rows={5} label="Loading callbacks" />}
      {!error && calls && rows.length === 0 && <EmptyState title={`No ${tab.label.toLowerCase()} callbacks.`} />}
      {!error && rows.length > 0 && (
        <ScrollTable label={`${tab.label} callbacks`}>
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Lead</th>
              <th className="px-4 py-2 font-semibold">Promised time</th>
              <th className="px-4 py-2 font-semibold">Assistant</th>
              <th className="px-4 py-2 font-semibold">Attempts</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Reason</th>
              {operator && <th className="px-4 py-2 font-semibold"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={`border-b border-border last:border-0 ${c.status === 'MISSED' ? 'ops-row-alert' : ''}`}>
                <td className="px-4 py-2.5 font-medium">
                  {c.prospect_id ? <Link to={`/leads?prospect=${c.prospect_id}`} className="text-[color:var(--ops-accent-ink)] hover:underline">{c.name || 'Lead'}</Link> : (c.name || '—')}
                  <span className="block text-xs text-muted-foreground">{c.source_label}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5"><RelativeTime iso={c.scheduled_time} mode="absolute" /></td>
                <td className="px-4 py-2.5">{assistantName(c.assistant_id)}</td>
                <td className="ops-num px-4 py-2.5">{c.attempts ?? 0}{c.max_attempts ? ` / ${c.max_attempts}` : ''}</td>
                <td className="px-4 py-2.5"><StatusBadge label={c.status_label} tone={SCHEDULED_TONES[c.status]} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.status_reason || c.last_error || '—'}</td>
                {operator && (
                  <td className="px-4 py-2.5 text-right">
                    {c.allowed_actions?.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`Actions for ${c.name || 'this callback'}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))]">
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {Object.keys(CALLBACK_ACTIONS).filter((a) => c.allowed_actions.includes(a)).map((a) => (
                            <DropdownMenuItem key={a} onSelect={() => setActing({ action: a, call: c })}>
                              {CALLBACK_ACTIONS[a].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
      {acting && (
        <CallbackActionDialog action={acting.action} call={acting.call} assistants={assistants} zone={zone}
          onClose={() => setActing(null)} onDone={load} />
      )}
    </div>
  );
}
