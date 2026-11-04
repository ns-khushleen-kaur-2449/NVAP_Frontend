import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/ops/StatusBadge';
import { SERIES, STATUS } from '../charts';

/** "See full analysis" on a dashboard funnel card: the Reports page for the same role. */
export const FullAnalysisLink = () => (
  <Link to="/reports" className="text-xs font-semibold text-[color:var(--ops-accent-ink)] hover:underline">See full analysis →</Link>
);

/** The action of an action item, as a link to the screen where it is done. */
export function ActionLink({ item }) {
  return (
    <Link to={item.href} className={cn('inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs font-semibold',
      item.primary ? 'bg-[var(--ops-accent)] text-white hover:bg-[var(--ops-accent-hover)]' : 'border border-border text-[color:var(--ops-accent-ink)] hover:bg-[hsl(var(--surface-2))]')}>
      {item.action}
    </Link>
  );
}

/** An AI score in a circle; the band is written out for screen readers, not only coloured. */
export function ScoreBadge({ score }) {
  const band = score >= 80 ? ['good', 'High'] : score >= 60 ? ['warn', 'Medium'] : ['neutral', 'Low'];
  return (
    <span title={`${band[1]} priority`} className={cn('ops-tone ops-num inline-grid h-9 w-9 place-items-center rounded-full text-sm font-semibold', `ops-tone-${band[0]}`)}>
      {score}<span className="sr-only"> ({band[1]} priority)</span>
    </span>
  );
}

/** "Show data" for a funnel: each stage, its count, the share kept from the stage before and how many were lost. */
export const funnelTable = (stages) => ({
  columns: ['Stage', 'Prospects', 'Kept from previous', 'Lost'],
  numeric: [1, 2, 3],
  rows: stages.map((s, i) => [
    s.stage, s.count.toLocaleString(),
    i ? `${Math.round((s.count / stages[i - 1].count) * 100)}%` : '—',
    i ? (stages[i - 1].count - s.count).toLocaleString() : '—',
  ]),
});

export const campaignRows = (rows) => rows.map((c) => [
  c.name, c.channels, <StatusBadge key="s" label={c.status[0]} tone={c.status[1]} />, c.contacted, c.meetings, c.conversions,
]);

export const CHANNEL_SERIES = [
  { key: 'responses', name: 'Responses', color: SERIES[0] }, { key: 'meetings', name: 'Meetings', color: SERIES[1] },
  { key: 'conversions', name: 'Conversions', color: SERIES[2] },
];
export const SENT_SERIES = [{ key: 'calls', name: 'Calls', color: SERIES[0] }, { key: 'emails', name: 'Emails', color: SERIES[1] }, { key: 'sms', name: 'SMS', color: SERIES[2] }];
// Meeting outcomes are states, so they wear the status colours (with their names always beside them).
export const OUTCOME_COLORS = { Completed: STATUS.good, Rescheduled: STATUS.info, Cancelled: STATUS.warn, 'No-show': STATUS.bad };
export const OUTCOME_SERIES = [
  { key: 'completed', name: 'Completed', color: STATUS.good }, { key: 'rescheduled', name: 'Rescheduled', color: STATUS.info },
  { key: 'cancelled', name: 'Cancelled', color: STATUS.warn }, { key: 'noShow', name: 'No-show', color: STATUS.bad },
];

export const tableOf = (columns, pick, numeric) => (rows) => ({ columns, numeric, rows: rows.map(pick) });
