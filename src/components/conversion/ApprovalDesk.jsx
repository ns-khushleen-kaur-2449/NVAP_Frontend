import { CheckCircle2, CircleAlert, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import {
  RECALCULATE_ACTIONS, SCORE_ACTIONS, SCORE_SITUATIONS, readable, reviewReasons, stageTone,
} from './conversionUi';

// A pending approval whose lead score is no longer usable: a warning, never a block.
function ScoreWarning({ warning }) {
  if (!warning) return null;
  return (
    <div role="note" className="ops-tone ops-tone-warn mt-3 rounded-lg p-2.5 text-xs" data-testid="score-warning">
      <p className="flex gap-1.5 font-semibold"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        The score used for this proposal is no longer usable.</p>
      <p className="mt-1">{SCORE_SITUATIONS[warning.situation] || readable(warning.situation)}
        {warning.recommended_action && ` ${SCORE_ACTIONS[warning.recommended_action] || readable(warning.recommended_action)}`}</p>
      <p className="mt-1 text-muted-foreground">You can still approve it.</p>
    </div>
  );
}

// A decision waiting for human review (HUMAN_REVIEW / REVIEW_REQUIRED): why, and what to do.
function ReviewCard({ prospect, reviewer, onView, onAction }) {
  const gate = prospect.review_score_gate;
  const skipped = gate && gate.evaluated === false;
  const reasons = reviewReasons(prospect.review_reason_codes);
  return (
    <article className="ops-card p-4" data-testid={`review-${prospect.prospect_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{prospect.full_name || 'Unnamed prospect'}</h3>
          <p className="truncate text-xs text-muted-foreground" title={prospect.email || undefined}>{prospect.email || 'No email recorded'}</p>
        </div>
        <StatusBadge label="Needs review" tone="info" />
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {skipped && <li>{SCORE_SITUATIONS[gate.situation] || readable(gate.situation)}</li>}
        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {skipped && gate.recommended_action && (
        <p className="mt-2 text-sm"><span className="text-muted-foreground">Recommended: </span>
          {SCORE_ACTIONS[gate.recommended_action] || readable(gate.recommended_action)}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        No stage change was proposed, so there is nothing to approve. Resolve the reason, then reassess.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <OpsButton size="sm" onClick={() => onView(prospect.prospect_id)}>View prospect</OpsButton>
        {reviewer && <>
          {skipped && RECALCULATE_ACTIONS.has(gate.recommended_action) && (
            <OpsButton size="sm" onClick={() => onAction('recalculate', prospect)}>Recalculate score</OpsButton>
          )}
          <OpsButton size="sm" variant="primary" onClick={() => onAction('reassess', prospect)}>
            <RefreshCw className="h-4 w-4" /> Reassess</OpsButton>
          <OpsButton size="sm" variant="danger" onClick={() => onAction('dismiss', { id: prospect.review_decision_id, detail: { target_stage: null } })}>
            Dismiss</OpsButton>
        </>}
      </div>
    </article>
  );
}

/**
 * Right-hand drawer listing the conversion decisions waiting for a person.
 * `pending` are the loaded prospects that have a pending approval (the workspace row carries its
 * id and proposed stage); `reviews` those whose newest decision waits for human review.  Only an
 * authorised reviewer gets the actions; the backend still revalidates policy and evidence on every
 * decision.  A pending approval whose score is no longer usable shows a warning; it can still be approved.
 */
export default function ApprovalDesk({ open, onOpenChange, pending, reviews = [], awaiting, reviewer, onView, onAction }) {
  const hidden = Math.max(0, (awaiting || 0) - pending.length);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* "ops" gives the drawer the page's colour tokens: it renders outside the page container. */}
      <SheetContent side="right" className="ops flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border p-5 pr-12">
          <SheetTitle className="text-lg">Approval desk</SheetTitle>
          <SheetDescription>Conversion decisions waiting for an authorised reviewer.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {!reviewer && (
            <div role="note" className="ops-tone ops-tone-info rounded-xl p-3 text-sm">
              You have read-only access. Tenant admins approve or reject conversions.
            </div>
          )}

          {!pending.length && !reviews.length && (
            <div className="ops-card border-dashed px-6 py-10 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-[color:var(--ops-good)]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">All caught up!</p>
              <p className="mt-1 text-sm text-muted-foreground">There are no conversion decisions waiting for review.</p>
            </div>
          )}

          {pending.map((prospect) => (
            <article key={prospect.prospect_id} className="ops-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{prospect.full_name || 'Unnamed prospect'}</h3>
                  <p className="truncate text-xs text-muted-foreground" title={prospect.email || undefined}>{prospect.email || 'No email recorded'}</p>
                </div>
                <StatusBadge label="Pending" tone="warn" />
              </div>
              <dl className="mt-3 text-sm">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="text-muted-foreground">Stage change</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-1.5 font-medium">
                    <StatusBadge label={readable(prospect.current_stage)} tone={stageTone(prospect.current_stage)} />
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">to</span>
                    <StatusBadge label={readable(prospect.pending_target_stage)} tone={stageTone(prospect.pending_target_stage)} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="text-muted-foreground">Evidence</dt>
                  <dd className="font-medium">{prospect.unverified_evidence_count > 0 ? `${prospect.unverified_evidence_count} to verify` : 'Nothing waiting to verify'}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <OpsButton size="sm" onClick={() => onView(prospect.prospect_id)}>View prospect</OpsButton>
                {reviewer && <>
                  <OpsButton size="sm" variant="primary" onClick={() => onAction('approve', { id: prospect.pending_decision_id, detail: { target_stage: prospect.pending_target_stage } })}><CheckCircle2 className="h-4 w-4" /> Approve</OpsButton>
                  <OpsButton size="sm" variant="danger" onClick={() => onAction('reject', { id: prospect.pending_decision_id, detail: { target_stage: prospect.pending_target_stage } })}><XCircle className="h-4 w-4" /> Reject</OpsButton>
                </>}
              </div>
              <ScoreWarning warning={prospect.pending_score_warning} />
            </article>
          ))}

          {reviews.length > 0 && (
            <section aria-labelledby="needs-review" className="space-y-3 pt-2">
              <h3 id="needs-review" className="text-sm font-semibold">Needs review ({reviews.length})</h3>
              <p className="text-xs text-muted-foreground">Evaluations a person must look at before anything changes.</p>
              {reviews.map((prospect) => (
                <ReviewCard key={prospect.prospect_id} prospect={prospect} reviewer={reviewer} onView={onView} onAction={onAction} />
              ))}
            </section>
          )}

          {hidden > 0 && (
            <p role="note" className="ops-tone ops-tone-warn rounded-xl p-3 text-sm">
              {hidden} more {hidden === 1 ? 'decision is' : 'decisions are'} waiting outside the loaded list. Search for the prospect to review {hidden === 1 ? 'it' : 'them'}.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <p className="flex gap-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Audit-safe by design: the canonical stage lives in the prospect record, and evidence, decisions, reviews and executed transitions stay separately auditable.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
