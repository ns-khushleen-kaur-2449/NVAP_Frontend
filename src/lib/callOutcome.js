// vapi_call_logs.status values. A finished call stores its classified outcome
// (backend: app/features/voice/metrics.py); "completed", "failed" and
// "no-answer" exist only on rows written before that and mean nothing about
// whether anyone answered. Connected is "answered" only.

const TONES = {
  good: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25',
  live: 'bg-blue-500/15 text-blue-600 border-blue-500/25',
  waiting: 'bg-amber-500/15 text-amber-700 border-amber-500/25',
  bad: 'bg-red-500/15 text-red-600 border-red-500/25',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export const CALL_STATUSES = {
  answered: { label: 'Answered', tone: 'good' },
  no_answer: { label: 'No answer', tone: 'neutral' },
  busy: { label: 'Busy', tone: 'neutral' },
  voicemail: { label: 'Voicemail', tone: 'neutral' },
  not_reachable: { label: 'Not reachable', tone: 'bad' },
  error: { label: 'Error', tone: 'bad' },
  unknown: { label: 'Unknown outcome', tone: 'neutral' },
  initiated: { label: 'Initiated', tone: 'waiting' },
  queued: { label: 'Queued', tone: 'waiting' },
  ringing: { label: 'Ringing', tone: 'live' },
  'in-progress': { label: 'In progress', tone: 'live' },
  // Rows from before the outcome mapping.
  completed: { label: 'Ended (outcome not recorded)', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'bad' },
  'no-answer': { label: 'No answer', tone: 'neutral' },
};

/** Status filter options for /api/call-logs?status= (stored values). */
export const CALL_STATUS_FILTERS = [
  'answered', 'no_answer', 'busy', 'voicemail', 'not_reachable', 'error', 'unknown', 'in-progress', 'initiated',
].map((value) => ({ value, label: CALL_STATUSES[value].label }));

export function callStatusMeta(status) {
  const meta = CALL_STATUSES[status] || { label: status || 'Unknown', tone: 'neutral' };
  return { ...meta, className: TONES[meta.tone] };
}

export const isConnectedStatus = (status) => status === 'answered';

const NOT_CONNECTED = new Set(['no_answer', 'busy', 'voicemail', 'not_reachable', 'error', 'unknown', 'failed', 'no-answer']);
/** A finished call nobody (provably) answered. Legacy "completed" is neither connected nor this. */
export const isNotConnectedStatus = (status) => NOT_CONNECTED.has(status);
