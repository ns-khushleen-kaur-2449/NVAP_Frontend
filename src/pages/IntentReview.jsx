import { Fragment, useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getIntentAssessment, getIntentReviewQueue, reviewIntentAssessment } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOperate, isSuperAdmin } from '@/lib/rbac';
import { ALREADY_REVIEWED_NOTICE, INTENT_TYPES, REVIEW_TONES, SIGNAL_TYPES, humanize } from '@/lib/intent';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import ReasonDialog from '@/components/ops/ReasonDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import TenantPicker from '@/components/ops/TenantPicker';
import IntentAssessmentDetails from '@/components/ops/IntentAssessmentDetails';
import { EmptyState, ErrorState, ScrollTable, Skeleton, SkeletonRows } from '@/components/ops/States';

const REFRESH_MS = 30000;
const PAGE_SIZE = 25;
// Filters are the backend's review statuses (?status= on the review queue).
export const INTENT_REVIEW_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export const REVIEW_DECISIONS = {
  approved: {
    label: 'Approve', success: 'Assessment approved',
    changes: ['The assessment is accepted.', "It becomes the lead's current intent (unless a newer accepted one exists)."],
  },
  rejected: {
    label: 'Reject', success: 'Assessment rejected', danger: true,
    changes: ['The assessment is marked rejected and kept in the history.', "The lead's current intent does not change."],
  },
};

const FIELD = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2';
const sameSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

function ChipGroup({ legend, options, value, onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <label key={opt}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs focus-within:outline focus-within:outline-2 ${value.includes(opt) ? 'border-[var(--ops-accent)] bg-[var(--ops-accent)] text-white' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            <input type="checkbox" className="sr-only" checked={value.includes(opt)} onChange={() => toggle(opt)} />
            {humanize(opt)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "AI said: X" under a field, with a Reset link once the reviewer has changed it. */
function AiHint({ label, edited, onReset }) {
  if (label === null && !edited) return <span />;
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      {label !== null && <span>AI said: {label}</span>}
      {edited && (
        <button type="button" onClick={onReset} className="text-[var(--ops-accent)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2">
          Reset
        </button>
      )}
    </p>
  );
}

/** Approve with corrections: only the fields the reviewer changed are sent; the rest keep the AI value. */
function EditApproveDialog({ item, assessment: a, scope, onClose, onDone, onConflict }) {
  const [primary, setPrimary] = useState(a.primary_intent);
  const [secondary, setSecondary] = useState(a.secondary_intents || []);
  const [signals, setSignals] = useState(a.buying_signals || []);
  const [rationale, setRationale] = useState(a.rationale || '');
  const [confidence, setConfidence] = useState(String(a.confidence ?? 0));
  const [optOut, setOptOut] = useState('keep'); // keep | yes | no

  const confNum = Number(confidence);
  const confValid = confidence !== '' && Number.isInteger(confNum) && confNum >= 0 && confNum <= 100;
  const edits = {};
  if (primary !== a.primary_intent) edits.primary_intent = primary;
  const secondaryClean = secondary.filter((s) => s !== primary);
  if (!sameSet(secondaryClean, (a.secondary_intents || []).filter((s) => s !== primary))) edits.secondary_intents = secondaryClean;
  if (!sameSet(signals, a.buying_signals || [])) edits.buying_signals = signals;
  if (rationale.trim() && rationale.trim() !== (a.rationale || '').trim()) edits.rationale = rationale.trim();
  if (confValid && confNum !== a.confidence) edits.confidence = confNum;
  if (optOut !== 'keep') edits.opt_out_confirmed = optOut === 'yes';
  const changed = Object.keys(edits);

  const list = (arr) => (arr.length ? arr.map(humanize).join(', ') : 'none');
  const optOutLabel = { yes: 'confirmed', no: 'not an opt-out' }[optOut];
  const summary = changed.map((k) => {
    switch (k) {
      case 'primary_intent': return `Intent: ${humanize(a.primary_intent)} → ${humanize(primary)}`;
      case 'secondary_intents': return `Secondary intents: ${list(a.secondary_intents || [])} → ${list(secondaryClean)}`;
      case 'buying_signals': return `Buying signals: ${list(a.buying_signals || [])} → ${list(signals)}`;
      case 'confidence': return `Confidence: ${a.confidence} → ${confNum}`;
      case 'opt_out_confirmed': return `Explicit opt-out: ${optOutLabel}`;
      default: return `Changed: ${humanize(k).toLowerCase()}`;
    }
  });

  const request = useCallback(
    (reason) => reviewIntentAssessment(item.assessment_id, 'approved', reason, scope, edits),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.assessment_id, scope, JSON.stringify(edits)],
  );
  const { run } = useApiAction(request, { success: 'Assessment edited and approved', onSuccess: onDone, onConflict });

  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Edit & approve: ${item.prospect_name || 'assessment'}`}
      description="Correct what the AI got wrong. Fields you leave alone keep the AI's value; customer status and recommended action are recalculated from your changes."
      changes={changed.length ? summary : ['No fields changed: this approves the AI assessment as it is.']}
      confirmLabel="Approve with edits" canConfirm={confValid} wide
      onConfirm={async (reason) => Boolean(await run(reason))}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block space-y-1.5 text-sm font-medium">
            Intent
            <select value={primary} onChange={(e) => setPrimary(e.target.value)} className={FIELD}>
              {INTENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </label>
          <AiHint label={humanize(a.primary_intent)} edited={'primary_intent' in edits} onReset={() => setPrimary(a.primary_intent)} />
        </div>
        <div className="space-y-1.5">
          <ChipGroup legend="Also (secondary intents)" options={INTENT_TYPES.filter((t) => t !== primary)} value={secondary} onChange={setSecondary} />
          <AiHint label={list(a.secondary_intents || [])} edited={'secondary_intents' in edits} onReset={() => setSecondary(a.secondary_intents || [])} />
        </div>
        <div className="space-y-1.5">
          <ChipGroup legend="Buying signals" options={SIGNAL_TYPES} value={signals} onChange={setSignals} />
          <AiHint label={list(a.buying_signals || [])} edited={'buying_signals' in edits} onReset={() => setSignals(a.buying_signals || [])} />
        </div>
        <div className="space-y-1.5">
          <label className="block space-y-1.5 text-sm font-medium">
            Why (rationale)
            <textarea rows={2} maxLength={500} value={rationale} onChange={(e) => setRationale(e.target.value)} className={FIELD} />
          </label>
          <div className="flex justify-between text-xs text-muted-foreground">
            <AiHint label={null} edited={'rationale' in edits} onReset={() => setRationale(a.rationale || '')} />
            <span aria-hidden="true">{rationale.length}/500</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block space-y-1.5 text-sm font-medium">
              Confidence (0-100)
              <input type="number" min={0} max={100} value={confidence} onChange={(e) => setConfidence(e.target.value)}
                aria-invalid={!confValid} className={FIELD} />
            </label>
            <input type="range" min={0} max={100} aria-label="Confidence slider" value={confValid ? confNum : 0}
              onChange={(e) => setConfidence(e.target.value)} className="w-full accent-[var(--ops-accent)]" />
            {!confValid && <p role="alert" className="text-xs text-destructive">Enter a whole number from 0 to 100.</p>}
            <AiHint label={String(a.confidence ?? 0)} edited={'confidence' in edits} onReset={() => setConfidence(String(a.confidence ?? 0))} />
          </div>
          <div className="space-y-1.5">
            <label className="block space-y-1.5 text-sm font-medium">
              Explicit opt-out
              <select value={optOut} onChange={(e) => setOptOut(e.target.value)} className={FIELD}>
                <option value="keep">Keep as detected</option>
                <option value="yes">Confirm opt-out</option>
                <option value="no">Not an opt-out</option>
              </select>
            </label>
            <AiHint label={null} edited={optOut !== 'keep'} onReset={() => setOptOut('keep')} />
          </div>
        </div>
      </div>
    </ReasonDialog>
  );
}

function ReviewDialog({ item, decision, scope, onClose, onDone, onConflict }) {
  const meta = REVIEW_DECISIONS[decision];
  const request = useCallback(
    (reason) => reviewIntentAssessment(item.assessment_id, decision, reason, scope),
    [item.assessment_id, decision, scope],
  );
  const { run } = useApiAction(request, { success: meta.success, onSuccess: onDone, onConflict });
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title={`${meta.label}: ${item.prospect_name || 'assessment'}`} changes={meta.changes}
      confirmLabel={meta.label} danger={meta.danger}
      onConfirm={async (reason) => Boolean(await run(reason))} />
  );
}

function AssessmentDetails({ state, onRetry }) {
  if (!state || state.loading) {
    return <div aria-busy="true" aria-label="Loading the assessment"><Skeleton className="h-24 w-full" /></div>;
  }
  if (state.error) return <ErrorState title="The assessment could not be loaded." message={state.error} onRetry={onRetry} />;
  return <IntentAssessmentDetails assessment={state.data} />;
}

/**
 * Intent review: AI assessments of calls that need a person to approve or reject them.
 * Details load only when a row is opened. Tenant Admins and Managers decide (with a
 * reason); a Super Admin picks a tenant and views. `onReviewed` runs after each decision.
 */
export default function IntentReviewPage({ onReviewed }) {
  const { user } = useAuth();
  const operator = canOperate(user);
  const superAdmin = isSuperAdmin(user);
  const [params, setParams] = useSearchParams();
  const filter = INTENT_REVIEW_FILTERS.find((f) => f.id === params.get('tab')) || INTENT_REVIEW_FILTERS[0];
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({});
  const [acting, setActing] = useState(null);
  const [notice, setNotice] = useState(null);

  const scope = superAdmin ? { tenant_id: tenantId } : undefined;
  const ready = !superAdmin || Boolean(tenantId);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      const res = await getIntentReviewQueue({ status: filter.id, page, page_size: PAGE_SIZE, ...scope });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.id, page, tenantId, ready]);
  usePolling(load, REFRESH_MS, [load]);

  const fetchDetails = async (id) => {
    setDetails((d) => ({ ...d, [id]: { loading: true } }));
    try {
      const res = await getIntentAssessment(id, scope);
      setDetails((d) => ({ ...d, [id]: { data: res.data } }));
    } catch (err) {
      const message = err?.response?.status === 404 ? 'It is no longer available.' : errorMessage(err, 'Try again.');
      setDetails((d) => ({ ...d, [id]: { error: message } }));
    }
  };
  const toggle = (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!details[id] || details[id].error) fetchDetails(id);
  };

  const afterDecision = () => {
    setActing(null);
    setOpenId(null);
    load();
    onReviewed?.();
  };
  const afterConflict = () => {
    setNotice(ALREADY_REVIEWED_NOTICE);
    afterDecision();
  };
  const reset = () => { setData(null); setPage(1); setOpenId(null); setDetails({}); };
  const setFilter = (id) => { reset(); setNotice(null); setParams({ tab: id }); };
  const setTenant = (id) => { reset(); setTenantId(id); };

  const rows = data?.items || [];
  const showActions = operator && filter.id === 'pending';

  return (
    <div className="ops mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Intent review</h1>
        <p className="text-sm text-muted-foreground">
          AI assessments of calls that a person needs to confirm. Approving one makes it the lead's current intent.
        </p>
      </header>

      {superAdmin && <div className="flex flex-wrap items-end gap-3"><TenantPicker value={tenantId} onChange={setTenant} /></div>}

      <div role="tablist" aria-label="Intent review" className="flex flex-wrap gap-1 border-b border-border">
        {INTENT_REVIEW_FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter.id === f.id} onClick={() => setFilter(f.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${filter.id === f.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {f.label}{filter.id === f.id && data ? <span className="ops-num ml-1 rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs">{data.total}</span> : null}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className="ops-tone ops-tone-warn flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-sm">
          <span className="flex-1">{notice}</span>
          <OpsButton size="sm" variant="quiet" onClick={() => setNotice(null)}>Dismiss</OpsButton>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && ready && data === null && <SkeletonRows rows={5} label="Loading the review queue" />}
      {!error && data && rows.length === 0 && (
        <EmptyState title={filter.id === 'pending' ? 'Nothing waiting for review.' : `No ${filter.label.toLowerCase()} assessments.`} />
      )}
      {!error && rows.length > 0 && (
        <ScrollTable label={`${filter.label} assessments`}>
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2"><span className="sr-only">Details</span></th>
              <th className="px-4 py-2 font-semibold">Lead</th>
              <th className="px-4 py-2 font-semibold">Queued</th>
              <th className="px-4 py-2 font-semibold">Why it needs review</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              {filter.id !== 'pending' && <th className="px-4 py-2 font-semibold">Reviewed</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const open = openId === item.assessment_id;
              const name = item.prospect_name || 'Lead';
              const panelId = `intent-details-${item.assessment_id}`;
              return (
                <Fragment key={item.review_id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-2 py-2.5">
                      <button type="button" onClick={() => toggle(item.assessment_id)} aria-expanded={open} aria-controls={panelId}
                        aria-label={`${open ? 'Hide' : 'Show'} details for ${name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))]">
                        {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      <Link to={`/leads?prospect=${item.prospect_id}`} className="text-[color:var(--ops-accent-ink)] hover:underline">{name}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5"><RelativeTime iso={item.created_at} /></td>
                    <td className="whitespace-pre-line px-4 py-2.5 text-muted-foreground">{item.reason}</td>
                    <td className="px-4 py-2.5"><StatusBadge label={humanize(item.review_status)} tone={REVIEW_TONES[item.review_status]} /></td>
                    {filter.id !== 'pending' && <td className="whitespace-nowrap px-4 py-2.5"><RelativeTime iso={item.reviewed_at} /></td>}
                  </tr>
                  {open && (
                    <tr className="border-b border-border bg-[hsl(var(--surface-2))] last:border-0">
                      <td colSpan={filter.id !== 'pending' ? 6 : 5} id={panelId} className="space-y-4 px-4 py-4">
                        <AssessmentDetails state={details[item.assessment_id]} onRetry={() => fetchDetails(item.assessment_id)} />
                        {showActions && details[item.assessment_id]?.data && (
                          <div className="flex flex-wrap gap-2">
                            <OpsButton size="sm" variant="primary" onClick={() => setActing({ item, decision: 'approved' })}>Approve</OpsButton>
                            <OpsButton size="sm" variant="outline" onClick={() => setActing({ item, decision: 'edit', assessment: details[item.assessment_id].data })}>Edit &amp; approve</OpsButton>
                            <OpsButton size="sm" variant="outline" onClick={() => setActing({ item, decision: 'rejected' })}>Reject</OpsButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </ScrollTable>
      )}

      {data?.total_pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm">
          <OpsButton size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</OpsButton>
          <span className="ops-num text-muted-foreground">Page {page} of {data.total_pages}</span>
          <OpsButton size="sm" variant="outline" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>Next</OpsButton>
        </nav>
      )}

      {acting?.decision === 'edit' && (
        <EditApproveDialog item={acting.item} assessment={acting.assessment} scope={scope}
          onClose={() => setActing(null)} onDone={afterDecision} onConflict={afterConflict} />
      )}
      {acting && acting.decision !== 'edit' && (
        <ReviewDialog item={acting.item} decision={acting.decision} scope={scope}
          onClose={() => setActing(null)} onDone={afterDecision} onConflict={afterConflict} />
      )}
    </div>
  );
}
