import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState } from '@/components/ops/States';
import { relativeTime } from '@/lib/ops';
import { SORT_OPTIONS, readable, stageTone } from './conversionUi';

const selectClass = 'h-9 w-full min-w-0 rounded-lg border border-border bg-[hsl(var(--surface-2))] px-2.5 text-sm text-foreground';

/** Left pane: search, filter, sort and the scrollable list of prospects. */
export default function ProspectExplorer({
  prospects, total, loadedCount, selectedId, onSelect, search, onSearch, query,
  stageFilter, onStageFilter, filterOptions, sort, onSort, className,
}) {
  const filtered = stageFilter !== 'all';
  return (
    <aside aria-label="Prospect explorer" className={cn('ops-card min-h-[320px] min-w-0 flex-col overflow-hidden lg:min-h-0', className)}>
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Prospects</h2>
          <span className="ops-num text-xs text-muted-foreground">{total}</span>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name or email" aria-label="Search prospects"
            className="h-10 w-full rounded-lg border border-border bg-[hsl(var(--surface-2))] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ops-accent)]" />
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="w-9 shrink-0">Filter</span>
            <select value={stageFilter} onChange={(event) => onStageFilter(event.target.value)} className={selectClass}>
              {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="w-9 shrink-0">Sort</span>
            <select value={sort} onChange={(event) => onSort(event.target.value)} className={selectClass}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {prospects.length} of {total}
          {total > loadedCount && ` · first ${loadedCount} loaded, search to narrow`}
        </p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto lg:h-0">
        {prospects.map((prospect) => {
          const active = String(prospect.prospect_id) === String(selectedId);
          return (
            <li key={prospect.prospect_id} className="border-b border-border last:border-0">
              <button type="button" onClick={() => onSelect(prospect.prospect_id)} aria-current={active ? 'true' : undefined}
                className={cn('block w-full px-4 py-3 text-left transition-colors',
                  active ? 'bg-[color-mix(in_srgb,var(--ops-accent)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ops-accent)_35%,transparent)]'
                    : 'hover:bg-[hsl(var(--surface-2))]')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{prospect.full_name || 'Unnamed prospect'}</span>
                  {prospect.pending_decision_id && <StatusBadge label="Review" tone="warn" />}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={prospect.email || undefined}>{prospect.email || 'No email recorded'}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <StatusBadge label={readable(prospect.current_stage)} tone={stageTone(prospect.current_stage)} />
                  <span className="text-xs text-muted-foreground">
                    {prospect.unverified_evidence_count > 0 && <span className="mr-2 font-medium text-[color:var(--ops-info)]">{prospect.unverified_evidence_count} to verify</span>}
                    {prospect.updated_at && <>Updated {relativeTime(prospect.updated_at)}</>}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
        {!prospects.length && (
          <li className="p-4">
            {query ? <EmptyState title={`No prospects match “${query}”.`} body="Try a different name or email." />
              : filtered ? <EmptyState title="No prospects match this filter." action={<OpsButton size="sm" onClick={() => onStageFilter('all')}>Show all prospects</OpsButton>} />
                : <EmptyState title="No prospects yet." body="Prospects you are allowed to inspect appear here." />}
          </li>
        )}
      </ul>
    </aside>
  );
}
