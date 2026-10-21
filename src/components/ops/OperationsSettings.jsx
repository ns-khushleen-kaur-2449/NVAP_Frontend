import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAppointmentRules, getAppointmentRulesHistory, getCallingBound, getContactRules, getContactRulesHistory,
  updateAppointmentRules, updateCallingBound, updateContactRules,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canEditCallingBound, canEditTenantRules, canViewOperations, isSuperAdmin } from '@/lib/rbac';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import RulesSettings from './RulesSettings';
import ReasonDialog from './ReasonDialog';
import OpsButton from './OpsButton';
import TenantPicker from './TenantPicker';
import { ErrorState, SkeletonRows } from './States';

// Headings for the contact rules, by key prefix (the keys and their texts come from the API).
const CONTACT_GROUPS = [
  { title: 'Retry delays for new campaigns (layer A)', match: (k) => k.startsWith('retry_') },
  { title: 'Blocks across campaigns (layer B)', match: (k) => k.startsWith('block_') },
  { title: 'Limits (layer C) and timing', match: (k) => !k.startsWith('retry_') && !k.startsWith('block_') },
];

function CallingBound({ scope, editable }) {
  const [bound, setBound] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ start_time: '', end_time: '' });
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await getCallingBound(scope);
      setBound(res.data);
      setForm({ start_time: res.data.start_time, end_time: res.data.end_time });
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Check your connection and try again.'));
    }
  }, [scope]);
  useEffect(() => { load(); }, [load]);
  const { run } = useApiAction((reason) => updateCallingBound({ ...form, reason }, scope), { success: 'Calling bound saved', onSuccess: load });
  const invalid = !form.start_time || !form.end_time || form.end_time <= form.start_time;
  const changed = bound && (form.start_time !== bound.start_time || form.end_time !== bound.end_time);

  return (
    <section className="ops ops-card space-y-3 p-5" aria-labelledby="calling-bound">
      <div>
        <h2 id="calling-bound" className="text-sm font-semibold">Outer calling bound</h2>
        <p className="text-xs text-muted-foreground">No call of any kind goes out outside these hours (the lead's local time).</p>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !bound && <SkeletonRows rows={1} />}
      {bound && (
        editable ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">From
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">Until
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-2" />
            </label>
            <OpsButton variant="primary" disabled={invalid || !changed} onClick={() => setConfirming(true)}>Save</OpsButton>
            {invalid && <p className="w-full text-xs font-semibold text-[color:var(--ops-bad)]">The end must be after the start.</p>}
            <p className="w-full text-xs text-muted-foreground">Default {bound.default.start_time}–{bound.default.end_time}.</p>
          </div>
        ) : (
          <p className="ops-num text-sm">
            {bound.start_time}–{bound.end_time} <span className="text-muted-foreground">· Set by your administrator</span>
          </p>
        )
      )}
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Change the outer calling bound"
        changes={bound ? [`${bound.start_time}–${bound.end_time} → ${form.start_time}–${form.end_time}`] : []}
        confirmLabel="Save" onConfirm={async (reason) => Boolean(await run(reason))} />
    </section>
  );
}

/** Settings for calling and appointments: contact rules, appointment rules, the outer calling bound. */
export default function OperationsSettings() {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user);
  const [tenantId, setTenantId] = useState('');
  // One object per tenant choice, so the blocks below load once per choice (not on every render).
  const scope = useMemo(() => (superAdmin ? (tenantId ? { tenant_id: tenantId } : null) : {}), [superAdmin, tenantId]);
  const scopeKey = superAdmin ? tenantId : 'own';
  const editable = canEditTenantRules(user);

  const loadContact = useCallback(() => getContactRules(scope), [scope]);
  const historyContact = useCallback(() => getContactRulesHistory(scope), [scope]);
  const saveContact = useCallback((body) => updateContactRules(body, scope), [scope]);
  const loadAppointment = useCallback(() => getAppointmentRules(scope), [scope]);
  const historyAppointment = useCallback(() => getAppointmentRulesHistory(scope), [scope]);
  const saveAppointment = useCallback((body) => updateAppointmentRules(body, scope), [scope]);

  if (!canViewOperations(user)) return null;
  return (
    <div className="space-y-4">
      {superAdmin && <TenantPicker value={tenantId} onChange={setTenantId} label="Settings for tenant" />}
      {scope && (
        <>
          <RulesSettings title="Contact rules" intro="When a number may be called again, across all campaigns."
            load={loadContact} save={saveContact} loadHistory={historyContact} editable={editable}
            groups={CONTACT_GROUPS} scopeKey={scopeKey} />
          <RulesSettings title="Appointment rules" intro="What happens after meetings end or are cancelled."
            load={loadAppointment} save={saveAppointment} loadHistory={historyAppointment} editable={editable}
            scopeKey={scopeKey} />
          <CallingBound scope={scope} editable={canEditCallingBound(user)} />
        </>
      )}
    </div>
  );
}
