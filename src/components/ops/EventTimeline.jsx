import RelativeTime from './RelativeTime';
import { EmptyState } from './States';
import { formatDateTime } from '@/lib/ops';

/**
 * One history list for every kind of event. Items: { id, at, title, actor, reason, change }
 * where `change` is an optional "old → new" line. Adapters below turn each API's events into items.
 */
export default function EventTimeline({ items, empty = 'Nothing has happened yet.' }) {
  if (!items?.length) return <EmptyState title={empty} />;
  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.id ?? index} className="relative pl-6 pb-5 last:pb-0">
          <span aria-hidden="true" className="absolute left-[7px] top-2 h-full w-px bg-border last:hidden" />
          <span aria-hidden="true" className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--ops-accent)] bg-card" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <RelativeTime iso={item.at} className="text-xs text-muted-foreground" />
          </div>
          {item.change && <p className="ops-num mt-0.5 text-sm text-foreground">{item.change}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">{item.actor}</p>
          {item.reason && <p className="mt-1 rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 text-sm">“{item.reason}”</p>}
        </li>
      ))}
    </ol>
  );
}

const humanize = (value) => String(value || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function actorText(kind, name) {
  if (name) return `by ${name}`;
  return {
    user: 'by a team member', system: 'by the system', scheduler: 'by the scheduler', call: 'from a call',
    lead_call: 'by the lead, on a call', lead_calendar: "from the lead's calendar", sync: 'by the calendar sync',
  }[kind] || (kind ? `by ${humanize(kind).toLowerCase()}` : '');
}

/** GET /api/campaigns/{id}/events -> items. */
export function campaignEventItems(events) {
  return (events || []).map((e) => ({
    id: e.id, at: e.created_at, reason: e.reason_text,
    title: e.type === 'transition' && e.to_label ? `${e.from_label || 'New'} → ${e.to_label}` : humanize(e.type),
    change: e.metadata?.from && e.metadata?.to ? `${e.metadata.from} → ${e.metadata.to}` : null,
    actor: actorText(e.actor_kind, e.actor?.name),
  }));
}

/** Appointment events (detail.events) -> items; times are shown in `zone`. */
export function appointmentEventItems(events, zone) {
  return (events || []).map((e) => ({
    id: e.id, at: e.created_at, reason: e.reason,
    title: e.summary || humanize(e.type),
    change: e.old_start_at && e.new_start_at
      ? `${formatDateTime(e.old_start_at, zone)} → ${formatDateTime(e.new_start_at, zone)}`
      : (e.from_label && e.to_label && e.from_label !== e.to_label ? `${e.from_label} → ${e.to_label}` : null),
    actor: actorText(e.actor?.kind, e.actor?.name),
  }));
}

/** contact_events (campaign contacts, scheduled calls) -> items: old → new for the fields that changed. */
export function contactEventItems(events) {
  return (events || []).map((e) => {
    const changed = Object.keys(e.new_value || {}).filter((k) => (e.old_value || {})[k] !== e.new_value[k]);
    return {
      id: e.id, at: e.created_at, reason: e.reason, title: humanize(e.type),
      change: changed.map((k) => `${humanize(k)}: ${(e.old_value || {})[k] ?? '—'} → ${e.new_value[k] ?? '—'}`).join(' · ') || null,
      actor: actorText(e.actor_kind),
    };
  });
}
