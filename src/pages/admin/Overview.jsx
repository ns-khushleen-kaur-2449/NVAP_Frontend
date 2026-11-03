import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, LayoutDashboard, PauseCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/components/admin/userBits';
import { getAdminOverview } from '@/lib/api';

const TILES = [
  { key: 'total', label: 'Tenants', icon: Building2 },
  { key: 'active', label: 'Active', icon: CheckCircle2 },
  { key: 'suspended', label: 'Suspended', icon: PauseCircle },
];

/** Platform overview: aggregate tenant counts from GET /api/admin/overview (Super Admin only). */
export default function AdminOverviewPage() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminOverview();
      setCounts(response.data.tenants);
    } catch (e) {
      setError(errorText(e, 'Could not load the overview'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    </div>
  );
}
