import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getIntegrationStatus } from '@/lib/api';

const statusClass = (status) => {
  if (status === 'CONNECTED') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
  if (status === 'ACTION_REQUIRED') return 'bg-red-500/10 text-red-700 border-red-500/30';
  return 'bg-muted text-muted-foreground';
};

/** Each tenant's CRM connection, status only. A tenant's Tenant Admin connects and manages it in their own Settings. */
export default function IntegrationsPage() {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    try { setRows((await getIntegrationStatus()).data.tenants || []); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Could not load tenant integrations'); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="integrations-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex gap-2 items-center"><Building2 className="w-6 h-6 text-primary" /> Tenant CRM integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connection status only. Each tenant's Tenant Admin manages their own connection.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      <Card className="card-base p-4">
        {!rows ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="p-2">Tenant</th><th className="p-2">Status</th><th className="p-2">Last sync</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tenant_id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{row.tenant_name}</td>
                    <td className="p-2"><Badge variant="outline" className={statusClass(row.connection_status)}>{row.connection_status}</Badge></td>
                    <td className="p-2">{row.last_successful_sync_at ? new Date(row.last_successful_sync_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
