import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Network, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { errorText } from '@/components/admin/userBits';
import { getUserHierarchy } from '@/lib/api';

const TOTALS = [
  { key: 'users', label: 'Total users' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'tenant_admins', label: 'Tenant Admins' },
  { key: 'managers', label: 'Managers' },
  { key: 'sales_reps', label: 'Sales Reps' },
  { key: 'platform_admins', label: 'Platform admins' },
];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Person({ person, role, depth = 0 }) {
  return (
    <li className="py-1.5 text-sm flex flex-wrap items-center gap-x-2" style={{ paddingLeft: `${depth * 24}px` }} data-testid={`person-${person.id}`}>
      <Badge variant="outline" className="text-[11px]">{role}</Badge>
      <span className="font-medium">{person.name}</span>
      <span className="text-muted-foreground">{person.email}</span>
      {person.status !== 'active' && <span className="text-xs text-amber-700 capitalize">{person.status}</span>}
    </li>
  );
}

function Tenant({ tenant }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <Card className="card-base p-4" data-testid={`hierarchy-${tenant.tenant_id}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex flex-wrap items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 font-medium"><Icon className="w-4 h-4" /> {tenant.name}
          {tenant.status !== 'active' && <Badge variant="outline" className="text-destructive border-destructive/40">{tenant.status}</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">
          {plural(tenant.user_count, 'user')} · {plural(tenant.tenant_admins.length, 'admin')} · {plural(tenant.manager_count, 'manager')} · {plural(tenant.sales_rep_count, 'sales rep')}
        </span>
      </button>
      {open && (
        <ul className="mt-3 border-t border-border pt-2">
          {tenant.tenant_admins.length === 0 && <li className="py-1.5 text-sm text-amber-700">No Tenant Admin</li>}
          {tenant.tenant_admins.map((admin) => <Person key={admin.id} person={admin} role="Tenant Admin" />)}
          {tenant.managers.map((manager) => (
            <Fragment key={manager.id}>
              <Person person={manager} role="Manager" depth={1} />
              {manager.sales_reps.map((rep) => <Person key={rep.id} person={rep} role="Sales Rep" depth={2} />)}
              {manager.sales_reps.length === 0 && <li className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: '48px' }}>No sales reps</li>}
            </Fragment>
          ))}
          {tenant.sales_reps_without_team.length > 0 && (
            <>
              <li className="py-1.5 text-sm font-medium" style={{ paddingLeft: '24px' }}>No manager</li>
              {tenant.sales_reps_without_team.map((rep) => <Person key={rep.id} person={rep} role="Sales Rep" depth={2} />)}
            </>
          )}
        </ul>
      )}
    </Card>
  );
}

/** Platform user totals and every tenant's people: admins, managers and their sales reps, by name and email. */
export default function HierarchyPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setError('');
    try { setData((await getUserHierarchy(search ? { q: search } : {})).data); }
    catch (e) { setError(errorText(e, 'Could not load the hierarchy')); }
  }, [search]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl space-y-6" data-testid="hierarchy-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Network className="w-6 h-6 text-primary" /> User hierarchy</h1>
          <p className="text-sm text-muted-foreground mt-1">Everyone on the platform, tenant by tenant. Open a tenant to see its people and teams.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data && !error && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {TOTALS.map(({ key, label }) => (
              <Card key={key} className="card-base p-4" data-testid={`total-${key}`}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-2xl font-semibold tabular-nums">{data.totals[key]}</p>
              </Card>
            ))}
          </div>
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tenants" className="pl-9" aria-label="Search tenants" />
          </div>
          <div className="space-y-2">
            {data.tenants.length === 0
              ? <Card className="card-base p-5 text-sm text-muted-foreground">No tenants match.</Card>
              : data.tenants.map((tenant) => <Tenant key={tenant.tenant_id} tenant={tenant} />)}
          </div>
        </>
      )}
    </div>
  );
}
