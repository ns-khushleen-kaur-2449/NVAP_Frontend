import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listAdminAgents, listTenants } from '@/lib/api';

const PAGE_SIZE = 50;
const ALL = 'all';
const PUBLISH_LABELS = { live: 'Live', paused: 'Paused', draft: 'Draft', not_published: 'Not published' };

/** Every agent on the platform, imported or built by a tenant. Metadata only. */
export default function AgentsPage() {
  // Nothing until the backend answers, so a failed load never shows as "0 agents".
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState(ALL);
  const [tenantId, setTenantId] = useState(ALL);
  const [tenants, setTenants] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    listTenants().then((r) => setTenants(r.data.tenants || []))
      .catch(() => { setTenants([]); setError('Could not load the tenant list, so the tenant filter is empty.'); });
  }, []);

  const load = useCallback(() => {
    const params = { page, page_size: PAGE_SIZE };
    if (search) params.q = search;
    if (source !== ALL) params.source = source;
    if (tenantId !== ALL) params.tenant_id = tenantId;
    setError('');
    return listAdminAgents(params).then((r) => setData(r.data)).catch(() => setError('Could not load agents.'));
  }, [page, search, source, tenantId]);
  useEffect(() => { load(); }, [load]);

  const pick = (setter) => (value) => { setter(value); setPage(1); };
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const agents = data?.agents || [];

  return <div className="max-w-5xl space-y-5">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold flex gap-2 items-center"><Bot className="w-6 h-6" />Agents</h1><p className="text-sm text-muted-foreground">Every agent on the platform: ones you imported and ones tenants built.</p></div><Button asChild><Link to="/admin/agents/import"><Plus className="w-4 h-4 mr-1" />Import</Link></Button></header>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or Vapi ID" className="pl-9" aria-label="Search agents" />
      </div>
      <Select value={source} onValueChange={pick(setSource)}>
        <SelectTrigger className="w-[160px]" aria-label="Source filter"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All agents</SelectItem>
          <SelectItem value="imported">Imported</SelectItem>
          <SelectItem value="tenant">Built by tenants</SelectItem>
        </SelectContent>
      </Select>
      <Select value={tenantId} onValueChange={pick(setTenantId)}>
        <SelectTrigger className="w-[180px]" aria-label="Tenant filter"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tenants</SelectItem>
          {tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh list</Button>
    </div>
    <div className="space-y-2">{agents.length ? agents.map((agent) => (
      <Card className="card-base p-4" key={agent.id} data-testid={`agent-row-${agent.id}`}>
        <Link to={`/admin/agents/${agent.id}`} className="flex flex-wrap justify-between gap-3">
          <span className="min-w-0">
            <b>{agent.name || 'Unnamed assistant'}</b>
            <span className="block text-xs text-muted-foreground break-all">{agent.vapi_assistant_id}</span>
            <span className="block text-xs text-muted-foreground mt-1">
              Voice: {agent.voice?.voice_id || '—'} · Language: {agent.language || '—'} · {agent.tools?.length || 0} tool{agent.tools?.length === 1 ? '' : 's'}
            </span>
          </span>
          <span className="text-sm text-right space-y-1">
            <span className="block">{agent.owner?.tenant_name || 'Unassigned'}</span>
            <span className="flex justify-end gap-1">
              <Badge variant="outline">{agent.source === 'tenant' ? 'Built by tenant' : 'Imported'}</Badge>
              <Badge variant="outline">{PUBLISH_LABELS[agent.publish_status] || agent.publish_status}</Badge>
            </span>
          </span>
        </Link>
      </Card>
    )) : data ? <Card className="card-base p-5 text-sm text-muted-foreground">No agents match.</Card> : null}</div>
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{data ? `${data.total} agent${data.total === 1 ? '' : 's'}` : ''}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  </div>;
}
