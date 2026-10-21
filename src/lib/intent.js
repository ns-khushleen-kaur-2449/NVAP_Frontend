// Formatting for intent assessments and their review queue. Formatting only: every value
// comes from the API (/api/intent-assessment).

/** "demo_request" -> "Demo request". Values are the backend's snake_case enums. */
export function humanize(value) {
  if (!value) return '—';
  const text = String(value).replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Review statuses -> tone (StatusBadge); the label is humanize(status).
export const REVIEW_TONES = { pending: 'warn', approved: 'good', rejected: 'neutral' };

// customer_status -> tone.
export const CUSTOMER_STATUS_TONES = {
  high_intent: 'good', medium_intent: 'info', low_intent: 'neutral', nurture: 'accent',
  no_intent: 'neutral', disqualified: 'bad', unknown: 'warn',
};

/** Objections are stored as "type: description". */
export function splitObjection(text) {
  const at = String(text || '').indexOf(': ');
  if (at < 0) return { label: humanize(text), detail: null };
  return { label: humanize(text.slice(0, at)), detail: text.slice(at + 2) };
}

// The review endpoint's 409 when someone else decided first.
export const ALREADY_REVIEWED_NOTICE = 'Someone else reviewed this assessment first. The list now shows the latest status.';
