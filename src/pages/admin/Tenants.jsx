import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Copy, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReasonDialog from '@/components/ops/ReasonDialog';
import CallingBoundDialog from '@/components/admin/CallingBoundDialog';
import TenantSettingsDialog from '@/components/admin/TenantSettingsDialog';
import { errorText, EMAIL_IN_USE, EmailInUse } from '@/components/admin/userBits';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  activateTenant, addTenantPhoneNumber, cancelTenantOffboarding, createTenantWithAdmin, initiateTenantOffboarding,
  listAdminTenants, listTenantPhoneNumbers, removeTenantPhoneNumber, setTenantApolloAccess, suspendTenant,
} from '@/lib/api';
import { generateTemporaryPassword } from '@/lib/passwords';

const STATUS_STYLES = {
  active: 'text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  suspended: 'text-[11px] bg-red-500/10 text-red-600 border-red-500/25',
};
const statusLabel = (status) => (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');

/** The plan from Stripe billing; a tenant with no paid plan is Free. */
function PlanCell({ plan }) {
  if (!plan) return <span className="text-muted-foreground">Unknown</span>;
  const unpaid = plan.key && plan.status && !['active', 'trialing'].includes(plan.status);
  return (
    <div>
      <p className="font-medium">{plan.name}{plan.interval ? <span className="text-xs text-muted-foreground"> · {plan.interval}</span> : null}</p>
      {unpaid && <p className="text-xs text-amber-700">{plan.status.replace(/_/g, ' ')}</p>}
      {plan.cancel_at_period_end && plan.current_period_end && (
        <p className="text-xs text-muted-foreground">Ends {new Date(plan.current_period_end).toLocaleDateString()}</p>
      )}
    </div>
  );
}

function NewTenantDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({ name: '', default_timezone: 'Asia/Kolkata', admin_name: '', admin_email: '', password: generateTemporaryPassword() });
    setError(null);
    setCreated(null);
  }, [open]);

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim() || !form.admin_name.trim() || !form.admin_email.trim()) {
      setError('Tenant name, admin name and admin email are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createTenantWithAdmin({
        name: form.name.trim(), default_timezone: form.default_timezone.trim() || 'Asia/Kolkata',
        admin: { name: form.admin_name.trim(), email: form.admin_email.trim(), password: form.password },
      });
      setCreated({ tenant: response.data.tenant.name, email: response.data.admin.email, password: form.password });
      onCreated?.();
    } catch (e) {
      setError(errorText(e, 'Could not create the tenant'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New tenant</DialogTitle>
          <DialogDescription>Creates the organisation and its first Tenant Admin, who must change the temporary password at first login.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3" data-testid="tenant-created">
            <p className="text-sm"><span className="font-medium">{created.tenant}</span> is ready. Share these sign-in details with {created.email} securely:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">{created.password}</code>
              <Button variant="outline" size="icon" aria-label="Copy password"
                onClick={() => navigator.clipboard?.writeText(created.password).then(() => toast.success('Copied'))}><Copy className="w-4 h-4" /></Button>
            </div>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Tenant name
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Default time zone
              <Input value={form.default_timezone} onChange={(e) => set({ default_timezone: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">First admin name
              <Input value={form.admin_name} onChange={(e) => set({ admin_name: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">First admin email
              <Input type="email" aria-invalid={error === EMAIL_IN_USE} aria-describedby={error === EMAIL_IN_USE ? 'new-tenant-email-error' : undefined} value={form.admin_email} onChange={(e) => set({ admin_email: e.target.value })} className="mt-1" />
            </label>
            <EmailInUse error={error} id="new-tenant-email-error" />
            <label className="block text-xs font-medium text-muted-foreground">Temporary password
              <div className="flex gap-2 mt-1">
                <Input value={form.password} onChange={(e) => set({ password: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="Generate password"
                  onClick={() => set({ password: generateTemporaryPassword() })}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </label>
            {error && error !== EMAIL_IN_USE && <p className="text-xs text-red-600" role="alert">{error}</p>}
            <DialogFooter>
              <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create tenant
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Super Admin: the Vapi phone numbers a tenant's admins may attach to its assistants.  Nothing here contacts Vapi. */
function PhoneNumbersDialog({ tenant, onClose }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ vapi_phone_number_id: '', label: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows((await listTenantPhoneNumbers(tenant.tenant_id)).data);
    } catch (e) {
      setError(errorText(e, 'Could not load phone numbers'));
      setRows([]);
    }
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    setRows(null);
    setError(null);
    setForm({ vapi_phone_number_id: '', label: '' });
    load();
  }, [tenant, load]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const add = async () => {
    if (!form.vapi_phone_number_id.trim()) { setError('A Vapi phone number id is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await addTenantPhoneNumber(tenant.tenant_id, {
        vapi_phone_number_id: form.vapi_phone_number_id.trim(), label: form.label.trim() || null,
      });
      setForm({ vapi_phone_number_id: '', label: '' });
      await load();
    } catch (e) {
      setError(errorText(e, 'Could not add the phone number'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row) => {
    try {
      await removeTenantPhoneNumber(tenant.tenant_id, row.id);
      toast.success('Phone number removed');
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not remove the phone number'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <Dialog open={Boolean(tenant)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[620px]" data-testid="tenant-phone-numbers-dialog">
          <DialogHeader>
            <DialogTitle>Phone numbers of {tenant?.name}</DialogTitle>
            <DialogDescription>
              The Vapi phone numbers this tenant's admins may attach to its assistants. A number belongs to one tenant at most.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border overflow-x-auto">
            {!rows ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                Nothing given yet: this tenant's admins can't attach any number until you add one.
              </p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Vapi number id</TableHead><TableHead>Label</TableHead><TableHead>Added</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><code className="text-xs">{row.vapi_phone_number_id}</code></TableCell>
                      <TableCell className="text-sm">{row.label || '—'}</TableCell>
                      <TableCell className="text-sm">{new Date(row.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${row.label || row.vapi_phone_number_id}`}
                          onClick={() => setRemoving(row)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">Vapi phone number id
              <Input value={form.vapi_phone_number_id} onChange={(e) => set({ vapi_phone_number_id: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Label
              <Input value={form.label} onChange={(e) => set({ label: e.target.value })} className="mt-1" placeholder="Sales line" />
            </label>
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <DialogFooter>
            <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Add number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.label || removing?.vapi_phone_number_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {tenant?.name}'s admins can no longer attach it. An assistant it is already attached to keeps it in Vapi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove(removing)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Super Admin: every tenant, with its users; create, suspend and activate, grant Apollo access and give phone numbers. */
export default function TenantsPage() {
  const [tenants, setTenants] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [offboarding, setOffboarding] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [apolloChange, setApolloChange] = useState(null);
  const [bounding, setBounding] = useState(null);
  const [settingsOf, setSettingsOf] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [numbersFor, setNumbersFor] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await listAdminTenants({ page, page_size: 25, q: query || undefined, status: statusFilter || undefined });
      setTenants(response.data.tenants || []);
      setTotal(response.data.total || 0);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load tenants'));
      setTenants([]);
    }
  }, [page, query, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // The reason is required by the backend and kept in the admin audit trail.
  const toggle = async (tenant, reason) => {
    const suspend = tenant.status === 'active';
    setBusyId(tenant.tenant_id);
    try {
      if (suspend) await suspendTenant(tenant.tenant_id, reason);
      else await activateTenant(tenant.tenant_id, reason);
      toast.success(suspend ? `${tenant.name} suspended` : `${tenant.name} activated`);
      await load();
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not change the tenant'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Start (or, with cancel, undo) offboarding; both need a reason kept in the platform audit trail.
  const changeOffboarding = async (tenant, reason, cancel = false) => {
    setBusyId(tenant.tenant_id);
    try {
      if (cancel) await cancelTenantOffboarding(tenant.tenant_id, reason);
      else await initiateTenantOffboarding(tenant.tenant_id, reason);
      toast.success(cancel ? `Offboarding cancelled for ${tenant.name}` : `Offboarding initiated for ${tenant.name}`);
      await load();
      return true;
    } catch (e) {
      toast.error(errorText(e, cancel ? 'Could not cancel offboarding' : 'Could not initiate offboarding'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Grant or revoke Apollo access; the backend applies it to the tenant's next Apollo request and audits it.
  // The switch shows the saved value only, so it changes after the reload.
  const changeApolloAccess = async (tenant, reason) => {
    const grant = !tenant.apollo_access_enabled;
    setBusyId(tenant.tenant_id);
    try {
      await setTenantApolloAccess(tenant.tenant_id, grant, reason);
      toast.success(grant ? `Apollo access granted to ${tenant.name}` : `Apollo access revoked for ${tenant.name}`);
      await load();
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not change Apollo access'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="tenants-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Every organisation on the platform. Suspending one signs its users out at once.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> New tenant</Button>
      </div>

      <Card className="card-base p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <Input aria-label="Search tenants" placeholder="Search tenant name or ID" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="max-w-sm" />
          <select aria-label="Tenant status filter" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>
        {!tenants ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{query || statusFilter ? 'No tenants match this search.' : 'No tenants yet.'}</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead><TableHead>Tenant Admin</TableHead><TableHead>Status</TableHead><TableHead>Apollo</TableHead><TableHead>Users</TableHead>
                  <TableHead>Admins</TableHead><TableHead>Active agents</TableHead><TableHead>Dial attempts (all time)</TableHead><TableHead>Plan</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.tenant_id} data-testid={`tenant-row-${tenant.tenant_id}`}>
                    <TableCell><p className="font-medium text-sm">{tenant.name}</p><p className="text-xs text-muted-foreground">{tenant.default_timezone}</p></TableCell>
                    <TableCell className="text-sm" data-testid={`tenant-admins-${tenant.tenant_id}`}>
                      {(tenant.tenant_admins || []).length === 0
                        ? <span className="text-muted-foreground">None</span>
                        : tenant.tenant_admins.map((admin) => (
                          <div key={admin.email}><p className="font-medium">{admin.name}</p><p className="text-xs text-muted-foreground">{admin.email}</p></div>
                        ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[tenant.status] || 'text-[11px]'}>
                        {statusLabel(tenant.status)}
                      </Badge>
                      {tenant.offboarding_started_at && <div className="mt-1 text-xs text-amber-700">Offboarding · {new Date(tenant.offboarding_started_at).toLocaleDateString()}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={tenant.apollo_access_enabled === true} disabled={busyId === tenant.tenant_id}
                          aria-label={`Apollo access for ${tenant.name}`} onCheckedChange={() => setApolloChange(tenant)} />
                        <span className="text-xs text-muted-foreground">{tenant.apollo_access_enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{tenant.active_user_count} active / {tenant.user_count}</TableCell>
                    <TableCell className="text-sm">{tenant.admin_count}</TableCell>
                    <TableCell className="text-sm">{tenant.active_assistant_count}</TableCell>
                    <TableCell className="text-sm">{tenant.call_count}</TableCell>
                    <TableCell className="text-sm" data-testid={`tenant-plan-${tenant.tenant_id}`}><PlanCell plan={tenant.plan} /></TableCell>
                    <TableCell className="text-sm">{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm"><Link to={`/admin/tenant-users?tenant_id=${tenant.tenant_id}`}>Admins</Link></Button>
                      <Button variant="ghost" size="sm" onClick={() => setSettingsOf(tenant)}>Settings</Button>
                      <Button variant="ghost" size="sm" onClick={() => setBounding(tenant)}>Calling hours</Button>
                      {tenant.offboarding_started_at
                        ? <Button variant="ghost" size="sm" disabled={busyId === tenant.tenant_id} onClick={() => setCancelling(tenant)}>Cancel offboarding</Button>
                        : <Button variant="ghost" size="sm" disabled={busyId === tenant.tenant_id} onClick={() => setOffboarding(tenant)}>Offboard</Button>}
                      <Button variant="ghost" size="sm" onClick={() => setNumbersFor(tenant)}>Phone numbers</Button>
                      <Button variant="outline" size="sm" disabled={busyId === tenant.tenant_id} onClick={() => setConfirming(tenant)}>
                        {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground"><span>{total} tenants</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><Button size="sm" variant="outline" disabled={page >= Math.max(1, Math.ceil(total / 25))} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
      </Card>

      <NewTenantDialog open={creating} onOpenChange={setCreating} onCreated={load} />
      <PhoneNumbersDialog tenant={numbersFor} onClose={() => setNumbersFor(null)} />
      <CallingBoundDialog tenant={bounding} onOpenChange={(open) => !open && setBounding(null)} />
      <TenantSettingsDialog tenant={settingsOf} onOpenChange={(open) => { if (!open) { setSettingsOf(null); load(); } }} />
      <ReasonDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? (confirming.status === 'active' ? `Suspend ${confirming.name}?` : `Activate ${confirming.name}?`) : ''}
        description={confirming && (confirming.status === 'active'
          ? 'All of its users are signed out at once and cannot log in until it is activated again. No data is deleted.'
          : 'Its users will be able to log in again.')}
        confirmLabel={confirming?.status === 'active' ? 'Suspend' : 'Activate'}
        danger={confirming?.status === 'active'}
        reasonPlaceholder="Why? It is kept in the platform audit trail."
        onConfirm={(reason) => toggle(confirming, reason)}
      />
      <ReasonDialog
        open={Boolean(offboarding)}
        onOpenChange={(open) => !open && setOffboarding(null)}
        title={offboarding ? `Initiate offboarding for ${offboarding.name}?` : ''}
        description="This records an offboarding request and timestamp, and agents can no longer be assigned to the tenant. It does not suspend the tenant or delete data."
        confirmLabel="Initiate offboarding"
        danger
        reasonPlaceholder="Why is this tenant being offboarded?"
        onConfirm={(reason) => changeOffboarding(offboarding, reason)}
      />
      <ReasonDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={cancelling ? `Cancel offboarding for ${cancelling.name}?` : ''}
        description="Clears the offboarding marker; agents can be assigned to the tenant again."
        confirmLabel="Cancel offboarding"
        reasonPlaceholder="Why is offboarding being cancelled?"
        onConfirm={(reason) => changeOffboarding(cancelling, reason, true)}
      />
      <ReasonDialog
        open={Boolean(apolloChange)}
        onOpenChange={(open) => !open && setApolloChange(null)}
        title={apolloChange ? (apolloChange.apollo_access_enabled
          ? `Revoke Apollo access for ${apolloChange.name}?` : `Grant Apollo access to ${apolloChange.name}?`) : ''}
        description={apolloChange && (apolloChange.apollo_access_enabled
          ? 'Apollo Preview stops working for its users from their next request. Nothing else changes.'
          : 'Its Tenant Admins, Managers and Sales Reps can use Apollo Preview from their next request. Searches use the platform Apollo account.')}
        confirmLabel={apolloChange?.apollo_access_enabled ? 'Revoke access' : 'Grant access'}
        danger={apolloChange?.apollo_access_enabled}
        reasonPlaceholder="Why? At least 3 characters; it is kept in the platform audit trail."
        onConfirm={(reason) => changeApolloAccess(apolloChange, reason)}
      />
    </div>
  );
}
