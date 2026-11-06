import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, OctagonPause, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import {
  enableAdminAgent, getAdminControls, listTenants, pauseAllDialing, pauseTenantDialing, resumeAllDialing, resumeTenantDialing,
} from '@/lib/api';

const when = (value) => (value ? new Date(value).toLocaleString() : '');

/** Emergency actions: they stop new outbound dials. Live calls finish and inbound calls keep working. */
export default function ControlsPage() {
  const [state, setState] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setState((await getAdminControls()).data); }
    catch (e) { setError(errorText(e, 'Could not load the controls')); }
  }, []);

  useEffect(() => {
    load();
    listTenants().then((r) => setTenants(r.data.tenants || [])).catch(() => setTenants([]));
  }, [load]);

  const confirm = async (reason) => {
    try {
      const response = await action.run(reason);
      setState(response.data);
      toast.success(action.done);
      setAction(null);
      return true;
    } catch (e) {
      toast.error(errorText(e, 'That did not work'));
      return false;
    }
  };

  if (!state) {
    return error
      ? <p role="alert" className="text-sm text-destructive">{error}</p>
      : <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  const globalPause = state.global_pause;
  const pausedIds = new Set(state.paused_tenants.map((row) => row.tenant_id));
  const chosen = tenants.find((tenant) => tenant.tenant_id === tenantId);

  return (
    <div className="max-w-5xl space-y-6" data-testid="controls-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><OctagonPause className="w-6 h-6 text-primary" /> Controls</h1>
          <p className="text-sm text-muted-foreground mt-1">Stops new outbound calls, including campaigns and scheduled callbacks. Live calls finish, and inbound calls keep working.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      <Card className={`card-base p-5 space-y-3 ${globalPause.paused ? 'border-destructive/50' : ''}`} data-testid="global-pause">
        <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Whole platform</h2>
        {globalPause.paused
          ? <p className="text-sm">Paused since {when(globalPause.paused_at)}. Reason: {globalPause.reason}</p>
          : <p className="text-sm text-muted-foreground">Outbound calling is running.</p>}
        {globalPause.paused
          ? <Button onClick={() => setAction({ title: 'Resume outbound calling for every tenant?', label: 'Resume', done: 'Outbound calling resumed', run: resumeAllDialing })}>Resume all calling</Button>
          : <Button variant="destructive" onClick={() => setAction({ title: 'Pause outbound calling for every tenant?', description: 'No new call starts until you resume. Waiting contacts stay queued.', label: 'Pause all calling', danger: true, done: 'Outbound calling paused', run: pauseAllDialing })}>Pause all calling</Button>}
      </Card>

      <Card className="card-base p-5 space-y-3">
        <h2 className="font-semibold">One tenant</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-[260px]" aria-label="Tenant to pause"><SelectValue placeholder="Choose a tenant" /></SelectTrigger>
            <SelectContent>{tenants.filter((tenant) => !pausedIds.has(tenant.tenant_id)).map((tenant) => <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>{tenant.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="destructive" disabled={!chosen} onClick={() => setAction({ title: `Pause outbound calling for ${chosen.name}?`, label: 'Pause tenant', danger: true, done: `Calling paused for ${chosen.name}`, run: (reason) => pauseTenantDialing(chosen.tenant_id, reason) })}>Pause tenant</Button>
        </div>
        {state.paused_tenants.length === 0
          ? <p className="text-sm text-muted-foreground">No tenant is paused.</p>
          : (
            <ul className="space-y-2">
              {state.paused_tenants.map((row) => (
                <li key={row.tenant_id} className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid={`paused-tenant-${row.tenant_id}`}>
                  <span><b>{row.name}</b> · since {when(row.paused_at)} · {row.reason}</span>
                  <Button variant="outline" size="sm" onClick={() => setAction({ title: `Resume calling for ${row.name}?`, label: 'Resume', done: `Calling resumed for ${row.name}`, run: (reason) => resumeTenantDialing(row.tenant_id, reason) })}>Resume</Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Card className="card-base p-5 space-y-3">
        <h2 className="font-semibold">Disabled agents</h2>
        <p className="text-xs text-muted-foreground">Disable a broken agent from its page under Agents.</p>
        {state.disabled_agents.length === 0
          ? <p className="text-sm text-muted-foreground">No agent is disabled.</p>
          : (
            <ul className="space-y-2">
              {state.disabled_agents.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span><b>{row.name}</b> · {row.tenant_name || 'Unassigned'}</span>
                  <Button variant="outline" size="sm" onClick={() => setAction({ title: `Enable ${row.name}?`, label: 'Enable', done: `${row.name} enabled`, run: (reason) => enableAdminAgent(row.id, reason) })}>Enable</Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <ReasonDialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)} title={action?.title || ''}
        description={action?.description} confirmLabel={action?.label || 'Confirm'} danger={action?.danger}
        reasonPlaceholder="Why? It is kept in the platform audit trail." onConfirm={confirm} />
    </div>
  );
}
