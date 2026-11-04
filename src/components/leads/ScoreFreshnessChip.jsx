import { FRESHNESS } from '@/lib/leadScoreLabels';

/** RECALCULATION DUE or OUT OF DATE (freshness_indicator); nothing for an up-to-date score. Display only. */
export default function ScoreFreshnessChip({ indicator }) {
  const meta = FRESHNESS[indicator];
  if (!meta) return null;
  const due = indicator === 'recalculation_due';
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${due
      ? 'border-[hsl(38,80%,58%)] text-[hsl(38,80%,48%)]' : 'border-border bg-muted text-muted-foreground line-through decoration-1'}`}
      title={meta.help} data-testid="freshness-chip">
      {meta.label}
    </span>
  );
}
