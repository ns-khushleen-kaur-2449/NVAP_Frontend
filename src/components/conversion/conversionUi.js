// Shared constants and formatters for the Conversion Workspace.

// The canonical stage flow (ProspectStatus in the backend): NEW -> ... -> CONVERTED,
// with DISQUALIFIED and DO_NOT_CONTACT reachable from any stage.
export const STAGE_FLOW = ['NEW', 'CONTACTED', 'ENGAGED', 'MEETING', 'QUALIFIED', 'CONVERTED'];
export const SIDE_STAGES = ['DISQUALIFIED', 'DO_NOT_CONTACT'];
export const DO_NOT_CONTACT = 'DO_NOT_CONTACT';

export const stageTone = (stage) => ({
  QUALIFIED: 'good', CONVERTED: 'accent', MEETING: 'info', ENGAGED: 'info', CONTACTED: 'warn',
  DISQUALIFIED: 'bad', DO_NOT_CONTACT: 'bad',
}[stage] || 'neutral');

export const decisionTone = (status) => ({
  PENDING_APPROVAL: 'warn', PROPOSED: 'warn', APPROVED: 'good', REJECTED: 'bad', EXECUTED: 'good',
}[status] || 'neutral');

export const readable = (value) => String(value || 'Not available').replaceAll('_', ' ').toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const requestId = () => window.crypto?.randomUUID?.()
  || `conversion-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// A prospect needs a person's attention when a decision is waiting (for approval or for review)
// or evidence is unverified.
export const needsAttention = (prospect) => Boolean(prospect.pending_decision_id) || Boolean(prospect.review_decision_id)
  || prospect.unverified_evidence_count > 0;

// The lead score gate situations (rule_check_result.lead_score_gate.situation), in plain words.
export const SCORE_SITUATIONS = {
  method_unavailable: 'The lead scoring method could not be loaded, so the score could not be checked.',
  no_score: 'The lead has no score, and lacks the details needed to calculate one.',
  pending_calculation: 'The lead has not been scored yet.',
  stale: 'The score is out of date: a historical value, not a current score.',
  provisional: 'The score is provisional: there is not enough reliable conversation information yet.',
  recalculation_due: 'The score is due for recalculation: its details or settings have changed.',
  outdated_evidence: 'The call assessment behind the score is more than 180 days old.',
  policy_age_exceeded: 'The score is older than the conversion policy accepts.',
};

// recommended_action, in plain words.
export const SCORE_ACTIONS = {
  check_scoring_configuration: 'Check the lead scoring settings.',
  add_fit_data: 'Add the lead\u2019s seniority, department or company size.',
  calculate_score: 'Calculate the lead\u2019s score.',
  add_fit_data_then_recalculate: 'Add the missing details, then recalculate the score.',
  recalculate_score: 'Recalculate the lead\u2019s score.',
  obtain_assessed_conversation: 'Have an assessed conversation with the lead.',
};
// Actions the workspace can do for the reviewer.
export const RECALCULATE_ACTIONS = new Set(['calculate_score', 'recalculate_score']);

// Why a decision waits for review (reason codes), in plain words; others are shown readably.
const REVIEW_REASONS = {
  LEAD_SCORE_GATE_NOT_EVALUATED: 'The policy\u2019s lead score minimum could not be checked.',
  CONTRADICTORY_EVIDENCE: 'The verified evidence contradicts itself.',
  MISSING_VERIFIED_EVIDENCE: 'Required evidence has not been verified yet.',
  STALE_EVIDENCE: 'Required evidence has expired.',
  LEAD_SCORE_BELOW_MINIMUM: 'The lead score is below the policy minimum.',
  UNINITIALIZED_SALES_STAGE: 'The lead\u2019s sales stage has not been set up.',
  TRANSITION_NOT_ALLOWED: 'No stage change is allowed from the current stage.',
};
const QUIET_REASONS = new Set(['SCORE_MISSING', 'INTENT_MISSING', 'LEAD_SCORE_RECALCULATION_RECOMMENDED', 'SCORE_STALE',
  'LEAD_SCORE_MINIMUM_MET']);

export const reviewReasons = (codes = []) => codes
  .filter((code) => !QUIET_REASONS.has(code) && !code.startsWith('LEAD_SCORE_GATE_SKIPPED_'))
  .map((code) => REVIEW_REASONS[code] || readable(code));

export const SORT_OPTIONS = [
  { value: 'default', label: 'As returned' },
  { value: 'attention', label: 'Needs attention first' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name A–Z' },
];

/** Apply the explorer's filter and sort to the loaded prospects (the backend pages and searches; this refines a page). */
export function refineProspects(prospects, stageFilter, sort) {
  let list = prospects;
  if (stageFilter === 'attention') list = list.filter(needsAttention);
  else if (stageFilter !== 'all') list = list.filter((prospect) => prospect.current_stage === stageFilter);
  const compare = {
    name: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
    updated: (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
    attention: (a, b) => Number(needsAttention(b)) - Number(needsAttention(a)),
  }[sort];
  return compare ? [...list].sort(compare) : list;
}
