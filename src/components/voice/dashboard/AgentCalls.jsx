import { useCallback, useRef, useState } from 'react';
import TenantPicker from '@/components/ops/TenantPicker';
import usePolling from '@/hooks/usePolling';
import { getAgentMetrics } from '@/lib/api';
import { formatCount, formatDuration, formatRate, windowFor } from '@/lib/voiceDashboard';

export const AGENT_CALLS_REFRESH_MS = 30000;

// Each agent's own numbers (backend AgentPack.metrics), as words after the count.
const OWN_NUMBER_WORDS = {
  interested: 'interested',
  hot: 'hot',
  appointments_booked: 'appointments booked',
  callbacks_requested: 'callbacks requested',
  interviews_completed: 'interviews completed',
  interviews_incomplete: 'interviews incomplete',
  needs_review: 'needing review',
  not_interviewed: 'not interviewed',
  awaiting_result: 'awaiting the summary',
};

/** An agent's own non-zero numbers as one line, e.g. "2 interviews completed · 1 needing review"; "" when none. */
export function ownNumbers(metrics = {}) {
  return Object.entries(metrics || {})
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([key, value]) => `${formatCount(value)} ${OWN_NUMBER_WORDS[key] || key.replaceAll('_', ' ')}`)
    .join(' · ');
}

/**
 * Calls per catalog agent in the dashboard's period (GET /api/v1/agents/metrics): counts only, never a lead, a
 * candidate or a phone number. The dashboard's other numbers are the voice agent's (SDR's) alone, so this is where
 * another agent's calls, such as Hiring's, are seen. A Super Admin has no tenant and picks one.
 */
export default function AgentCalls({ range, superAdmin = false }) {
  const [tenantId, setTenantId] = useState('');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(null);
  const latest = useRef(0);
  const ready = !superAdmin || Boolean(tenantId);

  const load = useCallback(async () => {
    if (!ready) return;
    const request = ++latest.current;
    try {
      const params = { ...windowFor(range) };
      if (superAdmin) params.tenant_id = tenantId;
      const res = await getAgentMetrics(params);
      if (request !== latest.current) return; // a newer request (range or tenant change) won
      setData(res.data);
      setFailed(null);
    } catch (err) {
      if (request !== latest.current) return;
      setFailed(err?.response?.status === 403 ? 'Your role cannot view these numbers.' : 'These numbers could not be loaded.');
    }
  }, [range, superAdmin, tenantId, ready]);

  // Load on range or tenant change, then every 30 s while the tab is visible (as the dashboard does).
  usePolling(load, AGENT_CALLS_REFRESH_MS, [load]);

  const agents = data?.agents || [];

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="vd-agent-calls-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 id="vd-agent-calls-title" className="text-sm font-semibold text-foreground">Calls by agent</h2>
          <p className="text-xs text-muted-foreground">
            Every agent the organisation uses, in this period. The numbers above are the voice agent's only.
          </p>
        </div>
        {superAdmin && <TenantPicker value={tenantId} onChange={setTenantId} />}
      </div>
      {failed ? (
        <div className="flex flex-wrap items-center gap-3 py-4 text-sm text-muted-foreground">
          <p>{failed}</p>
          <button type="button" onClick={load} aria-label="Load calls by agent again"
                  className="text-xs font-semibold underline underline-offset-2 text-[var(--vd-accent-ink)] hover:no-underline">
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading calls by agent…</p>
      ) : agents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No agents in use yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[560px] text-sm" aria-label="Calls by agent">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th scope="col" className="py-2 pr-3">Agent</th>
                <th scope="col" className="py-2 pr-3 text-right">Dialed</th>
                <th scope="col" className="py-2 pr-3 text-right">Connected</th>
                <th scope="col" className="py-2 pr-3 text-right">Connect rate</th>
                <th scope="col" className="py-2 pr-3 text-right">Avg talk</th>
                <th scope="col" className="py-2 text-right">Inbound</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const own = ownNumbers(agent.metrics);
                return (
                  <tr key={agent.id} data-testid={`agent-calls-${agent.key}`} className="border-b border-border last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-normal">
                      <p className="font-semibold text-foreground">{agent.name}</p>
                      {own && <p className="text-xs text-muted-foreground">{own}</p>}
                    </th>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatCount(agent.calls.dialed)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatCount(agent.calls.connected)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatRate(agent.calls.connect_rate)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatDuration(agent.calls.avg_talk_seconds)}</td>
                    <td className="py-3 text-right tabular-nums">{formatCount(agent.calls.inbound)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
