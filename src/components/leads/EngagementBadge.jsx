import { ENGAGEMENT_LABELS, humanize, secondaryBadgeText } from '@/lib/leadScoreLabels';

// "Failed" is shown only for a recorded failure; anything unconfirmed is "No result recorded yet".
const confirmedState = (label, latestAttempt) =>
  (label === 'failed' && latestAttempt?.confirmed !== true ? 'no_result_recorded' : label);

const helpText = (label, timeout) => {
  const help = ENGAGEMENT_LABELS[label]?.help || '';
  if (!help.includes('{T}')) return help;
  const minutes = timeout?.pending_timeout_minutes ?? 15;
  const provisional = timeout && timeout.pending_timeout_final === false ? ' (processing window provisional)' : '';
  return `${help.replace('{T}', minutes)}${provisional}`;
};

/**
 * The lead's assessment category (one of nine, `engagement_label`) and, as a separate
 * element, its secondary badge ("Latest call: …" / "Earlier assessment: …"), which is
 * never a category.  `thresholds`: the processing window for the help text.
 */
export default function EngagementBadge({ label, latestAttempt, secondaryBadge, thresholds, compact = false }) {
  if (!label) return null;
  const shown = confirmedState(label, latestAttempt);
  const meta = ENGAGEMENT_LABELS[shown] || { icon: '', label: humanize(shown) };
  let badge = secondaryBadge;
  if (badge?.kind === 'latest_call' && badge.state === 'failed' && latestAttempt?.confirmed !== true) {
    badge = { ...badge, state: 'no_result_recorded' };
  }
  const secondary = secondaryBadgeText(badge, latestAttempt?.reason);
  const tone = shown === 'failed' ? 'border-[hsl(38,92%,50%)] text-[hsl(38,92%,40%)]'
    : shown === 'no_result_recorded' ? 'border-[hsl(210,30%,60%)] text-[hsl(210,30%,45%)]'
      : 'border-border text-foreground';
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${tone}`}
        title={helpText(shown, thresholds || {
          pending_timeout_minutes: latestAttempt?.processing_window_minutes,
          pending_timeout_final: latestAttempt?.processing_window_final,
        })} data-testid="engagement-badge" data-label={shown}>
        <span aria-hidden="true">{meta.icon}</span>{meta.label}
      </span>
      {secondary && (
        <span className="rounded border border-dashed border-border px-1.5 py-0.5 text-muted-foreground"
          data-testid="secondary-badge">
          {secondary}
        </span>
      )}
    </span>
  );
}
