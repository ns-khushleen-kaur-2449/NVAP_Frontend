import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { callbackHandoffAction, getCallbackHandoffs } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOperate } from '@/lib/rbac';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import { isoToZoned, zonedToIso } from '@/components/voice/CampaignSettingsFields';
import StatusBadge from '@/components/ops/StatusBadge';
import ReasonDialog from '@/components/ops/ReasonDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import { EmptyState, ErrorState, ScrollTable, SkeletonRows } from '@/components/ops/States';

const REFRESH_MS = 30000;

export const HANDOFF_FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

// Row actions, in menu order; which apply comes from each row's allowed_actions.
export const HANDOFF_ACTIONS = {
  done: { label: 'Mark done', path: 'done', success: 'Marked done',
    changes: ['Someone called the lead: the hand-off is done and its warnings are cleared.'] },
  schedule_call: { label: 'Schedule an AI call instead', path: 'schedule-call', success: 'AI call scheduled',
    changes: ['The agent calls the lead at this time; the call appears under Pending.', 'The hand-off is marked done.'] },
  cancel: { label: 'Cancel', path: 'cancel', success: 'Hand-off cancelled', danger: true,
    changes: ['Nobody will call the lead for this request.'] },
};

const STATUS_TONES = { open: 'warn', done: 'good', cancelled: 'neutral' };
const STATUS_LABELS = { open: 'Open', done: 'Done', cancelled: 'Cancelled' };

function tomorrowAtTen(zone) {
  const day = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { date: isoToZoned(day.toISOString(), zone).date, time: '10:00' };
}

function HandoffActionDialog({ action, handoff, assistants, zone, onClose, onDone }) {
  const meta = HANDOFF_ACTIONS[action];
  const initial = tomorrowAtTen(zone);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [assistantId, setAssistantId] = useState('');
  const request = useCallback((reason) => {
    const body = { reason };
    if (action === 'schedule_call') {
      body.scheduled_time = zonedToIso(date, time, zone);
      if (assistantId) body.assistant_id = assistantId;
    }
    return callbackHandoffAction(handoff.id, meta.path, body);
  }, [action, handoff, meta, date, time, zone, assistantId]);
  const { run } = useApiAction(request, { success: meta.success, onSuccess: onDone, onConflict: onDone });
  const scheduling = action === 'schedule_call';
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }} title={`${meta.label}: ${handoff.lead_name || 'hand-off'}`}
      changes={meta.changes} confirmLabel={meta.label} danger={meta.danger}
      canConfirm={!scheduling || Boolean(date && time)}
      onConfirm={async (reason) => Boolean(await run(reason))}>
      {scheduling && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">Time ({zone})
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">Assistant
            <select value={assistantId} onChange={(e) => setAssistantId(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2">
              <option value="">The agent that took the call</option>
              {(assistants || []).filter((a) => a.is_live && a.vapi_assistant_id).map((a) => <option key={a.id} value={a.vapi_assistant_id}>{a.name}</option>)}
            </select>
          </label>
        </>
      )}
    </ReasonDialog>
  );
}

/**
 * Callbacks a person must make (GET /api/v1/callback-handoffs): the lead asked for a person, or the
 * AI may not call them.  Tenant Admins and Managers act on them with a reason.  `onChanged` lets the
 * page refresh its tab count.
 */
export default function HandoffsPanel({ assistants, zone, onChanged }) {
  const { user } = useAuth();
  const operator = canOperate(user);
  const [params, setParams] = useSearchParams();
  const filter = HANDOFF_FILTERS.find((f) => f.id === params.get('status')) || HANDOFF_FILTERS[0];
  const openId = params.get('open');
  const [handoffs, setHandoffs] = useState(null);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getCallbackHandoffs({ status: filter.id });
      setHandoffs(res.data.handoffs);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [filter.id]);
  usePolling(load, REFRESH_MS, [filter.id]);
  const changed = () => { load(); onChanged?.(); };
  const setFilter = (id) => setParams({ tab: 'handoffs', status: id });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Leads who asked to speak to a person, or whom the AI may not call. Call them yourself, or schedule an AI call instead.
      </p>
      <div role="group" aria-label="Hand-off status" className="flex flex-wrap gap-1">
        {HANDOFF_FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter.id === f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter.id === f.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && handoffs === null && <SkeletonRows rows={4} label="Loading hand-offs" />}
      {!error && handoffs && handoffs.length === 0 && <EmptyState title={`No ${filter.label.toLowerCase()} hand-offs.`} />}
      {!error && handoffs && handoffs.length > 0 && (
        <ScrollTable label={`${filter.label} hand-offs`}>
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Lead</th>
              <th className="px-4 py-2 font-semibold">Call them</th>
              <th className="px-4 py-2 font-semibold">Why</th>
              <th className="px-4 py-2 font-semibold">They asked for</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              {operator && <th className="px-4 py-2 font-semibold"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {handoffs.map((h) => (
              <tr key={h.id} aria-current={openId === h.id ? 'true' : undefined}
                className={`border-b border-border last:border-0 ${h.overdue ? 'ops-row-alert' : ''} ${openId === h.id ? 'bg-[hsl(var(--surface-2))]' : ''}`}>
                <td className="px-4 py-2.5 font-medium">
                  {h.prospect_id
                    ? <Link to={`/leads?prospect=${h.prospect_id}`} className="text-[color:var(--ops-accent-ink)] hover:underline">{h.lead_name || 'Lead'}</Link>
                    : (h.lead_name || 'Unknown caller')}
                  {h.phone_number && <span className="block text-xs text-muted-foreground">{h.phone_number}</span>}
                  <Link to={`/voice_agent?tab=logs&call=${encodeURIComponent(h.vapi_call_id)}`} className="block text-xs text-muted-foreground underline">Open the call</Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <RelativeTime iso={h.due_at} mode="absolute" />
                  {h.overdue && <span className="block text-xs font-semibold text-[color:var(--ops-bad)]">Overdue</span>}
                </td>
                <td className="px-4 py-2.5">{h.reason_label}{h.notes && <span className="block text-xs text-muted-foreground">{h.notes}</span>}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{h.preferred_time_window || '—'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={STATUS_LABELS[h.status] || h.status} tone={STATUS_TONES[h.status]} />
                  {h.scheduled_call_id && <span className="block text-xs text-muted-foreground">AI call scheduled</span>}
                </td>
                {operator && (
                  <td className="px-4 py-2.5 text-right">
                    {h.allowed_actions?.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`Actions for ${h.lead_name || 'this hand-off'}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))]">
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {Object.keys(HANDOFF_ACTIONS).filter((a) => h.allowed_actions.includes(a)).map((a) => (
                            <DropdownMenuItem key={a} onSelect={() => setActing({ action: a, handoff: h })}>
                              {HANDOFF_ACTIONS[a].label}
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
        <HandoffActionDialog action={acting.action} handoff={acting.handoff} assistants={assistants} zone={zone}
          onClose={() => setActing(null)} onDone={changed} />
      )}
    </div>
  );
}
