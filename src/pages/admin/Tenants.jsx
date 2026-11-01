import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Copy, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { errorText } from '@/components/admin/userBits';
import {
  activateTenant, addTenantPhoneNumber, createTenantWithAdmin, listTenantPhoneNumbers, listTenants,
  removeTenantPhoneNumber, suspendTenant,
} from '@/lib/api';
import { generateTemporaryPassword } from '@/lib/passwords';

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
              <Input type="email" value={form.admin_email} onChange={(e) => set({ admin_email: e.target.value })} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Temporary password
              <div className="flex gap-2 mt-1">
                <Input value={form.password} onChange={(e) => set({ password: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="Generate password"
                  onClick={() => set({ password: generateTemporaryPassword() })}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </label>
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
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

/** Super Admin: every tenant, with its users; create, suspend and activate; give phone numbers. */
export default function TenantsPage() {
  const [tenants, setTenants] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [numbersFor, setNumbersFor] = useState(null);

  const load = useCallback(async () => {
    try {
      setTenants((await listTenants()).data.tenants || []);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load tenants'));
      setTenants([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (tenant) => {
    const suspend = tenant.status === 'active';
    setBusyId(tenant.tenant_id);
    try {
      if (suspend) await suspendTenant(tenant.tenant_id);
      else await activateTenant(tenant.tenant_id);
      toast.success(suspend ? `${tenant.name} suspended` : `${tenant.name} activated`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not change the tenant'));
    } finally {
      setBusyId(null);
      setConfirming(null);
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
        {!tenants ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No tenants yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead><TableHead>Status</TableHead><TableHead>Users</TableHead>
                  <TableHead>Admins</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.tenant_id} data-testid={`tenant-row-${tenant.tenant_id}`}>
                    <TableCell><p className="font-medium text-sm">{tenant.name}</p><p className="text-xs text-muted-foreground">{tenant.default_timezone}</p></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tenant.status === 'active'
                        ? 'text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                        : 'text-[11px] bg-red-500/10 text-red-600 border-red-500/25'}>
                        {tenant.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tenant.active_user_count} active / {tenant.user_count}</TableCell>
                    <TableCell className="text-sm">{tenant.admin_count}</TableCell>
                    <TableCell className="text-sm">{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => setNumbersFor(tenant)}>Phone numbers</Button>
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
      </Card>

      <NewTenantDialog open={creating} onOpenChange={setCreating} onCreated={load} />
      <PhoneNumbersDialog tenant={numbersFor} onClose={() => setNumbersFor(null)} />
      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && (confirming.status === 'active' ? `Suspend ${confirming.name}?` : `Activate ${confirming.name}?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && (confirming.status === 'active'
                ? 'All of its users are signed out at once and cannot log in until it is activated again. No data is deleted.'
                : 'Its users will be able to log in again.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggle(confirming)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
