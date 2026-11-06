import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, Wrench } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import { getAdminOperations, getOrphans, listTenants, reassignOrphan, retryOperation } from '@/lib/api';

const WORKER_STATES = {
  healthy: { label: 'Healthy', className: 'text-emerald-600' },
  late: { label: 'Late', className: 'text-destructive' },
  off: { label: 'Off', className: 'text-muted-foreground' },
};

const stamp = (value) => (value ? new Date(value).toLocaleString() : '—');

const GROUPS = [
  { key: 'jobs', label: 'Failed jobs' },
  { key: 'webhooks', label: 'Failed webhooks' },
  { key: 'emails', label: 'Failed emails' },
  { key: 'syncs', label: 'Failed syncs' },
];

function Failures({ items, onRetry }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">None.</p>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="p-2">Error</th><th className="p-2">Tenant ID</th><th className="p-2">Call ID</th><th className="p-2">Time</th><th className="p-2" /></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.kind}-${item.id}`} className="border-b last:border-0" data-testid={`failure-${item.id}`}>
              <td className="p-2 font-medium">{item.error_code}</td>
              <td className="p-2 text-xs">{item.tenant_id || '—'}</td>
              <td className="p-2 text-xs">{item.call_id || '—'}</td>
              <td className="p-2 text-xs">{item.occurred_at ? new Date(item.occurred_at).toLocaleString() : '—'}</td>
              <td className="p-2 text-right">{item.retryable && <Button variant="outline" size="sm" onClick={() => onRetry(item)}>Retry</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Records whose owner could not be resolved. Only a person assigns one, after typing its id; nothing does it by itself. */
function Orphans({ orphans, tenants, onDone }) {
  const [record, setRecord] = useState(null);
  const [tenantId, setTenantId] = useState('');
  const [typed, setTyped] = useState('');

  const open = (item) => { setRecord(item); setTenantId(''); setTyped(''); };
  const confirm = async (reason) => {
    try {
      await reassignOrphan(record.type, record.id, { tenant_id: tenantId, confirm_record_id: typed.trim(), reason });
      toast.success('Record reassigned');
      setRecord(null);
      await onDone();
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not reassign this record'));
      return false;
    }
  };

  return (
    <Card className="card-base p-5 space-y-3" data-testid="orphans">
      <h2 className="font-semibold">Records with no tenant ({orphans.items.length})</h2>
      <p className="text-xs text-muted-foreground">Tenants can't see these. They stay as they are until someone checks and reassigns them.</p>
      {orphans.items.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="p-2">Type</th><th className="p-2">ID</th><th className="p-2">Created</th><th className="p-2">Why it has no owner</th><th className="p-2" /></tr></thead>
            <tbody>
              {orphans.items.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="border-b last:border-0" data-testid={`orphan-${item.id}`}>
                  <td className="p-2 font-medium">{item.label}{item.has_transcript ? ' · transcript' : ''}{item.has_recording ? ' · recording' : ''}</td>
                  <td className="p-2 text-xs break-all">{item.id}</td>
                  <td className="p-2 text-xs">{item.created_at ? String(item.created_at).slice(0, 19).replace('T', ' ') : '—'}</td>
                  <td className="p-2 text-xs">{item.reason}</td>
                  <td className="p-2 text-right"><Button variant="outline" size="sm" onClick={() => open(item)}>Reassign</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReasonDialog open={Boolean(record)} onOpenChange={(isOpen) => !isOpen && setRecord(null)} title={record ? `Reassign ${record.label} ${record.id}?` : ''}
        description="Only do this once you have verified who owns it. The tenant will be able to see this record." confirmLabel="Reassign"
        canConfirm={Boolean(tenantId) && typed.trim() === record?.id} reasonPlaceholder="How did you verify the owner? It is kept in the platform audit trail." onConfirm={confirm}>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger aria-label="New owner"><SelectValue placeholder="Choose the tenant" /></SelectTrigger>
          <SelectContent>{tenants.filter((t) => t.status === 'active').map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <label className="block text-xs font-medium text-muted-foreground">Type the record's ID to confirm
          <Input className="mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
      </ReasonDialog>
    </Card>
  );
}

/** Failed webhooks, emails, syncs and jobs, worker status, and records with no tenant. Codes and ids only, never content. */
export default function OperationsPage() {
  const [data, setData] = useState(null);
  const [orphans, setOrphans] = useState({ items: [] });
  const [tenants, setTenants] = useState([]);
  const [retrying, setRetrying] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [operations, found] = await Promise.all([getAdminOperations(), getOrphans()]);
      setData(operations.data);
      setOrphans(found?.data || { items: [] });
    } catch (e) { setError(errorText(e, 'Could not load operations')); }
  }, []);
  useEffect(() => {
    load();
    Promise.resolve(listTenants()).then((r) => setTenants(r?.data?.tenants || [])).catch(() => setTenants([]));
  }, [load]);

  const retry = async (reason) => {
    try {
      await retryOperation(retrying.kind, retrying.id, reason);
      toast.success('Queued to run again');
      setRetrying(null);
      await load();
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not retry this'));
      return false;
    }
  };

  return (
    <div className="max-w-6xl space-y-6" data-testid="operations-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Wrench className="w-6 h-6 text-primary" /> Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">What failed, where and when. No message or call content is shown.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data && !error && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>}
      {data && (
        <>
          <Card className="card-base p-5 space-y-3" data-testid="workers">
            <h2 className="font-semibold">Workers</h2>
            {data.workers.length === 0 ? <p className="text-sm text-muted-foreground">No worker has reported yet.</p> : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b"><th className="p-2">Worker</th><th className="p-2">Status</th><th className="p-2">Last successful run</th><th className="p-2">Last failure</th><th className="p-2">Error</th></tr></thead>
                  <tbody>
                    {data.workers.map((worker) => (
                      <tr key={worker.name} className="border-b last:border-0" data-testid={`worker-${worker.name}`}>
                        <td className="p-2 font-medium">{worker.name}</td>
                        <td className={`p-2 ${WORKER_STATES[worker.state]?.className || ''}`}>{WORKER_STATES[worker.state]?.label || worker.state}</td>
                        <td className="p-2 text-xs">{stamp(worker.last_seen_at)}</td>
                        <td className="p-2 text-xs">{stamp(worker.last_error_at)}</td>
                        <td className="p-2 text-xs">{worker.last_error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {GROUPS.map(({ key, label }) => (
            <Card key={key} className="card-base p-5 space-y-3" data-testid={`group-${key}`}>
              <h2 className="font-semibold">{label} ({data.failures[key].length})</h2>
              <Failures items={data.failures[key]} onRetry={setRetrying} />
            </Card>
          ))}
          <Orphans orphans={orphans} tenants={tenants} onDone={load} />
          <p className="text-xs text-muted-foreground">Who did what is in the <Link className="underline" to="/admin/audit-logs">audit log</Link>.</p>
        </>
      )}
      <ReasonDialog open={Boolean(retrying)} onOpenChange={(open) => !open && setRetrying(null)} title="Run this again?"
        description="It goes back in the queue and the normal worker picks it up." confirmLabel="Retry"
        reasonPlaceholder="Why? It is kept in the platform audit trail." onConfirm={retry} />
    </div>
  );
}
