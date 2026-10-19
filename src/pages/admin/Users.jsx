import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Search, UserCheck, UserX, Users as UsersIcon, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import KpiCard from '@/components/shared/KpiCard';
import UsersTable from '@/components/admin/UsersTable';
import AddUserDialog from '@/components/admin/AddUserDialog';
import EditUserDialog from '@/components/admin/EditUserDialog';
import { errorText } from '@/components/admin/userBits';
import Can from '@/components/auth/Can';
import { deactivateUser, listAdminUsers, listTenants, reactivateUser } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSIONS, ROLES, roleLabel } from '@/lib/rbac';

const PAGE_SIZE = 20;
const ALL = 'all';
const ROLE_FILTERS = {
  super_admin: ['super_admin', 'tenant_admin', 'manager', 'rep'],
  tenant_admin: ['tenant_admin', 'manager', 'rep'],
  manager: ['manager', 'rep'],
};

/** Users the current user may see (tenant admins: their tenant; managers: their team). */
export default function UsersPage() {
  const { user: actor } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [tenantId, setTenantId] = useState(ALL);
  const [tenants, setTenants] = useState([]);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const isSuperAdmin = actor?.role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isSuperAdmin) listTenants().then((r) => setTenants(r.data.tenants || [])).catch(() => setTenants([]));
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) params.q = search;
      if (role !== ALL) params.role = role;
      if (status !== ALL) params.status = status;
      if (isSuperAdmin && tenantId !== ALL) params.tenant_id = tenantId;
      const response = await listAdminUsers(params);
      setData(response.data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status, tenantId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row) => {
    const active = (row.status || '').toLowerCase() === 'active';
    setBusyId(row.id);
    try {
      if (active) await deactivateUser(row.id);
      else await reactivateUser(row.id);
      toast.success(active ? `${row.name} deactivated` : `${row.name} reactivated`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not change the user'));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  };

  const stats = data?.stats || { total: 0, active: 0, inactive: 0, not_logged_in: 0 };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filterChange = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="users-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><UsersIcon className="w-6 h-6 text-primary" /> Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {actor?.role === ROLES.MANAGER ? 'You and the Sales Reps in your team.' : isSuperAdmin ? 'Users across all tenants.' : 'Everyone in your organisation.'}
          </p>
        </div>
        <Can perm={PERMISSIONS.USERS_CREATE}>
          <Button onClick={() => setAdding(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Add user</Button>
        </Can>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total" value={stats.total} icon={UsersIcon} />
        <KpiCard title="Active" value={stats.active} icon={UserCheck} color="#059669" />
        <KpiCard title="Inactive" value={stats.inactive} icon={UserX} color="#64748b" />
        <KpiCard title="Not logged in" value={stats.not_logged_in} icon={Clock} color="#d97706" subtitle="Never signed in yet" />
      </div>

      <Card className="card-base p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
          </div>
          {isSuperAdmin && (
            <Select value={tenantId} onValueChange={filterChange(setTenantId)}>
              <SelectTrigger className="w-[180px]" aria-label="Tenant filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tenants</SelectItem>
                {tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={role} onValueChange={filterChange(setRole)}>
            <SelectTrigger className="w-[150px]" aria-label="Role filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {(ROLE_FILTERS[actor?.role] || []).map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={filterChange(setStatus)}>
            <SelectTrigger className="w-[150px]" aria-label="Status filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="not_logged_in">Not logged in</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <UsersTable users={data?.users || []} actor={actor} showTenant={isSuperAdmin} busyId={busyId}
            onEdit={setEditing} onToggleActive={(row) => setConfirming(row)} />
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data ? `${data.total} user${data.total === 1 ? '' : 's'}` : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <AddUserDialog open={adding} onOpenChange={setAdding} onCreated={load} />
      <EditUserDialog user={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={load} />
      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming && ((confirming.status || '').toLowerCase() === 'active' ? `Deactivate ${confirming.name}?` : `Reactivate ${confirming.name}?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && ((confirming.status || '').toLowerCase() === 'active'
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
