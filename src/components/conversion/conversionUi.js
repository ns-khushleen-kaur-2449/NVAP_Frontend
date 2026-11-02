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

// A prospect needs a person's attention when a decision is waiting or evidence is unverified.
export const needsAttention = (prospect) => Boolean(prospect.pending_decision_id) || prospect.unverified_evidence_count > 0;

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
