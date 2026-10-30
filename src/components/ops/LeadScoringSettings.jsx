import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLeadScoringConfig, getLeadScoringConfigHistory, updateLeadScoringConfig,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canEditLeadScoring, canViewOperations, isSuperAdmin } from '@/lib/rbac';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import ReasonDialog from './ReasonDialog';
import RelativeTime from './RelativeTime';
import OpsButton from './OpsButton';
import TenantPicker from './TenantPicker';
import { ErrorState, SkeletonRows } from './States';

const num = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function ScoringConfig({ scope, scopeKey, editable }) {
  const [data, setData] = useState(null);
  const [disabled, setDisabled] = useState([]);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await getLeadScoringConfig(scope);
      setData(res.data);
      setDisabled(res.data.disabled);
      setError(null);
      try { setHistory((await getLeadScoringConfigHistory(scope)).data.items); } catch { setHistory(null); }
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [scope]);
  useEffect(() => { setData(null); fetchAll(); }, [fetchAll, scopeKey]);

  const { run } = useApiAction(
    (reason) => updateLeadScoringConfig({ disabled, reason, expected_config_hash: data.config_hash }, scope),
    {
      success: (r) => (r.data.changed === false ? 'No changes to save' : 'Lead scoring saved. Scores are being refreshed.'),
      onSuccess: fetchAll,
      onConflict: fetchAll,
    },
  );

  const params = useMemo(() => data?.parameters || [], [data]);
  const byGroup = useMemo(
    () => params.reduce((acc, p) => ({ ...acc, [p.group]: [...(acc[p.group] || []), p] }), {}),
    [params],
  );
  const changed = Boolean(data) && !sameSet(disabled, data.disabled);
  const labelOf = (key) => params.find((p) => p.parameter === key)?.label || key;
  const changes = useMemo(() => (data
    ? params.filter((p) => disabled.includes(p.parameter) !== data.disabled.includes(p.parameter))
      .map((p) => `${p.label}: ${data.disabled.includes(p.parameter) ? 'off' : 'on'} → ${disabled.includes(p.parameter) ? 'off' : 'on'}`)
    : []), [data, params, disabled]);

  // The backend refuses switching off every Fit parameter; say so before sending.
  const fit = params.filter((p) => p.group.toLowerCase() === 'fit' && p.configurable);
  const noFit = fit.length > 0 && fit.every((p) => disabled.includes(p.parameter));

  const toggle = (key, on) => setDisabled((prev) => (on ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <>
      <section className="ops ops-card space-y-4 p-5" aria-labelledby="lead-scoring">
        <div>
          <h2 id="lead-scoring" className="text-sm font-semibold">Lead score parameters</h2>
          <p className="text-xs text-muted-foreground">
            Choose which details feed a lead's score. The weight of a parameter you turn off is shared among the others in its
            group. Weights and the HOT / WARM / COLD thresholds are fixed.
          </p>
          {!editable && data && <p className="mt-1 text-xs text-muted-foreground">View only.</p>}
        </div>
        {error && <ErrorState message={error} onRetry={fetchAll} />}
        {!error && !data && <SkeletonRows rows={3} label="Loading lead scoring" />}
        {data && Object.entries(byGroup).map(([group, items]) => (
          <fieldset key={group} className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}{data.group_weights?.[group] != null ? ` · ${num(data.group_weights[group])} points` : ''}
            </legend>
            {items.map((p) => {
              const id = `score-param-${p.parameter}`;
              return (
                <div key={p.parameter} className="flex items-start gap-3">
                  <input id={id} type="checkbox" checked={!disabled.includes(p.parameter)}
                    disabled={!editable || !p.configurable}
                    onChange={(e) => toggle(p.parameter, e.target.checked)} className="mt-1 h-4 w-4" />
                  <div className="flex-1">
                    <label htmlFor={id} className="text-sm font-medium">{p.label}</label>
                    <p className="text-xs text-muted-foreground">
                      {p.base_weight == null
                        ? 'Adjusts the intent score by how recent the intent is.'
                        : `Weight ${num(p.effective_weight)} (shipped ${num(p.base_weight)})`}
                      {!p.configurable && ' · Always on'}
                    </p>
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
        {data && data.thresholds?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Temperature thresholds</p>
            <p className="ops-num text-sm">{data.thresholds.map((t) => `${t.label} ${t.min}–${t.max}`).join(' · ')}</p>
          </div>
        )}
        {noFit && <p className="text-xs font-semibold text-[color:var(--ops-bad)]">At least one Fit parameter must stay on.</p>}
        {data && editable && (
          <div className="flex flex-wrap items-center gap-3">
            <OpsButton variant="primary" disabled={!changed || noFit} onClick={() => setConfirming(true)}>Save</OpsButton>
            <OpsButton variant="quiet" disabled={!changed} onClick={() => setDisabled(data.disabled)}>Undo changes</OpsButton>
          </div>
        )}
        {history && (
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Change history ({history.length})</summary>
            {history.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No changes yet.</p> : (
              <ul className="divide-y divide-border">
                {history.map((e) => {
                  const off = e.new_value?.disabled || [];
                  return (
                    <li key={e.event_id} className="py-2 text-sm">
                      <RelativeTime iso={e.created_at} mode="absolute" className="text-xs text-muted-foreground" />
                      <p>“{e.reason}”</p>
                      <p className="text-xs text-muted-foreground">
                        {off.length ? `Turned off: ${off.map(labelOf).join(', ')}` : 'All parameters on'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </details>
        )}
      </section>
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Save lead score parameters" changes={changes}
        description="Scores for this tenant are refreshed in the background after the change."
        confirmLabel="Save" onConfirm={async (reason) => Boolean(await run(reason))} />
    </>
  );
}

/** Settings → Lead scoring: which parameters the tenant's lead scores use (GET/PUT /api/lead-scoring/config). */
export default function LeadScoringSettings() {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user);
  const [tenantId, setTenantId] = useState('');
  const scope = useMemo(() => (superAdmin ? (tenantId ? { tenant_id: tenantId } : null) : {}), [superAdmin, tenantId]);

  if (!canViewOperations(user)) return null;
  return (
    <div className="space-y-4">
      {superAdmin && <TenantPicker value={tenantId} onChange={setTenantId} label="Settings for tenant" />}
      {scope && <ScoringConfig scope={scope} scopeKey={superAdmin ? tenantId : 'own'} editable={canEditLeadScoring(user)} />}
    </div>
  );
}
