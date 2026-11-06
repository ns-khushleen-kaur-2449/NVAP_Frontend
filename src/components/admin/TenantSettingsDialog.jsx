import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import { getTenantSettings, grantSeatOverride, setTenantFeature, setTenantLimits } from '@/lib/api';

const LIMITS = [
  { key: 'monthly_minutes', label: 'Monthly minutes (warning only)', min: 1 },
  { key: 'monthly_calls', label: 'Monthly calls (enforced)', min: 0 },
  { key: 'concurrent_calls', label: 'Concurrent calls (enforced)', min: 1 },
  { key: 'manager_seats', label: 'Manager seats (enforced)', min: 0 },
  { key: 'rep_seats', label: 'Sales rep seats (enforced)', min: 0 },
];
const EMPTY_LIMITS = Object.fromEntries(LIMITS.map(({ key }) => [key, '']));
const number = (value) => (value === '' ? null : Number(value));

/** One tenant's limits, feature switches and Tenant Admins. Every change takes a reason and is audited. */
export default function TenantSettingsDialog({ tenant, onOpenChange }) {
  const [data, setData] = useState(null);
  const [limits, setLimits] = useState(EMPTY_LIMITS);
  const [change, setChange] = useState(null);
  const [override, setOverride] = useState({ role: 'manager', extra: '' });
  const [error, setError] = useState(null);
  const tenantId = tenant?.tenant_id;

  const show = useCallback((settings) => {
    setData(settings);
    setLimits(Object.fromEntries(LIMITS.map(({ key }) => [key, settings.limits[key] ?? ''])));
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setData(null);
    setError(null);
    getTenantSettings(tenantId).then((r) => show(r.data)).catch((e) => setError(errorText(e, 'Could not load this tenant')));
  }, [tenantId, show]);

  const confirm = async (reason) => {
    try {
      show((await change.run(reason)).data);
      toast.success('Saved');
      setChange(null);
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not save'));
      return false;
    }
  };

  const limitsChanged = data && LIMITS.some(({ key }) => String(limits[key]) !== String(data.limits[key] ?? ''));

  return (
    <Dialog open={Boolean(tenant)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto" data-testid="tenant-settings">
        <DialogHeader>
          <DialogTitle>{tenant?.name}</DialogTitle>
          <DialogDescription>{data ? `Status: ${data.status}${data.dialing_paused ? ' · calling paused' : ''}` : 'Limits, features and admins.'}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!data && !error && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>}
        {data && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Limits</h3>
              <div className="grid grid-cols-2 gap-3">
                {LIMITS.map(({ key, label, min }) => (
                  <label key={key} className="block text-xs font-medium text-muted-foreground">{label}
                    <Input type="number" min={min} className="mt-1" value={limits[key]} placeholder="No limit"
                      onChange={(e) => setLimits({ ...limits, [key]: e.target.value })} />
                  </label>
                ))}
              </div>
              <Button size="sm" disabled={!limitsChanged} onClick={() => setChange({
                title: `Change the limits of ${tenant.name}?`, label: 'Save limits',
                run: (reason) => setTenantLimits(tenantId, { ...Object.fromEntries(LIMITS.map(({ key }) => [key, number(limits[key])])), reason }),
              })}>Save limits</Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Seat override</h3>
              <p className="text-xs text-muted-foreground">Extra seats on top of the limit, for a one-off exception. 0 removes it.</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-xs font-medium text-muted-foreground">Role
                  <select aria-label="Override role" className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block" value={override.role}
                    onChange={(e) => setOverride({ ...override, role: e.target.value })}>
                    <option value="manager">Manager</option><option value="rep">Sales rep</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">Extra seats
                  <Input type="number" min="0" className="mt-1 w-24" value={override.extra}
                    onChange={(e) => setOverride({ ...override, extra: e.target.value })} />
                </label>
                <Button size="sm" variant="outline" disabled={override.extra === ''} onClick={() => setChange({
                  title: `Override seats for ${tenant.name}?`, label: 'Apply override',
                  run: (reason) => grantSeatOverride(tenantId, override.role, Number(override.extra), reason),
                })}>Apply override</Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Features</h3>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {data.features.map((feature) => (
                  <li key={feature.key} className="flex items-center justify-between gap-3 text-sm">
                    <span>{feature.label}</span>
                    <Switch checked={feature.enabled} aria-label={feature.label} onCheckedChange={(enabled) => setChange({
                      title: `${enabled ? 'Switch on' : 'Switch off'} ${feature.label} for ${tenant.name}?`, label: enabled ? 'Switch on' : 'Switch off', danger: !enabled,
                      run: (reason) => setTenantFeature(tenantId, feature.key, enabled, reason),
                    })} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tenant admins</h3>
                <Link className="text-xs underline" to={`/admin/tenant-users?tenant_id=${tenantId}`}>Manage</Link>
              </div>
              {data.tenant_admins.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                <ul className="space-y-1">
                  {data.tenant_admins.map((admin) => (
                    <li key={admin.id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{admin.name} · {admin.email}</span>
                      <span className="text-muted-foreground capitalize">{admin.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        <ReasonDialog open={Boolean(change)} onOpenChange={(open) => !open && setChange(null)} title={change?.title || ''}
          confirmLabel={change?.label || 'Confirm'} danger={change?.danger}
          reasonPlaceholder="Why? It is kept in the platform audit trail." onConfirm={confirm} />
      </DialogContent>
    </Dialog>
  );
}
