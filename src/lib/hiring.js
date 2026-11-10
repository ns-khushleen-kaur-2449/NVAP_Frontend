/**
 * The Hiring agent's words and rules on the frontend (backend: app/agents/hiring).
 *
 * The backend enforces every rule; this only says how its values read and what a form checks before sending.
 */

export const MAX_INTAKE_QUESTIONS = 8;
// Lists load this many rows at a time, up to the backend's cap.
export const PAGE_SIZE = 50;
export const MAX_ROWS = 200;

/** label + tone (components/ops/StatusBadge) for each backend value. An unknown value is shown as it is. */
export const JOB_STATUS = Object.freeze({
  open: { label: 'Open', tone: 'good' },
  closed: { label: 'Closed', tone: 'neutral' },
});

export const CONSENT_STATUS = Object.freeze({
  unknown: { label: 'Not recorded', tone: 'warn' },
  granted: { label: 'Granted', tone: 'good' },
  withdrawn: { label: 'Withdrawn', tone: 'bad' },
});

export const BOOKING_STATUS = Object.freeze({
  draft: { label: 'Not called yet', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'accent' },
  incomplete: { label: 'Incomplete', tone: 'warn' },
  needs_review: { label: 'Needs review', tone: 'warn' },
  completed: { label: 'Completed', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'bad' },
  no_show: { label: 'No show', tone: 'warn' },
});

export const statusOf = (map, value) => map[value] || { label: value, tone: 'neutral' };

export const candidateName = (candidate) =>
  [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ');

/** A fresh key for one user action (create a booking, place a call), kept across retries of that same action. */
export function newKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context (https or localhost); a dev server on a LAN address has none.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The question set as the backend takes it: trimmed, 1 to 8, none blank. `{ questions }` or `{ error }`. */
export function checkQuestions(texts) {
  const questions = texts.map((text) => text.trim());
  if (questions.length === 0) return { error: 'Add at least one question.' };
  if (questions.length > MAX_INTAKE_QUESTIONS) return { error: `At most ${MAX_INTAKE_QUESTIONS} questions.` };
  if (questions.some((text) => !text)) return { error: 'A question cannot be empty.' };
  return { questions };
}

/** A candidate form's problem before sending, or null. The backend checks the same and the phone number. */
export function candidateProblem(form) {
  if (!form.first_name.trim()) return 'First name is required.';
  if (!form.phone_number.trim()) return 'Phone number is required.';
  if (form.consent_status === 'granted' && !form.consent_source.trim()) {
    return 'Say how consent was given (for example "application form").';
  }
  return null;
}

/** A 403 from a Hiring route: the backend's reason (agent not available, or no permission). */
export const isForbidden = (error) => error?.response?.status === 403;
