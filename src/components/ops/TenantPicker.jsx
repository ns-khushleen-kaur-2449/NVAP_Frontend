import { useEffect, useState } from 'react';
import { listTenants } from '@/lib/api';

/** A Super Admin has no tenant: tenant-scoped screens ask which tenant to show. */
export default function TenantPicker({ value, onChange, label = 'Tenant' }) {
  const [tenants, setTenants] = useState([]);
  useEffect(() => {
    listTenants().then((r) => {
      const list = r.data.tenants || [];
      setTenants(list);
      if (!value && list[0]) onChange(String(list[0].tenant_id));
    }).catch(() => setTenants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
        {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}
      </select>
    </label>
  );
}
