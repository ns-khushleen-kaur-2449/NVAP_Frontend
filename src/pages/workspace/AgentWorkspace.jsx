import { useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { workspaceApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { getAgentByType } from '../../config/agents';
import { tenantActionsFor, takesLiveCalls } from '../../lib/lifecycle';
import { checklistFor } from '../../lib/acceptance';
import { moduleTabsFor } from '../../agents';
import AgentModulePlaceholder from '../../agents/AgentModulePlaceholder';
import {
  AgentTile, AsyncBoundary, Badge, Button, EmptyState, GuardrailChips, LifecycleBadge, Panel, TextLink,
} from '../../components/primitives';

/* ---------- Platform tabs shared by every agent type (doc §29.3) ---------- */

function OverviewTab({ instance, agent }) {
  const rows = [
    ['Agent type', agent.name],
    ['Phone number', instance.phoneNumber || 'Not assigned'],
    ['Calls (last 7 days)', instance.calls7d],
    ['Configuration version', `v${instance.configVersion}`],
    ['System of record', agent.systemOfRecord || '—'],
    ['Books', agent.booking],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel className="p-6">
        <h2 className="font-semibold mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[var(--nv-muted)]">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel className="p-6">
        <h2 className="font-semibold">Guardrails</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--nv-muted)]">Locked by design — these can't be turned off.</p>
        <GuardrailChips guardrails={agent.guardrails} />
      </Panel>
    </div>
  );
}

const ConfigurationTab = () => (
  <AgentModulePlaceholder
    title="Configuration"
    planned={[
      'Prompt / persona editor with Draft and Published states (FR-CONFIG-04)',
      'Tool permissions and escalation targets',
      'Voice selection (ElevenLabs) and greeting',
      'Consent script per jurisdiction',
      'Version history with rollback (FR-CONFIG-01/02)',
    ]}
  />
);

const TestTab = () => (
  <AgentModulePlaceholder
    title="Test this agent"
    planned={[
      'Place a real sandboxed call to a number you enter (FR-ACCESS-07)',
      'Test calls are not billed and stay out of production reporting',
      'Live transcript of the test call',
    ]}
  />
);

const CallsTab = () => (
  <AgentModulePlaceholder
    title="Calls & transcripts"
    planned={[
      'Searchable call log: disposition, duration, cost',
      'Transcript and recording (where enabled)',
      'Linked CRM / ATS / property record and tool-call audit trail (FR-CORE-06)',
    ]}
  />
);

function ActivationTab({ instance, agent, onTransition }) {
  const [busy, setBusy] = useState(null);
  const actions = tenantActionsFor(instance.lifecycle);

  async function run(action) {
    if (action.destructive && !window.confirm(`Retire "${instance.name}"? It will stop taking calls permanently.`)) return;
    setBusy(action.to);
    try {
      await onTransition(action.to);
      toast.success(`${action.action}: done`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel className="p-6 lg:col-span-2">
        <h2 className="font-semibold">Pre-activation checklist</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--nv-muted)]">
          Every item must pass before the agent can move from Testing to Ready (doc §18).
        </p>
        <ul className="space-y-3">
          {checklistFor(agent.type).map((item) => (
            <li key={item.id} className="flex gap-3 text-sm">
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nv-muted)]" aria-hidden />
              <span>{item.label}</span>
              <Badge className="ml-auto shrink-0">Not run</Badge>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="p-6 h-fit">
        <h2 className="font-semibold">Lifecycle</h2>
        <div className="mt-3"><LifecycleBadge state={instance.lifecycle} /></div>
        <p className="mt-3 text-sm text-[var(--nv-muted)]">
          {takesLiveCalls(instance.lifecycle)
            ? 'Taking live, billable calls.'
            : 'Not taking live calls. Only Active agents answer real callers.'}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {actions.map((a) => (
            <Button key={a.to} variant={a.destructive ? 'danger' : 'secondary'} disabled={!!busy} onClick={() => run(a)}>
              {busy === a.to ? 'Working…' : a.action}
            </Button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const PLATFORM_TABS_BEFORE = [{ id: 'overview', label: 'Overview', Component: OverviewTab }];
const PLATFORM_TABS_AFTER = [
  { id: 'configuration', label: 'Configuration', Component: ConfigurationTab },
  { id: 'test', label: 'Test', Component: TestTab },
  { id: 'calls', label: 'Calls & Transcripts', Component: CallsTab },
  { id: 'activation', label: 'Activation', Component: ActivationTab },
];

/** /app/agents/:instanceId/:tab — one agent instance, platform tabs + that agent's module tabs. */
export default function AgentWorkspace() {
  const { instanceId, tab } = useParams();
  const query = useNvipQuery(() => workspaceApi.myAgent(instanceId), [instanceId]);

  async function transition(to) {
    const result = await workspaceApi.transition(instanceId, to);
    query.setData((prev) => ({ ...prev, lifecycle: result.lifecycle }));
  }

  return (
    <>
      <TextLink to="/app/agents" className="mb-6"><ArrowLeft className="h-4 w-4" aria-hidden /> My Agents</TextLink>
      <AsyncBoundary query={query}>
        {(instance) => {
          const agent = instance && getAgentByType(instance.type);
          if (!instance || !agent) return <EmptyState title="Agent not found" body="It may have been retired or belongs to another workspace." />;

          const tabs = [...PLATFORM_TABS_BEFORE, ...moduleTabsFor(agent.type), ...PLATFORM_TABS_AFTER];
          const current = tabs.find((t) => t.id === tab);
          if (!current) return <Navigate to={`/app/agents/${instanceId}/${tabs[0].id}`} replace />;
          const { Component } = current;

          return (
            <>
              {/* Lifecycle badge always visible at the top of an agent page (doc §29.7) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <AgentTile agent={agent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{instance.name}</h1>
                    <LifecycleBadge state={instance.lifecycle} />
                  </div>
                  <p className="text-[var(--nv-muted)]">{agent.name} · {instance.phoneNumber || 'No number assigned'}</p>
                </div>
              </div>

              <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--nv-line)]" aria-label="Agent sections">
                {tabs.map((t) => (
                  <NavLink
                    key={t.id}
                    to={`/app/agents/${instanceId}/${t.id}`}
                    className={({ isActive }) => cn(
                      'whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
                      isActive
                        ? 'border-[var(--nv-orange)] text-[var(--nv-ink)]'
                        : 'border-transparent text-[var(--nv-muted)] hover:text-[var(--nv-ink)]',
                    )}
                  >
                    {t.label}
                  </NavLink>
                ))}
              </nav>

              <Component instance={instance} agent={agent} onTransition={transition} />
            </>
          );
        }}
      </AsyncBoundary>
    </>
  );
}
