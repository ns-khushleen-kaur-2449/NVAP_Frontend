import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAppointmentRules, getAppointmentRulesHistory, getCallingBound, getContactRules, getContactRulesHistory,
  updateAppointmentRules, updateContactRules,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canEditTenantRules, canViewOperations } from '@/lib/rbac';
import { errorMessage } from '@/hooks/useApiAction';
import RulesSettings from './RulesSettings';
import { ErrorState, SkeletonRows } from './States';

// Headings for the contact rules, by key prefix (the keys and their texts come from the API).
const CONTACT_GROUPS = [
  { title: 'Retry delays for new campaigns (layer A)', match: (k) => k.startsWith('retry_') },
  { title: 'Blocks across campaigns (layer B)', match: (k) => k.startsWith('block_') },
  { title: 'Limits (layer C) and timing', match: (k) => !k.startsWith('retry_') && !k.startsWith('block_') },
];

// The brochure sender is a person, picked in Settings → Products and brochures; it is left out here.
const APPOINTMENT_GROUPS = [
  { title: 'Appointments', match: (k) => !k.startsWith('brochure_') },
  { title: 'Brochures leads ask for on calls', match: (k) => k.startsWith('brochure_') && k !== 'brochure_sender_user_id' },
];

function CallingBound({ scope }) {
  const [bound, setBound] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      setBound((await getCallingBound(scope)).data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Check your connection and try again.'));
    }
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="ops ops-card space-y-3 p-5" aria-labelledby="calling-bound">
      <div>
        <h2 id="calling-bound" className="text-sm font-semibold">Outer calling bound</h2>
        <p className="text-xs text-muted-foreground">No call of any kind goes out outside these hours (the lead's local time).</p>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !bound && <SkeletonRows rows={1} />}
      {bound && (
        <p className="ops-num text-sm">
          {bound.start_time}–{bound.end_time} <span className="text-muted-foreground">· Set by your administrator</span>
        </p>
      )}
    </section>
  );
}

/** Settings for calling and appointments: contact rules, appointment rules, the outer calling bound. */
export default function OperationsSettings() {
  const { user } = useAuth();
  const scope = useMemo(() => ({}), []);
  const scopeKey = 'own';
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
      {scope && (
        <>
          <RulesSettings title="Contact rules" intro="When a number may be called again, across all campaigns."
            load={loadContact} save={saveContact} loadHistory={historyContact} editable={editable}
            groups={CONTACT_GROUPS} scopeKey={scopeKey} />
          <RulesSettings title="Appointment rules" intro="What happens after meetings end or are cancelled."
            load={loadAppointment} save={saveAppointment} loadHistory={historyAppointment} editable={editable}
            groups={APPOINTMENT_GROUPS} scopeKey={scopeKey} />
          <CallingBound scope={scope} />
        </>
      )}
    </div>
  );
}
