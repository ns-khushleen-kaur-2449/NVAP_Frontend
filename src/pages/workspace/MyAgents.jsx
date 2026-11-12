import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { LIFECYCLE_META } from '../../lib/lifecycle';
import AgentsTable from '../../components/AgentsTable';
import { AsyncBoundary, ButtonLink, EmptyState, PageHeader, Panel } from '../../components/primitives';

export default function MyAgents() {
  const query = useNvipQuery(() => workspaceApi.myAgents(), []);
  const [filter, setFilter] = useState('all');

  return (
    <>
      <PageHeader
        title="My Agents"
        subtitle="Every agent instance your organization owns, and where it is in its lifecycle."
        actions={<ButtonLink to="/"><Plus className="h-4 w-4" aria-hidden /> New agent</ButtonLink>}
      />
      <AsyncBoundary query={query}>
        {(agents) => {
          const states = ['all', ...new Set(agents.map((a) => a.lifecycle))];
          const shown = filter === 'all' ? agents : agents.filter((a) => a.lifecycle === filter);
          return (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {states.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    aria-pressed={filter === s}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-semibold',
                      filter === s ? 'bg-[var(--nv-orange)] text-white' : 'border border-[var(--nv-line)] bg-[var(--nv-surface)]',
                    )}
                  >
                    {s === 'all' ? `All (${agents.length})` : LIFECYCLE_META[s]?.label ?? s}
                  </button>
                ))}
              </div>
              <Panel>
                {shown.length ? <AgentsTable agents={shown} /> : <EmptyState title="No agents match this filter" />}
              </Panel>
            </>
          );
        }}
      </AsyncBoundary>
    </>
  );
}
