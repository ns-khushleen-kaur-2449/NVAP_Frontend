import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLeadScoringConfig, getLeadScoringConfigHistory, getLeadScoringOverview, rescoreLeadScores, updateLeadScoringConfig,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canEditLeadScoring, canViewOperations } from '@/lib/rbac';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import ReasonDialog from './ReasonDialog';
import RelativeTime from './RelativeTime';
import OpsButton from './OpsButton';
import { ErrorState, SkeletonRows } from './States';
import LeadScoringOverview from './LeadScoringOverview';

const num = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
// The most prospects one "Recalculate scores" pass handles (POST /api/lead-scores/rescore default).
const RESCORE_PASS = 100;
// After a save with automatic refresh, the overview is read again this often, at most this many times, so the
// recalculated scores show up without "Recalculate scores" (demo scores are never recalculated: hence the cap).
export const REFRESH_POLL_MS = 3000;
export const REFRESH_POLLS = 10;

// What a save does to existing scores, honestly: recalculated in the background only when
// automatic refresh is on; otherwise they wait for "Recalculate scores".
export const saveMessage = (automatic) => {
  if (automatic === true) {
    return 'Lead scoring saved. Affected scores are recalculated in the background; until then they show RECALCULATION DUE.';
  }
  if (automatic === false) {
    return 'Lead scoring saved. Existing scores show RECALCULATION DUE until they are recalculated: use "Recalculate scores".';
  }
  return 'Lead scoring saved. Existing scores show RECALCULATION DUE until they are recalculated.';
};

// One refresh pass, in words: { scored, fresh, no_fit_data, missing, failed }.
export const rescoreMessage = (r) => {
  const handled = r.scored + r.fresh + r.no_fit_data + r.missing + r.failed;
  if (handled === 0) return 'Every score is up to date. Nothing to recalculate.';
  const parts = [`Recalculated ${plural(r.scored, 'score')}.`];
  if (r.fresh) parts.push(`${plural(r.fresh, 'score was', 'scores were')} already up to date.`);
  if (r.no_fit_data) parts.push(`${plural(r.no_fit_data, 'lead')} can't be scored until seniority, department or company size is added.`);
  if (r.failed) parts.push(`${plural(r.failed, 'lead')} could not be scored; nothing was changed for them.`);
  if (handled >= RESCORE_PASS) parts.push('More may be waiting: run it again.');
  return parts.join(' ');
};

function ScoringConfig({ scope, scopeKey, editable }) {
  const [data, setData] = useState(null);
  const [disabled, setDisabled] = useState([]);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState(null);
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(null);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreResult, setRescoreResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const latest = (await getLeadScoringOverview(scope)).data;
      setOverview(latest);
      setOverviewError(null);
      return latest;
    } catch (err) {
      setOverviewError(errorMessage(err, 'The overview could not be loaded.'));
      return null;
    }
  }, [scope]);

  // The scores a save changed are recalculated in the background: follow them until none is due.
  useEffect(() => {
    if (!refreshing) return undefined;
    let polls = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      polls += 1;
      const latest = await fetchOverview();
      if (cancelled) return;
      if (polls >= REFRESH_POLLS || latest?.score_freshness?.recalculation_due?.total === 0) setRefreshing(false);
    }, REFRESH_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refreshing, fetchOverview]);

  const fetchAll = useCallback(async () => {
    try {
      const res = await getLeadScoringConfig(scope);
      setData(res.data);
      setDisabled(res.data.disabled);
      setError(null);
      try { setHistory((await getLeadScoringConfigHistory(scope)).data.items); } catch { setHistory(null); }
      fetchOverview();
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [scope, fetchOverview]);
  useEffect(() => { setData(null); setOverview(null); setRescoreResult(null); fetchAll(); }, [fetchAll, scopeKey]);

  const { run } = useApiAction(
    (reason) => updateLeadScoringConfig({ disabled, reason, expected_config_hash: data.config_hash }, scope),
    {
      success: (r) => (r.data.changed === false ? 'No changes to save' : saveMessage(overview?.automatic_refresh_enabled)),
      onSuccess: async (r) => {
        await fetchAll();
        if (r.data.changed !== false && overview?.automatic_refresh_enabled) setRefreshing(true);
      },
      onConflict: fetchAll,
    },
  );

  const recalculate = async () => {
    setRescoring(true);
    setRescoreResult(null);
    try {
      const r = await rescoreLeadScores({ ...scope, limit: RESCORE_PASS });
      setRescoreResult({ ok: true, text: rescoreMessage(r.data) });
      fetchOverview();
    } catch (err) {
      setRescoreResult({ ok: false, text: errorMessage(err, 'Scores could not be recalculated. Nothing was changed.') });
    }
    setRescoring(false);
  };

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
          <div className="space-y-1" data-testid="thresholds">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Temperature thresholds (fixed)</p>
            <p className="ops-num text-sm">{data.thresholds.map((t) => `${t.label} ${t.min}–${t.max}`).join(' · ')}</p>
            <p className="text-xs text-muted-foreground">
              PROVISIONAL is shown instead of a temperature when there isn't enough reliable conversation information yet
              (no calls, no accepted assessment, an inconclusive result, or the latest assessment pending, without a
              result or failed). It is not a score range.
            </p>
          </div>
        )}
        {noFit && <p className="text-xs font-semibold text-[color:var(--ops-bad)]">At least one Fit parameter must stay on.</p>}
        {data && editable && (
          <div className="flex flex-wrap items-center gap-3">
            <OpsButton variant="primary" disabled={!changed || noFit} onClick={() => setConfirming(true)}>Save</OpsButton>
            <OpsButton variant="quiet" disabled={!changed} onClick={() => setDisabled(data.disabled)}>Undo changes</OpsButton>
          </div>
        )}
        {data && (
          <div className="space-y-2 border-t border-border pt-3">
            {overviewError && <ErrorState message={overviewError} onRetry={fetchOverview} />}
            <LeadScoringOverview data={overview} />
            {refreshing && (
              <p role="status" data-testid="auto-refresh" className="text-xs text-muted-foreground">
                Updating scores with the new settings…
              </p>
            )}
            {editable && (
              <div className="flex flex-wrap items-center gap-3">
                <OpsButton variant="quiet" disabled={rescoring} onClick={recalculate}>
                  {rescoring ? 'Recalculating…' : 'Recalculate scores'}
                </OpsButton>
                <span className="text-xs text-muted-foreground">
                  Recalculates up to {RESCORE_PASS} out-of-date or never-calculated scores now
                  {overview && !overview.automatic_refresh_enabled ? ' (automatic refresh is off)' : ''}.
                </span>
              </div>
            )}
            {rescoreResult && (
              <p role="status" data-testid="rescore-result"
                className={`text-xs ${rescoreResult.ok ? '' : 'font-semibold text-[color:var(--ops-bad)]'}`}>
                {rescoreResult.text}
              </p>
            )}
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
        description={overview?.automatic_refresh_enabled === false
          ? 'Existing scores show RECALCULATION DUE after the change until they are recalculated with "Recalculate scores".'
          : 'Affected scores show RECALCULATION DUE after the change until they are recalculated.'}
        confirmLabel="Save" onConfirm={async (reason) => Boolean(await run(reason))} />
    </>
  );
}

/** Settings → Lead scoring: which parameters the tenant's lead scores use (GET/PUT /api/lead-scoring/config). */
export default function LeadScoringSettings() {
  const { user } = useAuth();
  const scope = useMemo(() => ({}), []);

  if (!canViewOperations(user)) return null;
  return (
    <div className="space-y-4">
      <ScoringConfig scope={scope} scopeKey="own" editable={canEditLeadScoring(user)} />
    </div>
  );
}
