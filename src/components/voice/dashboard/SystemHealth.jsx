import { HEALTH_LABELS, HEALTH_STATES, formatClock } from '@/lib/voiceDashboard';

const DOT = {
  healthy: 'bg-emerald-600 dark:bg-emerald-400',
  watch: 'bg-amber-500 dark:bg-amber-400',
  down: 'bg-red-600 dark:bg-red-400',
  scheduled: 'bg-blue-600 dark:bg-blue-400',
  idle: 'bg-muted-foreground',
  not_configured: 'bg-muted-foreground',
};

/** Four live signals; the state is always written out, never shown by colour alone. */
export default function SystemHealth({ health }) {
  const checkedAt = health[0]?.checked_at;
  return (
    <section className="rounded-xl border border-border bg-card p-5 flex flex-col" aria-labelledby="vd-health-title">
      <h2 id="vd-health-title" className="text-sm font-semibold text-foreground mb-3">System health</h2>
      <ul className="divide-y divide-border">
        {health.map((item) => (
          <li key={item.key} className="py-3 first:pt-0 flex gap-3">
            <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full ${DOT[item.state]}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {HEALTH_LABELS[item.key]} <span className="font-normal text-muted-foreground">· {HEALTH_STATES[item.state]}</span>
              </p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {checkedAt && (
        <p className="mt-auto pt-3 text-[11px] text-muted-foreground">Checked {formatClock(checkedAt)} from live data.</p>
      )}
    </section>
  );
}
