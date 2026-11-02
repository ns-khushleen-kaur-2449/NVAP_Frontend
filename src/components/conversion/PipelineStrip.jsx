import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SIDE_STAGES, STAGE_FLOW, readable } from './conversionUi';

/**
 * Prospects by current stage, in pipeline order. The page only renders this when the loaded
 * list is the whole result (no search, nothing beyond the page), so the counts are exact.
 * Each stage doubles as a filter for the explorer. No rates are shown: they would need
 * history the workspace does not provide.
 */
export default function PipelineStrip({ counts, active, onSelect }) {
  const chip = (stage) => {
    const count = counts[stage] || 0;
    const on = active === stage;
    return (
      <button key={stage} type="button" onClick={() => onSelect(on ? 'all' : stage)} disabled={!count && !on} aria-pressed={on}
        className={cn('flex shrink-0 items-baseline gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
          'disabled:cursor-default disabled:opacity-50',
          on ? 'border-[color-mix(in_srgb,var(--ops-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--ops-accent)_14%,transparent)]'
            : 'border-border hover:bg-[hsl(var(--surface-2))]')}>
        <span className="font-medium">{readable(stage)}</span>
        <span className="ops-num text-xs text-muted-foreground">{count}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Prospects by stage" className="ops-card flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5">
      <span className="pr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</span>
      {STAGE_FLOW.map((stage, index) => (
        <span key={stage} className="flex shrink-0 items-center gap-2">
          {chip(stage)}
          {index < STAGE_FLOW.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        </span>
      ))}
      <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
      {SIDE_STAGES.map(chip)}
    </nav>
  );
}
