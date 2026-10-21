import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProspectTimeline } from '@/lib/api';
import { errorMessage } from '@/hooks/useApiAction';
import useDisplayZone from '@/hooks/useDisplayZone';
import { formatDateTime } from '@/lib/ops';
import { formatDuration } from '@/lib/voiceDashboard';
import { callStatusMeta } from '@/lib/callOutcome';
import EventTimeline from './EventTimeline';
import { ErrorState, SkeletonRows } from './States';

// Filter chips, by the `kind` the backend sends.
const KINDS = [
  { id: 'call', label: 'Calls' },
  { id: 'stage', label: 'Stage changes' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'do_not_call', label: 'Do-not-call' },
];

function toItem(item, zone) {
  const d = item.detail || {};
  const base = { id: `${item.kind}-${item.at}-${item.type}`, at: item.at, title: item.title };
  if (item.kind === 'call') {
    return { ...base, title: `Call · ${callStatusMeta(d.outcome).label}`,
      change: d.duration_seconds != null ? `Talked ${formatDuration(d.duration_seconds)}` : null,
      reason: d.summary, actor: d.campaign_id ? 'Campaign call' : 'Call' };
  }
  if (item.kind === 'appointment') {
    return { ...base,
      change: d.old_start_at && d.new_start_at ? `${formatDateTime(d.old_start_at, zone)} → ${formatDateTime(d.new_start_at, zone)}`
        : (d.from_label && d.to_label && d.from_label !== d.to_label ? `${d.from_label} → ${d.to_label}` : null),
      reason: d.reason, actor: d.actor?.name ? `by ${d.actor.name}` : (d.actor?.kind || '').replace(/_/g, ' ') };
  }
  if (item.kind === 'stage') {
    return { ...base, reason: d.reason, actor: d.actor_type ? `by ${d.actor_type}` : '' };
  }
  return { ...base, reason: d.reason, actor: d.actor?.kind ? `by ${d.actor.kind}` : '' };
}

/** GET /api/v1/prospects/{id}/timeline: calls, stage changes, appointment and do-not-call events in one list. */
export default function ProspectTimeline({ prospectId }) {
  const zone = useDisplayZone();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState('all');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getProspectTimeline(prospectId);
      setItems(res.data.items);
    } catch (err) {
      setError(errorMessage(err, 'Check your connection and try again.'));
    }
  }, [prospectId]);

  useEffect(() => { setItems(null); setKind('all'); load(); }, [load]);

  const counts = useMemo(() => {
    const out = {};
    (items || []).forEach((i) => { out[i.kind] = (out[i.kind] || 0) + 1; });
    return out;
  }, [items]);
  const shown = useMemo(() => (items || []).filter((i) => kind === 'all' || i.kind === kind).map((i) => toItem(i, zone)),
    [items, kind, zone]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items === null) return <SkeletonRows rows={4} label="Loading the timeline" />;
  return (
    <div className="ops space-y-3">
      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {[{ id: 'all', label: 'All' }, ...KINDS].map((chip) => {
          const n = chip.id === 'all' ? items.length : (counts[chip.id] || 0);
          return (
            <button key={chip.id} type="button" aria-pressed={kind === chip.id} onClick={() => setKind(chip.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === chip.id
                ? 'border-[var(--ops-accent)] bg-[var(--ops-accent)] text-white' : 'border-border text-foreground hover:bg-[hsl(var(--surface-2))]'}`}>
              {chip.label} <span className="ops-num">({n})</span>
            </button>
          );
        })}
      </div>
      <EventTimeline items={shown} empty="Nothing in this view yet." />
    </div>
  );
}
