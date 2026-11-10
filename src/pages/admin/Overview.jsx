import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Building2, CheckCircle2, LayoutDashboard, PauseCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/components/admin/userBits';
import { getAdminOverview } from '@/lib/api';
import PeriodPicker, { DEFAULT_PERIOD, periodRange } from '@/components/admin/PeriodPicker';

const TILES = [
  { key: 'total', label: 'Tenants', icon: Building2 },
  { key: 'active', label: 'Active', icon: CheckCircle2 },
  { key: 'suspended', label: 'Suspended', icon: PauseCircle },
];

const USAGE = [
  { key: 'calls', label: 'Dial attempts' },
  { key: 'connected', label: 'Connected' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'cost', label: 'Provider cost', format: (value) => (value === null || value === undefined ? 'Unknown' : `$${value.toFixed(2)}`) },
];

const WORKER_STATES = {
  healthy: { label: 'Healthy', className: 'text-emerald-600' },
  late: { label: 'Late', className: 'text-destructive' },
  off: { label: 'Off', className: 'text-muted-foreground' },
};

// Every other code (workers_late, failed_*) belongs on Operations.
const ALERT_LINKS = {
  platform_paused: '/admin/controls', tenants_paused: '/admin/controls', limit_warnings: '/admin/usage', limit_warnings_calls: '/admin/usage',
};

/** Platform health, active alerts and key usage from GET /api/admin/overview. Numbers only (Super Admin). */
export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState(DEFAULT_PERIOD);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const asked = ++latest.current; // a slower, older reply must not replace the period just chosen
    setLoading(true);
    setError(null);
    try {
      const { data: next } = await getAdminOverview(query);
      if (asked === latest.current) setData(next);
    } catch (e) {
      if (asked === latest.current) setError(errorText(e, 'Could not load the overview'));
    } finally {
      if (asked === latest.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const counts = data?.tenants;
  const alerts = data?.alerts || [];
  const workers = data?.health?.workers || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" /> Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">The platform at a glance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="card-base p-4 flex items-start gap-3 border-destructive/40" role="alert" data-testid="overview-error">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium">The overview could not be loaded</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TILES.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="card-base p-5" data-testid={`overview-${key}`}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="w-4 h-4" /> {label}
            </div>
            {loading && !counts
              ? <Skeleton className="h-9 w-16 mt-2" aria-label="Loading" />
              : <p className="font-display text-3xl font-semibold mt-1 tabular-nums">{counts ? counts[key] : '—'}</p>}
          </Card>
        ))}
      </div>

      {data && (
        <>
          <Card className="card-base p-5" data-testid="overview-alerts">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Active alerts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Right now, whatever period is chosen below.</p>
            {alerts.length === 0
              ? <p className="text-sm text-muted-foreground mt-2">Nothing needs attention.</p>
              : (
                <ul className="mt-3 space-y-2">
                  {alerts.map((alert) => (
                    <li key={alert.code} className="flex items-center justify-between gap-3 text-sm">
                      <span className={alert.severity === 'critical' ? 'font-medium text-destructive' : ''}>
                        {alert.label}{alert.count ? ` (${alert.count})` : ''}
                      </span>
                      <Link className="underline text-xs" to={ALERT_LINKS[alert.code] || '/admin/operations'}>Open</Link>
                    </li>
                  ))}
                </ul>
              )}
          </Card>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-semibold">{data.period?.label || 'Usage'}</h2>
                <p className="text-xs text-muted-foreground" data-testid="overview-period">{periodRange(data.period)}</p>
              </div>
              <PeriodPicker value={query} months={data.months} onChange={setQuery} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {USAGE.map(({ key, label, format }) => (
                <Card key={key} className="card-base p-5" data-testid={`overview-usage-${key}`}>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-display text-2xl font-semibold mt-1 tabular-nums">{format ? format(data.usage?.[key]) : data.usage?.[key] ?? '—'}</p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="card-base p-5" data-testid="overview-health">
            <h2 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> Platform health</h2>
            {workers.length === 0
              ? <p className="text-sm text-muted-foreground mt-2">No background worker has reported yet.</p>
              : (
                <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                  {workers.map((worker) => (
                    <li key={worker.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{worker.name}</span>
                      <span className={WORKER_STATES[worker.state]?.className}>
                        {WORKER_STATES[worker.state]?.label || worker.state}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </>
      )}
    </div>
  );
}
