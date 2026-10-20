import { NOT_CONNECTED_OUTCOMES, OUTCOME_LABELS, formatCount, formatRate } from '@/lib/voiceDashboard';

const STEP_LABELS = { dialed: 'Dialed', connected: 'Connected', interested: 'Interested', hot: 'Hot lead' };

/** dialed -> connected -> interested -> hot, each as a share of dialed; then where calls were lost. */
export default function ConversionFunnel({ funnel, outcomes, kpis }) {
  const lost = NOT_CONNECTED_OUTCOMES.filter((key) => outcomes?.[key]);
  const notes = [
    `Conversations of 30 s or more: ${formatCount(kpis.conversations_30s.value)}`,
    kpis.unclassified.value ? `${formatCount(kpis.unclassified.value)} connected calls not classified yet` : null,
    `Inbound calls (not counted as dials): ${formatCount(kpis.inbound.value)}`,
    kpis.direction_unknown.value
      ? `${formatCount(kpis.direction_unknown.value)} dials have no recorded direction and count as outbound`
      : null,
  ].filter(Boolean);

  return (
    <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4" aria-labelledby="vd-funnel-title">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 id="vd-funnel-title" className="text-sm font-semibold text-foreground">Conversion funnel</h2>
        <p className="text-xs text-muted-foreground">Each step is a share of calls dialed</p>
      </div>
      <ol className="space-y-3">
        {funnel.map((step) => (
          <li key={step.step}
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[6.5rem_1fr_5.5rem] items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-foreground">{STEP_LABELS[step.step]}</span>
            <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto sm:col-start-2 h-5 rounded bg-[var(--vd-track)] overflow-hidden" aria-hidden="true">
              <span
                className="block h-full rounded-r bg-[var(--vd-connected)]"
                style={{ width: `${(step.share_of_dialed || 0) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums whitespace-nowrap sm:col-start-3 sm:row-start-1">
              <span className="font-semibold text-foreground">{formatCount(step.n)}</span>{' '}
              <span className="text-xs text-muted-foreground">{formatRate(step.share_of_dialed)}</span>
            </span>
          </li>
        ))}
      </ol>
      {lost.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Not connected</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {lost.map((key) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{OUTCOME_LABELS[key]}</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">{formatCount(outcomes[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <ul className="mt-auto pt-3 border-t border-border space-y-1 text-xs text-muted-foreground">
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </section>
  );
}
