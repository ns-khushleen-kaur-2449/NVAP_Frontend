import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorText } from '@/components/admin/userBits';
import TenantSettingsDialog from '@/components/admin/TenantSettingsDialog';
import { getAdminUsage } from '@/lib/api';

const money = (value) => (value === null || value === undefined ? 'Unknown' : `$${value.toFixed(2)}`);
const WARNINGS = { near: 'Near limit', over: 'Over limit' };

function UsedOf({ seat }) {
  if (!seat) return '—';
  return <span className={seat.full ? 'text-amber-700 font-medium' : ''}>{seat.used} / {seat.limit ?? 'No limit'}{seat.extra ? ` (+${seat.extra} override)` : ''}</span>;
}

/** Calls, minutes, provider cost and seats per tenant this month, with limit warnings. Calls before cost was stored are unknown. */
export default function UsagePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { setData((await getAdminUsage()).data); }
    catch (e) { setError(errorText(e, 'Could not load usage')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl space-y-6" data-testid="usage-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> Usage</h1>
          <p className="text-sm text-muted-foreground mt-1">This month, per tenant. Monthly minutes only warn. Monthly calls stop new outbound calls, and seat limits stop new users, once a tenant is full.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data && !error && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-base p-5"><p className="text-sm text-muted-foreground">Calls</p><p className="font-display text-2xl font-semibold tabular-nums" data-testid="usage-calls">{data.totals.calls}</p></Card>
            <Card className="card-base p-5"><p className="text-sm text-muted-foreground">Minutes</p><p className="font-display text-2xl font-semibold tabular-nums">{data.totals.minutes}</p></Card>
            <Card className="card-base p-5"><p className="text-sm text-muted-foreground">Provider cost</p><p className="font-display text-2xl font-semibold tabular-nums" data-testid="usage-cost">{money(data.totals.cost)}</p>
              {data.totals.calls_with_unknown_cost > 0 && <p className="text-xs text-muted-foreground mt-1">{data.totals.calls_with_unknown_cost} calls have no known cost</p>}</Card>
          </div>
          <Card className="card-base p-4 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="p-2">Tenant</th><th className="p-2">Calls</th><th className="p-2">Minutes</th><th className="p-2">Minutes limit</th><th className="p-2">Outbound calls</th><th className="p-2">Cost</th><th className="p-2">Managers</th><th className="p-2">Sales reps</th><th className="p-2" /><th className="p-2" /></tr></thead>
              <tbody>
                {data.tenants.map((row) => (
                  <tr key={row.tenant_id} className="border-b last:border-0" data-testid={`usage-row-${row.tenant_id}`}>
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2 tabular-nums">{row.calls}</td>
                    <td className="p-2 tabular-nums">{row.minutes}</td>
                    <td className="p-2 tabular-nums">{row.monthly_minutes_limit ?? 'None'}</td>
                    <td className="p-2 tabular-nums"><UsedOf seat={row.monthly_calls} /></td>
                    <td className="p-2 tabular-nums">{money(row.cost)}</td>
                    <td className="p-2 tabular-nums"><UsedOf seat={row.manager_seats} /></td>
                    <td className="p-2 tabular-nums"><UsedOf seat={row.rep_seats} /></td>
                    <td className="p-2">{row.limit_warning && <Badge variant="outline" className={row.limit_warning === 'over' ? 'text-destructive border-destructive/40' : 'text-amber-700 border-amber-500/40'}>{WARNINGS[row.limit_warning]}</Badge>}</td>
                    <td className="p-2 text-right"><Button variant="outline" size="sm" onClick={() => setEditing(row)}>Edit limits</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      <TenantSettingsDialog tenant={editing} onOpenChange={(open) => { if (!open) { setEditing(null); load(); } }} />
    </div>
  );
}
