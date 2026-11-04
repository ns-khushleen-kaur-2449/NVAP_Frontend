import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ops/States';
import { DataNotAvailable, fetchSection } from '@/lib/analytics/service';
import { DataTable, InfoTip, KpiCard } from './charts';

// The page sets who is asking (used only by the mock) and the filters every section sends with its request.
const AnalyticsContext = createContext({ role: null, filters: {} });
export const AnalyticsProvider = ({ role, filters, children }) => (
  <AnalyticsContext.Provider value={{ role, filters }}>{children}</AnalyticsContext.Provider>
);

const errorText = (e) => e?.response?.data?.detail || e?.message || 'The request failed.';
const isAbort = (e) => e?.name === 'AbortError' || e?.name === 'CanceledError';

/**
 * Loads one section and reloads it when the filters change.
 * status: loading | refreshing (has data, new request running) | ready | stale (refresh failed, older data
 * still shown) | error (nothing to show) | unavailable (the data is not recorded yet).
 */
export function useSection(key) {
  const { role, filters } = useContext(AnalyticsContext);
  const filterKey = JSON.stringify(filters);
  const query = useMemo(() => JSON.parse(filterKey), [filterKey]);
  const [state, setState] = useState({ status: 'loading', data: undefined, error: null, at: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: s.data !== undefined ? 'refreshing' : 'loading' }));
    fetchSection(key, { role, filters: query, signal: controller.signal })
      .then((data) => setState({ status: 'ready', data, error: null, at: new Date() }))
      .catch((e) => {
        if (controller.signal.aborted || isAbort(e)) return;
        if (e instanceof DataNotAvailable) setState({ status: 'unavailable', data: undefined, error: e.message, at: null });
        else setState((s) => (s.data !== undefined ? { ...s, status: 'stale', error: errorText(e) } : { status: 'error', data: undefined, error: errorText(e), at: null }));
      });
    return () => controller.abort();
  }, [key, role, query, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}

const isBlank = (d) => d == null || (Array.isArray(d) && d.length === 0);
const timeOf = (d) => d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Unavailable({ reason }) {
  return (
    <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center">
      <p className="text-sm font-semibold">Data not available yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

function Failed({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[color:var(--ops-bad)]/40 px-4 py-4 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--ops-bad)]" aria-hidden="true" />
      <p className="flex-1"><span className="font-semibold">This could not be loaded.</span> <span className="text-muted-foreground">{message}</span></p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--ops-accent-ink)] hover:underline">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
      </button>
    </div>
  );
}

/**
 * A dashboard card bound to one endpoint. `children(data)` draws the content once data is there; `table(data)`
 * adds a "Show data" table; `isEmpty(data)` decides the empty state (default: nothing or an empty list).
 */
export function Section({ id, title, info, subtitle, action, height = 200, isEmpty = isBlank, empty, table, className, children }) {
  const s = useSection(id);
  const [open, setOpen] = useState(false);
  const hasData = s.data !== undefined && !(s.status === 'loading');
  const blank = hasData && isEmpty(s.data);
  return (
    <section aria-label={title} aria-busy={s.status === 'loading' || s.status === 'refreshing'} data-testid={`section-${id}`}
      className={cn('ops-card flex min-w-0 flex-col p-4', (s.status === 'unavailable' || blank) && 'self-start', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}<InfoTip text={info} label={title} /></h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {hasData && !blank && action}
      </div>

      {s.status === 'stale' && (
        <p role="status" className="ops-tone ops-tone-warn mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-xs">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="flex-1">Could not refresh ({s.error}). Showing data from {timeOf(s.at)}.</span>
          <button type="button" onClick={s.reload} className="font-semibold hover:underline">Try again</button>
        </p>
      )}

      <div className={cn('flex-1 transition-opacity', s.status === 'refreshing' && 'opacity-60')}>
        {s.status === 'loading' && <Skeleton className="w-full" style={{ height }} aria-label={`Loading ${title}`} />}
        {s.status === 'unavailable' && <Unavailable reason={s.error} />}
        {s.status === 'error' && <Failed message={s.error} onRetry={s.reload} />}
        {blank && (
          <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-semibold">{empty?.title || 'Nothing to show for these filters'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{empty?.body || 'Try a longer date range, or all campaigns and channels.'}</p>
          </div>
        )}
        {hasData && !blank && children(s.data)}
      </div>

      {hasData && !blank && table && (
        <div className="mt-3 border-t border-border pt-2">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="text-xs font-semibold text-[color:var(--ops-accent-ink)] hover:underline">{open ? 'Hide data' : 'Show data'}</button>
          {open && <DataTable {...table(s.data)} className="mt-2" />}
        </div>
      )}
    </section>
  );
}

/** KPI tiles from one KPI endpoint, in the given order; same loading / error / stale / empty handling. */
export function KpiRow({ id = 'kpis', ids, cols = 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6' }) {
  const s = useSection(id);
  const kpis = s.data && (ids ? ids.map((k) => s.data.find((x) => x.id === k)).filter(Boolean) : s.data);
  const count = ids?.length || 6;
  return (
    <div aria-label="Key metrics" aria-busy={s.status === 'loading' || s.status === 'refreshing'} className="space-y-2">
      {s.status === 'stale' && (
        <p role="status" className="ops-tone ops-tone-warn flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="flex-1">Metrics could not refresh. Showing data from {timeOf(s.at)}.</span>
          <button type="button" onClick={s.reload} className="font-semibold hover:underline">Try again</button>
        </p>
      )}
      {s.status === 'error' && <Failed message={s.error} onRetry={s.reload} />}
      {s.status === 'unavailable' && <Unavailable reason={s.error} />}
      <div className={cn('grid gap-4', cols, s.status === 'refreshing' && 'opacity-60')}>
        {s.status === 'loading' && Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-[118px]" aria-label="Loading metric" />)}
        {kpis && !kpis.length && <p className="col-span-full text-sm text-muted-foreground">No metrics for these filters.</p>}
        {kpis?.map((k) => <KpiCard key={k.id} kpi={k} />)}
      </div>
    </div>
  );
}

export function SectionTitle({ n, children }) {
  return <h2 className="pt-3 text-lg font-semibold tracking-tight">{n && <span className="text-muted-foreground">{n} · </span>}{children}</h2>;
}

export const Grid = ({ cols = 'lg:grid-cols-2', className, children }) => <div className={cn('grid gap-4', cols, className)}>{children}</div>;
