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
export const isNotFound = (error) => error?.response?.status === 404;

export const HIRING_BOOKINGS_PATH = '/hiring_agent/bookings';
export const bookingPath = (id) => `${HIRING_BOOKINGS_PATH}/${id}`;

// ── Calls (backend app/agents/hiring/calls.py, results.py, recovery.py) ──

// Calls per booking that may reach the candidate; a call that was definitely not placed does not count.
export const MAX_CALL_ATTEMPTS = 3;
const CALLABLE_BOOKING_STATUSES = ['draft', 'scheduled', 'incomplete', 'needs_review'];
const ACTIVE_CALL_STATUSES = ['dialing', 'in_progress', 'unknown_dispatch'];

// A booking page refreshes every 5 s while a call runs or its summary is awaited, otherwise as the lists do.
export const LIVE_REFRESH_MS = 5000;
export const IDLE_REFRESH_MS = 30000;

/** One call attempt. */
export const CALL_STATUS = Object.freeze({
  dialing: { label: 'Dialling', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  dial_failed: { label: 'Not placed', tone: 'bad' },
  unknown_dispatch: { label: 'Not confirmed yet', tone: 'warn' },
});

/** How the call went (the platform's call outcome), and the live states while it runs. */
const CALL_OUTCOME = Object.freeze({
  answered: { label: 'Answered', tone: 'good' },
  no_answer: { label: 'No answer', tone: 'warn' },
  busy: { label: 'Busy', tone: 'warn' },
  voicemail: { label: 'Voicemail', tone: 'warn' },
  not_reachable: { label: 'Not reachable', tone: 'bad' },
  error: { label: 'Call error', tone: 'bad' },
  unknown: { label: 'Outcome unknown', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  ringing: { label: 'Ringing', tone: 'info' },
  'in-progress': { label: 'On the call', tone: 'info' },
});

/**
 * The interview result, only from the backend's decision: an answered call is never shown as a completed
 * interview unless the result says so.
 */
export const INTERVIEW_RESULT = Object.freeze({
  completed: { label: 'Interview completed', tone: 'good' },
  incomplete: { label: 'Interview incomplete', tone: 'warn' },
  not_interviewed: { label: 'Not interviewed', tone: 'neutral' },
  needs_review: { label: 'Needs review', tone: 'warn' },
});
const AWAITING_RESULT = Object.freeze({ label: 'Waiting for the summary', tone: 'info' });

export const QUESTION_RESULT = Object.freeze({
  answered: { label: 'Answered', tone: 'good' },
  declined: { label: 'Declined', tone: 'neutral' },
  not_asked: { label: 'Not asked', tone: 'warn' },
});

// Why a result needs a person (as the backend's notifications word it, app/agents/hiring/notices.py).
const RESULT_PROBLEM = Object.freeze({
  summary_missing: 'The call summary has no answers.',
  summary_unreadable: 'The call summary could not be read.',
  unknown_question: "The call summary does not match the call's questions.",
  duplicate_question: "The call summary does not match the call's questions.",
  summary_timeout: 'No call summary arrived.',
  snapshot_missing: "The call's questions were not saved.",
});

const NOT_SET_UP = 'Hiring calls are not set up yet. Ask your platform administrator.';
const UNCONFIRMED = 'The call was sent but is not confirmed yet. It is being checked and is never dialled again on its own.';
// A call's failure_code, as words. Codes only: the backend never sends the provider's own message.
const CALL_FAILURE = Object.freeze({
  provider_rejected: 'The phone provider refused the call.',
  provider_unreachable: 'The phone provider could not be reached.',
  no_call_id: 'The phone provider did not confirm the call.',
  not_configured: NOT_SET_UP,
  call_context_unavailable: NOT_SET_UP,
  not_found_at_provider: 'The phone provider has no record of this call, so it was not placed.',
  recovery_gave_up: 'The phone provider never reported how this call ended.',
  timeout: UNCONFIRMED,
  provider_error: UNCONFIRMED,
  unexpected: UNCONFIRMED,
  call_id_conflict: UNCONFIRMED,
});

// What to do after "Call candidate" is refused (POST .../calls, detail.code). The message is the backend's.
const REFUSAL_HINT = Object.freeze({
  consent_required: "Record the candidate's consent on the Candidates tab, then call.",
  invalid_phone: "Correct the candidate's phone number on the Candidates tab.",
  no_questions: 'Add intake questions to the job on the Jobs tab, then call.',
  job_closed: 'Reopen the job on the Jobs tab to call.',
  call_in_progress: 'Wait for it to end: this page updates on its own.',
  calls_not_set_up: 'Ask your platform administrator to finish setting up Hiring calls.',
  not_configured: 'Ask your platform administrator to finish setting up Hiring calls.',
  call_context_unavailable: 'Ask your platform administrator to finish setting up Hiring calls.',
});

export const isCallActive = (call) => ACTIVE_CALL_STATUSES.includes(call.status);
export const awaitingResult = (call) => call.status === 'ended' && !call.interview_outcome;

/** The call's outcome badge: how an ended call went, or its live state while it runs; null otherwise. */
export function callOutcome(call) {
  if (call.status !== 'ended' && call.status !== 'in_progress') return null;
  const outcome = CALL_OUTCOME[call.outcome];
  if (!outcome) return null;
  const live = outcome.tone === 'info';
  return call.status === 'ended' ? (live ? null : outcome) : (live ? outcome : null);
}

/** The interview result badge: the backend's result, "waiting" for an ended call without one, else null. */
export function interviewResult(call) {
  if (call.interview_outcome) return statusOf(INTERVIEW_RESULT, call.interview_outcome);
  return awaitingResult(call) ? AWAITING_RESULT : null;
}

/** Why the call was not placed, is unconfirmed, or never ended properly; null when nothing went wrong. */
export function callProblem(call) {
  if (!call.failure_code) return null;
  return CALL_FAILURE[call.failure_code]
    || (call.status === 'unknown_dispatch' ? UNCONFIRMED : 'The call could not be placed.');
}

/** Why a result needs review, in words; null unless it does. */
export function resultProblem(call) {
  if (call.interview_outcome !== 'needs_review') return null;
  return RESULT_PROBLEM[call.result_problem] || 'The call result needs someone to look at it.';
}

export const callsUsed = (calls = []) => calls.filter((call) => call.status !== 'dial_failed').length;

/**
 * Why "Call candidate" is off right now, or null. Only what the page already knows; the backend checks the rest
 * (consent, job, questions, phone number, calling hours) and its refusal is shown.
 */
export function callBlocker(booking, calls = []) {
  if (booking.status === 'completed') return 'This interview is already completed.';
  if (!CALLABLE_BOOKING_STATUSES.includes(booking.status)) {
    return `A ${statusOf(BOOKING_STATUS, booking.status).label.toLowerCase()} booking cannot be called.`;
  }
  if (calls.some((call) => call.status === 'unknown_dispatch')) return 'The last call is still being confirmed.';
  if (calls.some(isCallActive)) return 'A call is in progress.';
  if (callsUsed(calls) >= MAX_CALL_ATTEMPTS) return `This booking has had ${MAX_CALL_ATTEMPTS} calls already.`;
  return null;
}

/** How often a booking page refreshes: often while a call runs or its summary is awaited. */
export const refreshInterval = (calls = []) =>
  (calls.some((call) => isCallActive(call) || awaitingResult(call)) ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);

/** A refused or failed "Call candidate": `{ message, hint }`, from the backend's code and message. */
export function callRefusal(error) {
  const detail = error?.response?.data?.detail;
  const code = detail && typeof detail === 'object' ? detail.code : null;
  const message = (detail && typeof detail === 'object' ? detail.message : detail)
    || CALL_FAILURE[code] || 'The call could not be placed.';
  return { message, hint: REFUSAL_HINT[code] || null };
}

/** The toast after "Call candidate" got an answer: 201 placed, 200 that click's call again, 202 unconfirmed. */
export function callStarted(status, candidate) {
  if (status === 202) return { kind: 'warning', text: UNCONFIRMED };
  if (status === 200) return { kind: 'info', text: 'That call was already placed.' };
  return { kind: 'success', text: `Calling ${candidate}` };
}
