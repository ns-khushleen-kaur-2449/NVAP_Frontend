import { OUTCOME_LABELS, formatCallTime, formatDuration } from '@/lib/voiceDashboard';

const OUTCOME_TONE = {
  interested: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  callback_requested: 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200',
  not_reachable: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200',
  error: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200',
};
const NEUTRAL = 'bg-[hsl(var(--surface-3))] text-foreground';

/** The latest calls in the window, each at its own start time and with its own agent. */
export default function RecentCalls({ calls, onOpenCallLog }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="vd-recent-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="vd-recent-title" className="text-sm font-semibold text-foreground">Recent calls</h2>
        <button type="button" onClick={onOpenCallLog}
                className="text-xs font-semibold underline underline-offset-2 text-[var(--vd-accent-ink)] hover:no-underline">
          Full call log
        </button>
      </div>
      {calls.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No calls in this period yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th scope="col" className="py-2 pr-3">Time</th>
                <th scope="col" className="py-2 pr-3">Lead</th>
                <th scope="col" className="py-2 pr-3">Agent</th>
                <th scope="col" className="py-2 pr-3">Outcome</th>
                <th scope="col" className="py-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3 tabular-nums text-foreground"><time dateTime={call.started_at}>{formatCallTime(call.started_at)}</time></td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-foreground">{call.lead_label}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {call.phone_masked || '—'}{call.direction === 'inbound' ? ' · inbound' : ''}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-foreground">{call.agent_name || '—'}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${OUTCOME_TONE[call.outcome] || NEUTRAL}`}>
                      {OUTCOME_LABELS[call.outcome] || call.outcome}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">{formatDuration(call.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
