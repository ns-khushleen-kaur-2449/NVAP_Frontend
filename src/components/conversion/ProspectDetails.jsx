import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ops/States';
import { formatDateTime, relativeTime } from '@/lib/ops';
import ConversionTimeline from './ConversionTimeline';
import { DO_NOT_CONTACT, decisionTone, readable, stageTone } from './conversionUi';

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[62%] break-words text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function Tile({ label, children }) {
  return (
    <div className="flex min-h-[76px] min-w-0 flex-col rounded-xl border border-border bg-[hsl(var(--surface-2))] p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-auto pt-1 text-[15px] font-semibold">{children}</dd>
    </div>
  );
}

/**
 * Centre pane: who the prospect is, where they stand, and why.
 * Everything shown comes from the workspace row or the prospect's timeline/evidence; a missing
 * field reads "Not available" rather than being filled in.
 */
export default function ProspectDetails({
  prospect, detail, detailError, onRetry, tab, onTab, reviewer, onAction, onBack, className,
}) {
  if (!prospect) {
    return (
      <section className={cn('ops-card min-h-[320px] min-w-0 flex-col overflow-hidden', className)}>
        <div className="p-8"><EmptyState title="Select a prospect to inspect conversion activity." body="Their stage, evidence and decisions appear here." /></div>
      </section>
    );
  }

  const timeline = detail?.timeline || [];
  const decisions = timeline.filter((item) => item.type === 'decision');
  const pendingDecision = decisions.find((item) => String(item.id) === String(prospect.pending_decision_id));
  const assessment = (pendingDecision || decisions[0])?.detail;
  // The timeline is newest first, so the first review per decision is the latest.
  const reviewOf = new Map();
  timeline.filter((item) => item.type === 'review').forEach((item) => { if (!reviewOf.has(String(item.detail.decision_id))) reviewOf.set(String(item.detail.decision_id), item); });
  const lastStageChange = timeline.find((item) => item.type === 'prospect_stage') || timeline.find((item) => item.type === 'stage_change');
  const evidence = detail?.evidence || [];
  const unverified = evidence.filter((candidate) => candidate.verification_status !== 'VERIFIED').length;
  const restricted = prospect.current_stage === DO_NOT_CONTACT;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Activity timeline', count: timeline.length },
    { id: 'evidence', label: 'Call evidence', count: prospect.unverified_evidence_count },
    { id: 'decisions', label: 'Decisions', count: decisions.length },
  ];
  const onTabKeyDown = (event) => {
    const ids = tabs.map((item) => item.id);
    const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1
      : offset ? (ids.indexOf(tab) + offset + ids.length) % ids.length : null;
    if (target === null) return;
    event.preventDefault();
    onTab(ids[target]);
    document.getElementById(`conversion-tab-${ids[target]}`)?.focus();
  };

  const actions = (decision) => reviewer && (
    <div className="mt-4 flex flex-wrap gap-2">
      <OpsButton variant="primary" onClick={() => onAction('approve', decision)}><CheckCircle2 className="h-4 w-4" /> Approve</OpsButton>
      <OpsButton variant="danger" onClick={() => onAction('reject', decision)}><XCircle className="h-4 w-4" /> Reject</OpsButton>
    </div>
  );

  return (
    <section className={cn('ops-card min-h-[320px] min-w-0 flex-col overflow-hidden', className)}>
      <div className="shrink-0 border-b border-border p-5">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All prospects
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight">{prospect.full_name || 'Unnamed prospect'}</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{prospect.email || 'No email recorded'}</p>
            {prospect.updated_at && <p className="mt-1 text-xs text-muted-foreground">Updated <time dateTime={prospect.updated_at} title={formatDateTime(prospect.updated_at)}>{relativeTime(prospect.updated_at)}</time></p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {restricted && <span className="ops-tone ops-tone-bad inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Outreach blocked</span>}
            <StatusBadge label={readable(prospect.current_stage)} tone={stageTone(prospect.current_stage)} className="px-3 py-1 text-sm" />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Current stage">{readable(prospect.current_stage)}</Tile>
          <Tile label="Latest qualification">{readable(assessment?.qualification_status)}</Tile>
          <Tile label="Proposed stage">{readable(assessment?.target_stage)}</Tile>
        </dl>
      </div>

      <div role="tablist" aria-label="Conversion details" onKeyDown={onTabKeyDown} className="flex shrink-0 overflow-x-auto border-b border-border px-3">
        {tabs.map((item) => (
          <button key={item.id} id={`conversion-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls="conversion-tabpanel"
            tabIndex={tab === item.id ? 0 : -1} onClick={() => onTab(item.id)}
            className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold',
              tab === item.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {item.label}{item.count > 0 && <span className="ops-num ml-1.5 rounded-full bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-xs text-foreground">{item.count}</span>}
          </button>
        ))}
      </div>

      <div id="conversion-tabpanel" role="tabpanel" aria-labelledby={`conversion-tab-${tab}`} className="min-h-[300px] flex-1 overflow-y-auto p-5 lg:min-h-0">
        {detailError && <ErrorState message={detailError} onRetry={onRetry} />}
        {!detail && !detailError && <SkeletonRows rows={4} label="Loading conversion details" />}

        {detail && tab === 'overview' && (
          <div className="space-y-4">
            {restricted && (
              <div role="note" className="ops-tone ops-tone-bad flex gap-3 rounded-xl p-4 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p><strong>Do Not Contact.</strong> This prospect must not be contacted, so no outreach or follow-up actions are offered here.</p>
              </div>
            )}
            <div className="ops-tone ops-tone-info rounded-xl p-4 text-sm">
              The prospect’s canonical stage stays <strong>{readable(prospect.current_stage)}</strong> until an authorized reviewer approves an eligible decision. Evidence is verified separately.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="ops-card p-4">
                <h3 className="font-semibold">Latest conversion assessment</h3>
                <dl className="mt-2">
                  <DetailRow label="Decision status"><StatusBadge label={readable(assessment?.decision_status)} tone={decisionTone(assessment?.decision_status)} /></DetailRow>
                  <DetailRow label="Proposed transition">{assessment?.current_stage ? `${readable(assessment.current_stage)} → ${readable(assessment.target_stage)}` : 'No decision recorded'}</DetailRow>
                  <DetailRow label="Missing criteria">{assessment?.missing_criteria?.length ? assessment.missing_criteria.map(readable).join(', ') : 'None'}</DetailRow>
                  <DetailRow label="Conflicting criteria">{assessment?.conflicting_criteria?.length ? assessment.conflicting_criteria.map(readable).join(', ') : 'None'}</DetailRow>
                  <DetailRow label="Reason codes">{assessment?.reason_codes?.length ? assessment.reason_codes.map(readable).join(', ') : 'None'}</DetailRow>
                  <DetailRow label="Evidence">{evidence.length ? `${evidence.length} captured · ${unverified} to verify` : 'None captured yet'}</DetailRow>
                </dl>
              </section>
              <section className="ops-card p-4">
                <h3 className="font-semibold">Why it is at this stage</h3>
                {lastStageChange ? (
                  <dl className="mt-2">
                    <DetailRow label="Last stage change">{readable(lastStageChange.detail.from_stage)} → {readable(lastStageChange.detail.to_stage)}</DetailRow>
                    <DetailRow label="When"><time title={formatDateTime(lastStageChange.occurred_at)}>{relativeTime(lastStageChange.occurred_at)}</time></DetailRow>
                    <DetailRow label="Reason">{lastStageChange.detail.reason || 'Not available'}</DetailRow>
                    {lastStageChange.detail.actor_type && <DetailRow label="Changed by">{readable(lastStageChange.detail.actor_type)}</DetailRow>}
                  </dl>
                ) : <p className="mt-2 text-sm text-muted-foreground">No stage changes are recorded for this prospect yet.</p>}
              </section>
            </div>
            <section className="ops-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Recent activity</h3>
                {timeline.length > 3 && <button type="button" onClick={() => onTab('timeline')} className="text-sm font-semibold text-[color:var(--ops-accent-ink)] hover:underline">View full timeline</button>}
              </div>
              <div className="mt-3"><ConversionTimeline items={timeline.slice(0, 3)} /></div>
            </section>
          </div>
        )}

        {detail && tab === 'timeline' && <ConversionTimeline items={timeline} />}

        {detail && tab === 'evidence' && (
          <div className="space-y-3">
            {detail.evidenceError && <div className="ops-tone ops-tone-warn rounded-xl p-4 text-sm">{detail.evidenceError}</div>}
            {!detail.evidenceError && !evidence.length && <EmptyState title="No call evidence yet." body="Evidence candidates are detected from call assessments and appear here for verification." />}
            {evidence.map((candidate) => (
              <article key={candidate.evidence_candidate_id} className="ops-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{readable(candidate.criterion_code)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{readable(candidate.source_kind)}</p>
                  </div>
                  <StatusBadge label={readable(candidate.verification_status)} tone={candidate.verification_status === 'VERIFIED' ? 'good' : candidate.verification_status === 'REVOKED' ? 'bad' : 'warn'} />
                </div>
                {Number.isFinite(Number(candidate.extraction_confidence)) && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]" role="img" aria-label={`${candidate.extraction_confidence}% confidence`}>
                      <div className="h-full rounded-full bg-[var(--ops-info)]" style={{ width: `${Math.max(0, Math.min(100, Number(candidate.extraction_confidence)))}%` }} />
                    </div>
                    <span className="ops-num text-xs text-muted-foreground">{candidate.extraction_confidence}% confidence</span>
                  </div>
                )}
                <dl className="mt-2">
                  <DetailRow label="Detected">{formatDateTime(candidate.extracted_at)}</DetailRow>
                  <DetailRow label="Evidence value">{Object.entries(candidate.extracted_value || {}).map(([key, value]) => `${readable(key)}: ${String(value)}`).join(', ') || 'Not available'}</DetailRow>
                </dl>
                {reviewer && candidate.verification_status !== 'VERIFIED' && (
                  <div className="mt-3"><OpsButton size="sm" variant="primary" onClick={() => onAction('verify', candidate)}><ShieldCheck className="h-4 w-4" /> Verify evidence</OpsButton></div>
                )}
              </article>
            ))}
          </div>
        )}

        {detail && tab === 'decisions' && (
          <div className="space-y-3">
            {!decisions.length && <EmptyState title="No conversion decisions for this prospect yet." />}
            {decisions.map((item) => {
              const review = reviewOf.get(String(item.id));
              return (
                <article key={item.id} className="ops-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{readable(item.detail.current_stage)} → {readable(item.detail.target_stage)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Created {formatDateTime(item.occurred_at)}</p>
                    </div>
                    <StatusBadge label={readable(item.detail.decision_status)} tone={decisionTone(item.detail.decision_status)} />
                  </div>
                  {!!item.detail.reason_codes?.length && <div className="mt-3 flex flex-wrap gap-2">{item.detail.reason_codes.map((code) => <StatusBadge key={code} label={readable(code)} tone="neutral" />)}</div>}
                  {review && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{review.detail.action === 'REJECTED' ? 'Rejected' : 'Approved'}</span>
                      {' '}<time title={formatDateTime(review.occurred_at)}>{relativeTime(review.occurred_at)}</time>
                      {review.detail.reason ? ` — ${review.detail.reason}` : ''}
                    </p>
                  )}
                  {String(item.id) === String(prospect.pending_decision_id) && actions(item)}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
