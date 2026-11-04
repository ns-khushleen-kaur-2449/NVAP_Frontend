import { toast } from 'sonner';
import { approveConversionDecision, rejectConversionDecision, verifyConversionEvidence } from '@/lib/api';
import { errorMessage } from '@/hooks/useApiAction';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { readable, requestId } from './conversionUi';

/**
 * Approve, reject or dismiss a conversion decision. `decision` needs `id` and `detail.target_stage`.
 * `dismiss` closes a decision that waits for human review (no stage change was proposed);
 * it is recorded like a rejection.
 */
export function DecisionDialog({ action, decision, scope, onClose, onDone }) {
  if (action === 'dismiss') return <DismissDialog decision={decision} scope={scope} onClose={onClose} onDone={onDone} />;
  const rejecting = action === 'reject';
  const submit = async (reason) => {
    const body = { ...scope, reason: reason || undefined, idempotency_key: requestId() };
    try {
      if (rejecting) await rejectConversionDecision(decision.id, body);
      else await approveConversionDecision(decision.id, body);
      toast.success(rejecting ? 'Conversion decision rejected' : 'Conversion approved and stage transition executed');
      await onDone();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'The decision could not be updated. Refresh and try again.'));
      return false;
    }
  };
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title={`${rejecting ? 'Reject' : 'Approve'} conversion decision`}
      description={rejecting
        ? 'This keeps the proposal and its audit trail, but prevents a stage transition.'
        : 'The backend will revalidate policy and evidence before executing the stage transition.'}
      changes={rejecting
        ? ['The proposal will be recorded as rejected.', 'The prospect’s current stage will remain unchanged.']
        : [`The proposed stage is ${readable(decision.detail.target_stage)}.`, 'A successful review is recorded with the resulting stage event.']}
      confirmLabel={rejecting ? 'Reject decision' : 'Approve decision'} danger={rejecting}
      requireReason={rejecting} reasonLabel={rejecting ? 'Rejection reason' : 'Approval note'}
      reasonPlaceholder={rejecting ? 'Why should this conversion not proceed?' : 'Optional audit note'}
      onConfirm={submit}
    />
  );
}

function DismissDialog({ decision, scope, onClose, onDone }) {
  const submit = async (reason) => {
    try {
      await rejectConversionDecision(decision.id, { ...scope, reason, idempotency_key: requestId() });
      toast.success('Review dismissed');
      await onDone();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'The review could not be dismissed. Refresh and try again.'));
      return false;
    }
  };
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title="Dismiss review"
      description="Closes this review without changing the prospect. Reassess later to evaluate the prospect again."
      changes={['The review will be recorded as dismissed, with your reason.', 'The prospect\u2019s current stage will remain unchanged.']}
      confirmLabel="Dismiss review" requireReason reasonLabel="Reason"
      reasonPlaceholder="Why is no action needed now?" onConfirm={submit}
    />
  );
}

export function VerifyDialog({ candidate, prospectId, scope, onClose, onDone }) {
  const submit = async (reason) => {
    try {
      await verifyConversionEvidence(prospectId, {
        ...scope,
        policy_id: candidate.policy_id,
        policy_version: candidate.policy_version,
        policy_hash: candidate.policy_hash,
        criterion_code: candidate.criterion_code,
        evidence_candidate_id: candidate.evidence_candidate_id,
        verification_reason: reason,
        idempotency_key: requestId(),
      });
      toast.success('Evidence verified and queued for reassessment');
      await onDone();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'The evidence could not be verified.'));
      return false;
    }
  };
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title="Verify evidence"
      description="Confirm that this candidate is accurate. Verification is immutable and becomes part of the conversion audit trail."
      changes={[
        `${readable(candidate.criterion_code)} will be treated as verified evidence.`,
        'A conversion reassessment may be queued; no stage changes happen from this action alone.',
      ]}
      confirmLabel="Verify evidence" reasonLabel="Reviewer reason / audit note"
      reasonPlaceholder="Why is this evidence reliable?" onConfirm={submit}
    />
  );
}
