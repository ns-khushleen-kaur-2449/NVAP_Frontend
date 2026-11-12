import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { AsyncBoundary, Meter, PageHeader, Panel } from '../../components/primitives';

/** Usage vs. included allowance, overage itemized separately (doc §29.3, FR-PRICE-03/06). */
export default function Usage() {
  const query = useNvipQuery(() => workspaceApi.usage(), []);
  return (
    <>
      <PageHeader title="Usage & Billing" subtitle="Usage against your plan for the current billing cycle." />
      <AsyncBoundary query={query}>
        {(u) => (
          <>
            <p className="mb-4 text-sm text-[var(--nv-muted)]">Cycle: {u.period.start} → {u.period.end}</p>
            <div className="grid gap-5 md:grid-cols-3">
              {u.lines.map((l) => {
                const pct = Math.round((l.used / l.included) * 100);
                return (
                  <Panel key={l.metric} className="p-5">
                    <div className="text-sm font-semibold text-[var(--nv-muted)]">{l.metric}</div>
                    <div className="mt-2 text-3xl font-bold tabular-nums">{l.used.toLocaleString()}</div>
                    <div className="mb-3 text-sm text-[var(--nv-muted)] tabular-nums">of {l.included.toLocaleString()} included · {pct}%</div>
                    <Meter value={l.used} max={l.included} label={l.metric} />
                  </Panel>
                );
              })}
            </div>
            <Panel className="mt-6 p-5">
              <h2 className="font-semibold">Overage charges</h2>
              <p className="mt-1 text-sm text-[var(--nv-muted)]">
                {u.overage.length ? `${u.overage.length} line items this cycle.` : 'None this cycle. We notify you before overage starts.'}
              </p>
            </Panel>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}
