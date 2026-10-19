import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateAdminUser } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { roleLabel } from '@/lib/rbac';
import { RoleBadge, errorText } from '@/components/admin/userBits';

/** Edit a user the actor may manage: name, and role when the actor may create more than one role. */
export default function EditUserDialog({ user, onOpenChange, onSaved }) {
  const { creatableRoles } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setRole(user.role);
    setError(null);
  }, [user]);

  if (!user) return null;
  const canChangeRole = creatableRoles.length > 1 && creatableRoles.includes(user.role);

  const save = async () => {
    const changes = {};
    if (name.trim() !== user.name) changes.name = name.trim();
    if (role !== user.role) changes.role = role;
    if (!Object.keys(changes).length) { onOpenChange(false); return; }
    setSaving(true);
    setError(null);
    try {
      await updateAdminUser(user.id, changes);
      toast.success('User updated');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e, 'Could not update the user'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </label>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            {canChangeRole ? (
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1" aria-label="Role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1"><RoleBadge role={user.role} /></div>
            )}
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
