import { cn } from '@/lib/utils';

// Tones (index.css .ops-tone-*): text + tinted background + border, so meaning never rests on colour alone.
const TONES = ['neutral', 'info', 'good', 'warn', 'bad', 'accent'];

/**
 * A status as text with a tone. `label` is shown exactly as the backend sends it; `tone`
 * only picks the colour (see the *_TONES maps where a screen maps backend values to tones).
 */
export default function StatusBadge({ label, tone = 'neutral', title, className }) {
  if (!label) return null;
  return (
    <span
      title={title}
      className={cn('ops-tone inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        `ops-tone-${TONES.includes(tone) ? tone : 'neutral'}`, className)}
    >
      {label}
    </span>
  );
}

// Backend status values -> tone (the label always comes from the API).
export const CAMPAIGN_TONES = {
  processing: 'info', scheduled: 'accent', draft: 'neutral', paused: 'warn', missed: 'bad', cancelling: 'warn',
  cancelled: 'neutral', completed: 'good', failed: 'bad', created: 'neutral',
};
export const SCHEDULED_TONES = {
  PENDING: 'accent', CALLING: 'info', COMPLETED: 'good', FAILED: 'bad', MISSED: 'bad', SKIPPED: 'neutral',
  CANCELLED: 'neutral',
};
export const APPOINTMENT_TONES = {
  CONFIRMED: 'info', RESCHEDULED: 'neutral', CANCELLED: 'bad', COMPLETED: 'good', NO_SHOW: 'warn', HELD: 'neutral',
  ACTIVE: 'neutral',
};
export const SEVERITY_TONES = { info: 'info', warning: 'warn', critical: 'bad' };
