import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authRegister, listTeams, listTenants } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { ROLES, roleLabel } from '@/lib/rbac';
import { generateTemporaryPassword } from '@/lib/passwords';
import { errorText } from '@/components/admin/userBits';

const fieldClass = 'mt-1';

/**
 * Add a user.  The role list is exactly creatableRoles(actor).
 * - Super Admin: must pick the tenant.
 * - Tenant Admin adding a Sales Rep: must pick the team (a Manager).
 * - Manager: no tenant or team choice; the backend uses the Manager's own.
 * The password is temporary: the new user must change it at first login.
 */
export default function AddUserDialog({ open, onOpenChange, onCreated, defaultRole = null }) {
  const { user: actor, creatableRoles } = useAuth();
  const [form, setForm] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [managers, setManagers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const isSuperAdmin = actor?.role === ROLES.SUPER_ADMIN;
  const isTenantAdmin = actor?.role === ROLES.TENANT_ADMIN;

  useEffect(() => {
    if (!open) return;
    const role = defaultRole && creatableRoles.includes(defaultRole) ? defaultRole : creatableRoles[0] || '';
    setForm({ name: '', email: '', password: generateTemporaryPassword(), role, tenant_id: '', manager_user_id: '' });
    setError(null);
    setCreated(null);
    if (isSuperAdmin) {
      listTenants().then((r) => setTenants((r.data.tenants || []).filter((t) => t.status === 'active'))).catch(() => setTenants([]));
    }
    if (isTenantAdmin) {
      listTeams().then((r) => setManagers((r.data.teams || []).map((t) => t.manager).filter((m) => m.status === 'active')))
        .catch(() => setManagers([]));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const needsTenant = isSuperAdmin;
  const needsTeam = isTenantAdmin && form.role === ROLES.REP;

  const save = async () => {
    const problems = [];
    if (!form.name.trim()) problems.push('Name is required');
    if (!form.email.trim()) problems.push('Email is required');
    if (!form.role) problems.push('Choose a role');
    if (needsTenant && !form.tenant_id) problems.push('Choose a tenant');
    if (needsTeam && !form.manager_user_id) problems.push('Choose a team');
    if (problems.length) { setError(problems.join('. ')); return; }
    const body = { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role };
    if (needsTenant) body.tenant_id = form.tenant_id;
    if (needsTeam) body.manager_user_id = Number(form.manager_user_id);
    setSaving(true);
    setError(null);
    try {
      const response = await authRegister(body);
      setCreated({ email: response.data.user.email, password: form.password });
      onCreated?.(response.data.user);
    } catch (e) {
      setError(errorText(e, 'Could not create the user'));
    } finally {
      setSaving(false);
    }
  };

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>They sign in with a temporary password and must choose their own at first login.</DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3" data-testid="user-created">
            <p className="text-sm">Created <span className="font-medium">{created.email}</span>. Share this temporary password with them securely:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">{created.password}</code>
              <Button variant="outline" size="icon" onClick={() => copy(created.password)} aria-label="Copy password"><Copy className="w-4 h-4" /></Button>
            </div>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Name
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Email
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Temporary password
              <div className="flex gap-2 mt-1">
                <Input value={form.password} onChange={(e) => set({ password: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="Generate password"
                  onClick={() => set({ password: generateTemporaryPassword() })}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </label>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <Select value={form.role} onValueChange={(role) => set({ role, manager_user_id: '' })}>
                <SelectTrigger className={fieldClass} aria-label="Role" data-testid="role-select"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {needsTenant && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Tenant</span>
                <Select value={form.tenant_id} onValueChange={(tenant_id) => set({ tenant_id })}>
                  <SelectTrigger className={fieldClass} aria-label="Tenant" data-testid="tenant-select"><SelectValue placeholder="Choose a tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {needsTeam && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Team</span>
                <Select value={String(form.manager_user_id)} onValueChange={(manager_user_id) => set({ manager_user_id })}>
                  <SelectTrigger className={fieldClass} aria-label="Team" data-testid="team-select"><SelectValue placeholder="Choose a team" /></SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}'s team</SelectItem>)}
                  </SelectContent>
                </Select>
                {!managers.length && <p className="text-[11px] text-amber-600 mt-1">Create a Manager first: a team is a Manager and their Sales Reps.</p>}
              </div>
            )}
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
            <DialogFooter>
              <Button onClick={save} disabled={saving || !creatableRoles.length} className="bg-primary text-primary-foreground">
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create user
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
