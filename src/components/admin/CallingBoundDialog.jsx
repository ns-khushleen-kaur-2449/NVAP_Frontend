import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/components/admin/userBits';
import { getTenantCallingBound, updateTenantCallingBound } from '@/lib/api';

/** A tenant's outer calling bound: a platform limit nobody in the tenant can widen. The reason goes to the audit trail. */
export default function CallingBoundDialog({ tenant, onOpenChange }) {
  const [bound, setBound] = useState(null);
  const [form, setForm] = useState({ start_time: '', end_time: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tenantId = tenant?.tenant_id;

  useEffect(() => {
    if (!tenantId) return;
    setBound(null);
    setError(null);
    getTenantCallingBound(tenantId).then((r) => {
      setBound(r.data);
      setForm({ start_time: r.data.start_time, end_time: r.data.end_time, reason: '' });
    }).catch((e) => setError(errorText(e, 'Could not load the calling bound')));
  }, [tenantId]);

  const invalid = !form.start_time || !form.end_time || form.end_time <= form.start_time;
  const changed = bound && (form.start_time !== bound.start_time || form.end_time !== bound.end_time);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateTenantCallingBound(tenantId, { ...form, reason: form.reason.trim() });
      toast.success(`Calling bound saved for ${tenant.name}`);
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e, 'Could not save the calling bound'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(tenant)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{tenant ? `Outer calling bound for ${tenant.name}` : ''}</DialogTitle>
          <DialogDescription>No call of any kind goes out outside these hours (the lead's local time).</DialogDescription>
        </DialogHeader>
        {!bound && !error && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>}
        {bound && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-muted-foreground">From
                <Input type="time" value={form.start_time} className="mt-1" onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">Until
                <Input type="time" value={form.end_time} className="mt-1" onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Default {bound.default.start_time}–{bound.default.end_time}.</p>
            {invalid && <p className="text-xs text-destructive">The end must be after the start.</p>}
            <label className="block text-xs font-medium text-muted-foreground">Reason
              <Textarea value={form.reason} className="mt-1 min-h-[64px]" placeholder="Why? It is kept in the platform audit trail."
                onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !bound || invalid || !changed || !form.reason.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
