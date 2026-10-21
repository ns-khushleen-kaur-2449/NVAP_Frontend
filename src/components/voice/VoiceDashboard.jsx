import { useCallback, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getVoiceDashboardSummary, pauseAssistant, resumeAssistant } from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import {
  RANGES, formatClock, formatCount, formatDelta, formatDuration, formatRate, userTimeZone, windowFor,
} from '@/lib/voiceDashboard';
import AgentTable from './dashboard/AgentTable';
import AlertBanner from './dashboard/AlertBanner';
import ConversionFunnel from './dashboard/ConversionFunnel';
import HourlyCallsChart from './dashboard/HourlyCallsChart';
import KpiCard from './dashboard/KpiCard';
import RecentCalls from './dashboard/RecentCalls';
import SystemHealth from './dashboard/SystemHealth';

export const REFRESH_MS = 30000;

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 flex items-center gap-4 flex-wrap">
      <p className="flex-1"><span className="font-semibold">The dashboard could not be loaded.</span> {message}</p>
      <button type="button" onClick={onRetry}
              className="rounded-lg bg-[var(--vd-accent)] hover:bg-[var(--vd-accent-hover)] px-3 py-1.5 font-semibold text-white">
        Try again
      </button>
    </div>
  );
}

/** Small notes for counts that sit outside the KPIs, shown only when non-zero. */
export function KpiNotes({ kpis }) {
  const notes = [
    kpis.unclassified.value > 0 && `${formatCount(kpis.unclassified.value)} connected call${kpis.unclassified.value === 1 ? '' : 's'} not classified (no SDR extraction)`,
    kpis.inbound.value > 0 && `${formatCount(kpis.inbound.value)} inbound call${kpis.inbound.value === 1 ? '' : 's'} (not counted as dials)`,
    kpis.direction_unknown.value > 0 && `${formatCount(kpis.direction_unknown.value)} older call${kpis.direction_unknown.value === 1 ? '' : 's'} with no direction, counted as outbound`,
  ].filter(Boolean);
  if (!notes.length) return null;
  return (
    <ul aria-label="Notes on these numbers" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {notes.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}

export default function VoiceDashboard({ onNavigate }) {
  const [range, setRange] = useState('today');
  const [agentId, setAgentId] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentOptions, setAgentOptions] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const latestRequest = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const request = ++latestRequest.current;
    if (!quiet) setRefreshing(true);
    try {
      const params = { ...windowFor(range), tz: userTimeZone() };
      if (agentId !== 'all') params.agent_id = agentId;
      const res = await getVoiceDashboardSummary(params);
      if (request !== latestRequest.current) return; // a newer request (filter change) won
      setData(res.data);
      setError(null);
      if (agentId === 'all') setAgentOptions(res.data.agents.filter((a) => a.id != null).map((a) => ({ id: a.id, name: a.name })));
    } catch (err) {
      if (request !== latestRequest.current) return;
      const status = err?.response?.status;
      setError(status === 403 ? 'Your role cannot view voice agents.' : (err?.response?.data?.detail || 'Check your connection and try again.'));
    } finally {
      if (request === latestRequest.current) { setLoading(false); setRefreshing(false); }
    }
  }, [range, agentId]);

  // Load on filter change, then every 30 s while the tab is visible.
  usePolling(() => load({ quiet: true }), REFRESH_MS, [load]);

  const toggleAgent = async (agent, pausing) => {
    setBusyId(agent.id);
    try {
      await (pausing ? pauseAssistant(agent.id) : resumeAssistant(agent.id));
      toast.success(`${agent.name} ${pausing ? 'paused' : 'resumed'}`);
      await load({ quiet: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Could not ${pausing ? 'pause' : 'resume'} ${agent.name}`);
    } finally {
      setBusyId(null);
    }
  };

  const rangeMeta = RANGES.find((r) => r.id === range);
  const compare = rangeMeta.compare;
  const kpis = data?.kpis;
  const calling = data ? data.agents.filter((a) => a.status === 'calling').length : 0;

  return (
    <div className="vd-root ops space-y-6 text-foreground">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vd-accent-ink)]">Voice agent</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {data && <> · {calling} of {data.agents.length} agents calling now</>}
            {data && <> · Updated {formatClock(data.generated_at)} · auto-refresh 30s</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-border bg-[hsl(var(--surface-2))] p-1">
            {RANGES.map((r) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${range === r.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Select value={String(agentId)} onValueChange={(v) => setAgentId(v === 'all' ? 'all' : Number(v))}>
            <SelectTrigger className="w-[170px] bg-card" aria-label="Agent">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agentOptions.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button type="button" onClick={() => load()} disabled={refreshing} aria-label="Refresh the dashboard"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-[hsl(var(--surface-2))] disabled:opacity-60">
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={() => load()} />}
      {loading && !data && !error && <LoadingState />}

      {data && (
        <>
          <AlertBanner alerts={data.alerts} onReviewAgents={() => document.getElementById('vd-agents-title')?.scrollIntoView({ behavior: 'smooth' })} />

          {kpis.dialed.value === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card px-5 py-4 text-sm text-muted-foreground">
              No calls in this period yet. Numbers will appear here as soon as your agents start dialing.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard title="Calls dialed" value={formatCount(kpis.dialed.value)}
                     delta={formatDelta(kpis.dialed, 'count', compare)}
                     definition="Outbound attempts placed in this period; repeat dials within 60 s count once." />
            <KpiCard title="Connect rate" value={formatRate(kpis.connect_rate.value)}
                     qualifier={`${formatCount(kpis.connected.value)} of ${formatCount(kpis.dialed.value)}`}
                     delta={formatDelta(kpis.connect_rate, 'rate', compare)}
                     definition="Calls answered by a person ÷ calls dialed. Voicemail never counts." />
            <KpiCard title="Hot leads" value={formatCount(kpis.hot_leads.value)}
                     qualifier={`of ${formatCount(kpis.interested.value)} interested`}
                     delta={formatDelta(kpis.hot_leads, 'count', compare)}
                     definition="Interested, and booked or showed 2+ buying signals. A fixed rule, not an AI score." />
            <KpiCard title="Avg talk time" value={formatDuration(kpis.avg_talk_seconds.value)}
                     unit={kpis.avg_talk_seconds.value == null ? null : 'min'}
                     delta={formatDelta(kpis.avg_talk_seconds, 'duration', compare)}
                     definition="Mean duration of connected calls only." />
            <KpiCard title="Retry queue" value={formatCount(kpis.retry_queue.total)} unit="leads"
                     footnote={kpis.retry_queue.next_due_at ? `Next retry due ${formatClock(kpis.retry_queue.next_due_at)}` : 'No retries due'}
                     definition={`${formatCount(kpis.retry_queue.from_window)} from this period + ${formatCount(kpis.retry_queue.carried_over)} carried over.`} />
          </div>

          <KpiNotes kpis={kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConversionFunnel funnel={data.funnel} outcomes={data.outcomes} kpis={kpis} />
            <HourlyCallsChart byHour={data.by_hour} bestWindow={data.best_connect_window} multiDay={range !== 'today'} />
          </div>

          <AgentTable
            agents={data.agents}
            busyId={busyId}
            onPause={(agent) => toggleAgent(agent, true)}
            onResume={(agent) => toggleAgent(agent, false)}
            onAssignLeads={() => onNavigate?.('builder')}
            onManageAgents={() => onNavigate?.('create')}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><RecentCalls calls={data.recent_calls} onOpenCallLog={() => onNavigate?.('logs')} /></div>
            <SystemHealth health={data.health} />
          </div>
        </>
      )}
    </div>
  );
}
