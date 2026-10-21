import { Fragment, useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getIntentAssessment, getIntentReviewQueue, reviewIntentAssessment } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canOperate, isSuperAdmin } from '@/lib/rbac';
import { ALREADY_REVIEWED_NOTICE, REVIEW_TONES, humanize } from '@/lib/intent';
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

      {acting && (
        <ReviewDialog item={acting.item} decision={acting.decision} scope={scope}
          onClose={() => setActing(null)} onDone={afterDecision} onConflict={afterConflict} />
      )}
    </div>
  );
}
