import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { readable, stageTone } from './conversionUi';

/**
 * Right-hand drawer listing the conversion decisions waiting for review.
 * `pending` are the loaded prospects that have a pending decision (the workspace row carries its
 * id and proposed stage). Only an authorised reviewer gets Approve / Reject; the backend still
 * revalidates policy and evidence on every decision.
 */
export default function ApprovalDesk({ open, onOpenChange, pending, awaiting, reviewer, onView, onAction }) {
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

          {!pending.length && (
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
            </article>
          ))}

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
