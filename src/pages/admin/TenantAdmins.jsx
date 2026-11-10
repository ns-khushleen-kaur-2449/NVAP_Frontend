import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Loader2, Plus, Power, PowerOff, RefreshCw, Search, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { errorText, EMAIL_IN_USE, EmailInUse } from '@/components/admin/userBits';
import {
  createTenantAdmin, deactivateTenantAdmin, listTenantAdmins, listTenants, reactivateTenantAdmin,
} from '@/lib/api';
import { generateTemporaryPassword } from '@/lib/passwords';

const PAGE_SIZE = 20;
const ALL = 'all';
const isActive = (row) => (row.status || '').toLowerCase() === 'active';

function AddTenantAdminDialog({ open, onOpenChange, tenants, defaultTenant, onCreated }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({ name: '', email: '', password: generateTemporaryPassword(), tenant_id: defaultTenant || '' });
    setError(null);
    setCreated(null);
  }, [open, defaultTenant]);

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const problems = [];
    if (!form.name.trim()) problems.push('Name is required');
    if (!form.email.trim()) problems.push('Email is required');
    if (!form.tenant_id) problems.push('Choose a tenant');
    if (problems.length) { setError(problems.join('. ')); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await createTenantAdmin({ ...form, name: form.name.trim(), email: form.email.trim() });
      setCreated({ email: response.data.user.email, password: form.password });
      onCreated?.();
    } catch (e) {
      setError(errorText(e, 'Could not create the Tenant Admin'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Tenant Admin</DialogTitle>
          <DialogDescription>They sign in with a temporary password and must choose their own at first login.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3" data-testid="tenant-admin-created">
            <p className="text-sm">Created <span className="font-medium">{created.email}</span>. Share this temporary password with them securely:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">{created.password}</code>
              <Button variant="outline" size="icon" aria-label="Copy password"
                onClick={() => navigator.clipboard?.writeText(created.password).then(() => toast.success('Copied'))}><Copy className="w-4 h-4" /></Button>
            </div>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Name
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Email
              <Input type="email" aria-invalid={error === EMAIL_IN_USE} aria-describedby={error === EMAIL_IN_USE ? 'tenant-admin-email-error' : undefined} value={form.email} onChange={(e) => set({ email: e.target.value })} className="mt-1" />
            </label>
            <EmailInUse error={error} id="tenant-admin-email-error" />
            <label className="block text-xs font-medium text-muted-foreground">Temporary password
              <div className="flex gap-2 mt-1">
                <Input value={form.password} onChange={(e) => set({ password: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="Generate password"
                  onClick={() => set({ password: generateTemporaryPassword() })}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </label>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tenant</span>
              <Select value={form.tenant_id} onValueChange={(tenant_id) => set({ tenant_id })}>
                <SelectTrigger className="mt-1" aria-label="Tenant"><SelectValue placeholder="Choose a tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.filter((t) => t.status === 'active').map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error && error !== EMAIL_IN_USE && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Tenant Admin</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tenant Admins across all tenants (GET /api/admin/tenant-admins). Managers and Sales Reps are never listed here. */
export default function TenantAdminsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [tenantId, setTenantId] = useState(searchParams.get('tenant_id') || ALL);
  const [tenants, setTenants] = useState([]);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    listTenants().then((r) => setTenants(r.data.tenants || []))
      .catch((e) => { setTenants([]); toast.error(errorText(e, 'Could not load the tenant list')); });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) params.q = search;
      if (status !== ALL) params.status = status;
      if (tenantId !== ALL) params.tenant_id = tenantId;
      setData((await listTenantAdmins(params)).data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load Tenant Admins'));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, tenantId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row) => {
    setBusyId(row.id);
    try {
      if (isActive(row)) await deactivateTenantAdmin(row.id);
      else await reactivateTenantAdmin(row.id);
      toast.success(isActive(row) ? `${row.name} deactivated` : `${row.name} reactivated`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not change the account'));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filterChange = (setter) => (value) => { setter(value); setPage(1); };
  const rows = data?.users || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="tenant-admins-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><UsersRound className="w-6 h-6 text-primary" /> Tenant admins</h1>
          <p className="text-sm text-muted-foreground mt-1">The people who run each tenant. Their own teams stay with them.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Add Tenant Admin</Button>
      </div>

      <Card className="card-base p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search Tenant Admins" />
          </div>
          <Select value={tenantId} onValueChange={filterChange(setTenantId)}>
            <SelectTrigger className="w-[180px]" aria-label="Tenant filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All tenants</SelectItem>
              {tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={filterChange(setStatus)}>
            <SelectTrigger className="w-[150px]" aria-label="Status filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-8 text-center">No Tenant Admins match.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead><TableHead>Last login</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid={`tenant-admin-row-${row.id}`}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm">{row.email}</TableCell>
                    <TableCell className="text-sm">{row.tenant_name || '—'}</TableCell>
                    <TableCell className="text-sm capitalize">{row.status}</TableCell>
                    <TableCell className="text-sm">{row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Never'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${isActive(row) ? 'text-red-600' : ''}`}
                        title={isActive(row) ? 'Deactivate' : 'Reactivate'} aria-label={`${isActive(row) ? 'Deactivate' : 'Reactivate'} ${row.name}`}
                        onClick={() => setConfirming(row)} disabled={busyId === row.id}>
                        {isActive(row) ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data ? `${data.total} Tenant Admin${data.total === 1 ? '' : 's'}` : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <AddTenantAdminDialog open={adding} onOpenChange={setAdding} tenants={tenants}
        defaultTenant={tenantId !== ALL ? tenantId : ''} onCreated={load} />
      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && `${isActive(confirming) ? 'Deactivate' : 'Reactivate'} ${confirming.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && (isActive(confirming)
                ? 'They will be signed out at once and cannot log in. Nothing they own is deleted.'
                : 'They will be able to log in again.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleActive(confirming)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
