import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Loader2, PlugZap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ZohoIntegration from '@/components/integrations/ZohoIntegration';
import { getZohoTenantOverview } from '@/lib/api';

const statusClass = (status) => status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : status === 'ACTION_REQUIRED' ? 'bg-red-500/10 text-red-700 border-red-500/30' : 'bg-muted text-muted-foreground';

export function TenantIntegrationsOverview() {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    try { setRows((await getZohoTenantOverview()).data.tenants || []); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Could not load tenant integrations'); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="max-w-6xl mx-auto space-y-6"><div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold flex gap-2 items-center"><Building2 className="w-6 h-6 text-primary" /> Tenant CRM integrations</h1><p className="text-sm text-muted-foreground mt-1">Each row is independently tenant scoped. Select a tenant before managing its Zoho organisation.</p></div><Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button></div><Card className="card-base p-4">{!rows ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div> : <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Tenant</th><th className="p-2">Zoho organisation</th><th className="p-2">Status</th><th className="p-2">Last sync</th><th className="p-2" /></tr></thead><tbody>{rows.map(({ tenant_id, tenant_name, connection }) => <tr key={tenant_id} className="border-b last:border-0"><td className="p-2 font-medium">{tenant_name}</td><td className="p-2">{connection?.provider_account_id || 'Not connected'}</td><td className="p-2"><Badge variant="outline" className={statusClass(connection?.connection_status)}>{connection?.connection_status || 'NOT_CONNECTED'}</Badge></td><td className="p-2">{connection?.last_successful_sync_at ? new Date(connection.last_successful_sync_at).toLocaleString() : '—'}</td><td className="p-2 text-right"><Button asChild size="sm" variant="outline"><Link to={`/admin/tenants/${tenant_id}/integrations/zoho`}>{connection ? 'Manage' : 'Configure'}</Link></Button></td></tr>)}</tbody></table></div>}</Card></div>;
}

export function TenantZohoIntegration() {
  const { tenantId } = useParams();
  return <div className="max-w-6xl mx-auto space-y-4"><Link to="/admin/integrations" className="text-sm text-primary hover:underline">← All tenant integrations</Link><ZohoIntegration tenantId={tenantId} /></div>;
}
