import { PROVISIONAL_HELP } from '@/lib/leadScoreLabels';

// Colours of the temperature to display (temperature_display.label); PROVISIONAL is not a band.
export const TEMPERATURE_COLOR = {
  HOT: 'hsl(0, 72%, 52%)',
  WARM: 'hsl(38, 80%, 58%)',
  COLD: 'hsl(210, 70%, 60%)',
  PROVISIONAL: 'hsl(215, 15%, 55%)',
};
export const FALLBACK_COLOR = 'hsl(215, 15%, 60%)';

/**
 * The temperature to display, from the backend's `temperature_display`: HOT / WARM / COLD,
 * or PROVISIONAL (dashed) when there is not enough reliable conversation information.
 * Nothing for a stale or missing score.  Never derived from the number here.
 */
export default function TemperatureChip({ display, className = '' }) {
  const label = display?.label;
  if (!label) return null;
  const color = TEMPERATURE_COLOR[label] || FALLBACK_COLOR;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${display.provisional ? 'border-dashed' : ''} ${className}`}
      style={{ color, borderColor: color }} data-testid="temperature-chip"
      title={display.provisional ? PROVISIONAL_HELP : undefined}>
      {label}
    </span>
  );
}
