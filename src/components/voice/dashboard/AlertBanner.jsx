import { AlertTriangle, Info } from 'lucide-react';

/** The summary's alerts; renders nothing when there are none. */
export default function AlertBanner({ alerts, onReviewAgents }) {
  if (!alerts?.length) return null;
  return (
    <div className="space-y-2" role="status">
      {alerts.map((alert) => {
        const warning = alert.level === 'warning';
        const Icon = warning ? AlertTriangle : Info;
        return (
          <div
            key={alert.message}
            className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-start sm:items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm ${
              warning
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-border bg-card text-foreground'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <p className="min-w-0">
              <span className="font-semibold">{warning ? 'Warning: ' : 'Note: '}</span>
              {alert.message}
            </p>
            {warning && alert.agent_ids?.length > 0 && onReviewAgents && (
              <button
                type="button"
                onClick={onReviewAgents}
                className="col-start-2 sm:col-start-3 justify-self-start font-semibold underline underline-offset-2 text-[var(--vd-accent-ink)] hover:no-underline"
              >
                Review agents
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
