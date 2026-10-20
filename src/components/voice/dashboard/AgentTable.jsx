import { Loader2 } from 'lucide-react';
import { AGENT_STATUS_LABELS, formatCount, formatDuration, formatRate, initials, relativeTime } from '@/lib/voiceDashboard';

const STATUS_DOT = {
  calling: 'bg-emerald-600 dark:bg-emerald-400',
  idle: 'bg-amber-500 dark:bg-amber-400',
  paused: 'bg-muted-foreground',
};
const AVATAR_COLORS = ['bg-violet-700', 'bg-rose-700', 'bg-emerald-700', 'bg-blue-700', 'bg-amber-800', 'bg-teal-700'];

function StatusCell({ agent }) {
  const label = AGENT_STATUS_LABELS[agent.status];
  const detail = agent.status === 'idle' && agent.queue_empty ? `${label} · queue empty` : label;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status]}`} aria-hidden="true" />
        {detail}
      </p>
      <p className="text-xs text-muted-foreground">
        {agent.last_call_at_all_time ? `Last call ${relativeTime(agent.last_call_at_all_time)}` : 'No calls yet'}
      </p>
    </div>
  );
}

function ActionButton({ agent, busy, onPause, onResume, onAssignLeads }) {
  if (agent.id == null) return null;
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[hsl(var(--surface-2))] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vd-accent)]';
  if (agent.status === 'paused') {
    return <button type="button" className={base} disabled={busy} onClick={() => onResume(agent)}>{busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}Resume<span className="sr-only"> {agent.name}</span></button>;
  }
  if (agent.queue_empty) {
    return <button type="button" className={base} onClick={() => onAssignLeads(agent)}>Assign leads<span className="sr-only"> to {agent.name}</span></button>;
  }
  return <button type="button" className={base} disabled={busy} onClick={() => onPause(agent)}>{busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}Pause<span className="sr-only"> {agent.name}</span></button>;
}

/** One row per agent for the selected window; numbers straight from the summary. */
export default function AgentTable({ agents, busyId, onPause, onResume, onAssignLeads, onManageAgents }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="vd-agents-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="vd-agents-title" className="text-sm font-semibold text-foreground">Agent performance</h2>
        <button type="button" onClick={onManageAgents}
                className="text-xs font-semibold underline underline-offset-2 text-[var(--vd-accent-ink)] hover:no-underline">
          Manage all agents
        </button>
      </div>
      {agents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No published agents yet. Create one to start calling.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th scope="col" className="py-2 pr-3">Agent</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 pr-3 text-right">Calls</th>
                <th scope="col" className="py-2 pr-3 text-right">Connected</th>
                <th scope="col" className="py-2 pr-3 text-right">Interested</th>
                <th scope="col" className="py-2 pr-3 text-right">Hot leads</th>
                <th scope="col" className="py-2 pr-3 text-right">Avg talk</th>
                <th scope="col" className="py-2 pr-3 text-right">In queue</th>
                <th scope="col" className="py-2"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => (
                <tr key={agent.id ?? 'unregistered'} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`} aria-hidden="true">
                        {agent.initials || initials(agent.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.campaign || 'No campaign assigned'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3"><StatusCell agent={agent} /></td>
                  <td className="py-3 pr-3 text-right tabular-nums font-semibold">{formatCount(agent.dialed)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {agent.dialed ? `${formatCount(agent.connected)} · ${formatRate(agent.connect_rate)}` : '—'}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{agent.dialed ? formatCount(agent.interested) : '—'}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{agent.dialed ? formatCount(agent.hot) : '—'}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatDuration(agent.avg_talk_seconds)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatCount(agent.queue)}</td>
                  <td className="py-3 text-right">
                    <ActionButton agent={agent} busy={busyId === agent.id} onPause={onPause} onResume={onResume} onAssignLeads={onAssignLeads} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
