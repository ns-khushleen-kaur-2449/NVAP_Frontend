import { ArrowRight, Plus } from 'lucide-react';
import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { useSession } from '../../context/SessionContext';
import { getAgentByType } from '../../config/agents';
import { LIFECYCLE } from '../../lib/lifecycle';
import AgentsTable from '../../components/AgentsTable';
import {
  AsyncBoundary, ButtonLink, EmptyState, Meter, PageHeader, Panel, PanelHeader, StatCard, TextLink,
} from '../../components/primitives';

function listTypes(agents) {
  const names = [...new Set(agents.map((a) => getAgentByType(a.type)?.shortName).filter(Boolean))];
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Tenant admin dashboard (doc §29.3). */
export default function Dashboard() {
  const { tenant } = useSession();
  const stats = useNvipQuery(() => workspaceApi.dashboard(), []);
  const agents = useNvipQuery(() => workspaceApi.myAgents(), []);

  const list = agents.data ?? [];
  const activeCount = list.filter((a) => a.lifecycle === LIFECYCLE.ACTIVE).length;

  return (
    <>
      <PageHeader
        title={`${tenant?.name ?? 'Your'} workspace`}
        subtitle={list.length ? `${listTypes(list)} agents · ${activeCount} active` : 'No agents yet'}
        actions={<ButtonLink to="/"><Plus className="h-4 w-4" aria-hidden /> New agent</ButtonLink>}
      />

      <AsyncBoundary query={stats}>
        {(s) => {
          const alert = s.alerts?.[0];
          return (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Calls today" value={s.callsToday} />
              <StatCard label="Usage this cycle" value={`${Math.round((s.usage.used / s.usage.included) * 100)}%`}>
                <div className="mt-3">
                  <Meter value={s.usage.used} max={s.usage.included} label="Usage this cycle" />
                </div>
              </StatCard>
              <StatCard label="Open provisioning jobs" value={s.openProvisioningJobs} />
              {alert ? (
                <StatCard label="Needs attention" tone="attention">
                  <p className="mt-2 font-semibold leading-snug">{alert.message}</p>
                </StatCard>
              ) : (
                <StatCard label="Needs attention"><p className="mt-2 text-[var(--nv-muted)]">All clear.</p></StatCard>
              )}
            </div>
          );
        }}
      </AsyncBoundary>

      <Panel className="mt-8">
        <PanelHeader
          title="My Agents"
          action={<TextLink to="/app/agents">View all <ArrowRight className="h-4 w-4" aria-hidden /></TextLink>}
        />
        <AsyncBoundary query={agents}>
          {(rows) => rows.length
            ? <AgentsTable agents={rows} />
            : <EmptyState title="No agents yet" body="Pick an agent from the catalog to get started." action={<ButtonLink to="/">Browse agents</ButtonLink>} />}
        </AsyncBoundary>
      </Panel>
    </>
  );
}
