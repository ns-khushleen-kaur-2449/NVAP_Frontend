import { Fragment, useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { getAdminAuditLogs } from '@/lib/api';
import { errorText } from '@/components/admin/userBits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 25;
const pretty = (value) => value ? new Date(value).toLocaleString() : '—';

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({ actor_user_id: '', tenant_id: '', action: '', resource_type: '', outcome: '', date_from: '', date_to: '', sort: 'newest' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, page_size: PAGE_SIZE };
      Object.entries(applied).forEach(([key, value]) => { if (value) params[key] = value; });
      const response = await getAdminAuditLogs(params);
      setResult(response.data);
    } catch (err) {
      setError(errorText(err, 'Could not load audit logs'));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);
  const change = (key) => (event) => setFilters((old) => ({ ...old, [key]: event.target.value }));
  const apply = (event) => {
    event.preventDefault();
    const next = Object.fromEntries(Object.entries(filters).filter(([key, value]) => key === 'sort' || value.trim()).map(([key, value]) =>
      (key === 'date_from' || key === 'date_to') && value ? [key, new Date(value).toISOString()] : [key, value]));
    setPage(1);
    setApplied(next);
  };
  const pages = Math.max(1, Math.ceil((result?.total || 0) / PAGE_SIZE));

  return <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-audit-logs">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="font-display text-2xl font-semibold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" /> Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Administrative activity, newest first.</p></div>
      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
    </div>

    <Card className="card-base p-4">
      <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={apply}>
        <Input aria-label="Actor user ID" placeholder="Actor user ID" inputMode="numeric" value={filters.actor_user_id} onChange={change('actor_user_id')} />
        <Input aria-label="Tenant ID" placeholder="Tenant UUID" value={filters.tenant_id} onChange={change('tenant_id')} />
        <Input aria-label="Action" placeholder="Action (e.g. tenant.suspend)" value={filters.action} onChange={change('action')} />
        <Input aria-label="Resource type" placeholder="Resource type" value={filters.resource_type} onChange={change('resource_type')} />
        <select aria-label="Outcome" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filters.outcome} onChange={change('outcome')}>
          <option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failed</option><option value="denied">Denied</option>
        </select>
        <Input aria-label="From date" type="datetime-local" value={filters.date_from} onChange={change('date_from')} />
        <Input aria-label="To date" type="datetime-local" value={filters.date_to} onChange={change('date_to')} />
        <select aria-label="Sort order" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filters.sort} onChange={change('sort')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <Button type="submit">Apply filters</Button>
      </form>
    </Card>

    {error && <Card role="alert" className="p-4 border-destructive text-sm">{error}</Card>}
    <Card className="card-base p-3">
      {loading && !result ? <p className="py-8 text-center text-sm text-muted-foreground">Loading audit logs…</p> : result?.items?.length ? <div className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Tenant</TableHead><TableHead>Outcome</TableHead><TableHead>IP</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{result.items.map((item) => <Fragment key={item.id}>
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">{pretty(item.created_at)}</TableCell>
              <TableCell>{item.actor_role || 'User'} #{item.actor_user_id}</TableCell>
              <TableCell className="font-mono text-xs">{item.action}</TableCell>
              <TableCell>{item.resource_type}{item.resource_id ? ` · ${item.resource_id}` : ''}</TableCell>
              <TableCell>{item.tenant_name || item.tenant_id || 'Platform'}</TableCell>
              <TableCell><Badge variant={item.outcome === 'success' ? 'secondary' : 'destructive'}>{item.outcome}</Badge></TableCell>
              <TableCell>{item.ip_address || '—'}</TableCell>
              <TableCell><Button variant="link" size="sm" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? 'Hide' : 'View'}</Button></TableCell>
            </TableRow>
            {expanded === item.id && <TableRow key={`${item.id}-details`}><TableCell colSpan={8}>
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div><strong>Reason</strong><p className="whitespace-pre-wrap">{item.reason || '—'}</p></div>
                <div><strong>Before</strong><pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(item.before || {}, null, 2)}</pre></div>
                <div><strong>After</strong><pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(item.after || {}, null, 2)}</pre></div>
              </div>
            </TableCell></TableRow>}
          </Fragment>)}</TableBody>
        </Table>
      </div> : !loading ? <p className="py-10 text-center text-sm text-muted-foreground">No audit events match these filters.</p> : null}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground"><span>{result ? `${result.total} event${result.total === 1 ? '' : 's'}` : ''}</span>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
      </div>
    </Card>
  </div>;
}
