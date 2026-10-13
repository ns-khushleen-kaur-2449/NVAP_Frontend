// Helpers for the AI Filtering screen: the filter format, operator rules and
// API error formatting. Everything here mirrors the backend contract of
// /api/ai/filter (see the "AI Filtering" section of src/lib/api.js).

export const FILTER_VERSION = 1;

// Backend limits. The backend enforces them; these only let the UI stop early.
export const MAX_CONDITIONS = 15;
export const MAX_LIST_VALUES = 50;
export const MAX_TEXT_LENGTH = 100;
export const MIN_CONTAINS_LENGTH = 2;
export const MAX_PARSE_TEXT_LENGTH = 500;
export const MAX_DAYS = 3650;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Highest score first' },
  { value: 'newest', label: 'Newest first' },
];

// Every operator the backend knows. Which ones a field allows comes from
// GET /api/ai/filter/fields (field.operators), never from this list.
export const OPERATOR_LABELS = {
  eq: 'is',
  neq: 'is not',
  in: 'is any of',
  not_in: 'is none of',
  contains: 'contains',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  between: 'between',
  is: 'is',
  in_last_days: 'in the last (days)',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

const NO_VALUE_OPERATORS = ['is_empty', 'is_not_empty'];
const LIST_OPERATORS = ['in', 'not_in'];
// Operators whose value is one plain value of the field's own type.
const SCALAR_OPERATORS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte'];

export const operatorLabel = (op) => OPERATOR_LABELS[op] || op;
export const operatorTakesNoValue = (op) => NO_VALUE_OPERATORS.includes(op);
export const operatorTakesList = (op) => LIST_OPERATORS.includes(op);
export const operatorTakesRange = (op) => op === 'between';

/** The empty value a condition starts with, in the shape its operator expects. */
export function defaultValueFor(op, field) {
  if (operatorTakesNoValue(op)) return null;
  if (operatorTakesList(op)) return [];
  if (operatorTakesRange(op)) return ['', ''];
  if (op === 'is' || field?.type === 'boolean') return true;
  return '';
}

/**
 * The value a condition keeps when only its operator changes: the current value
 * when the new operator takes the same shape, otherwise that operator's default.
 */
export function valueForOperatorChange(previousOp, nextOp, value, field) {
  const sameShape = (operators) => operators.includes(previousOp) && operators.includes(nextOp);
  if (sameShape(SCALAR_OPERATORS) || sameShape(LIST_OPERATORS)) return value;
  return defaultValueFor(nextOp, field);
}

export const emptyFilter = () => ({ version: FILTER_VERSION, match: 'all', conditions: [] });

/** A new condition for `field` (an entry of the /fields response), using its first allowed operator. */
export function newCondition(field) {
  const op = field?.operators?.[0] || 'eq';
  return { field: field?.key || '', op, value: defaultValueFor(op, field) };
}

const isBlank = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * The filter to send to the API, built from the screen's own state.
 *
 * Keep the screen's state as the source of truth: /search and /count echo the
 * filter back with "in the last N days" turned into a date and "me" turned into
 * a user id, so the echoed filter must not replace what the user is editing.
 */
export function buildFilterPayload(match, conditions) {
  return {
    version: FILTER_VERSION,
    match: match === 'any' ? 'any' : 'all',
    conditions: (conditions || []).map(({ field, op, value }) => ({
      field,
      op,
      value: operatorTakesNoValue(op) ? null : value,
    })),
  };
}

/** A message for conditions the user has not finished, or null when the filter can be sent. */
export function findIncompleteCondition(conditions) {
  if ((conditions || []).length > MAX_CONDITIONS) return `A filter can have at most ${MAX_CONDITIONS} conditions.`;
  for (let index = 0; index < (conditions || []).length; index += 1) {
    const { field, op, value } = conditions[index];
    const label = `Condition ${index + 1}`;
    if (!field || !op) return `${label}: choose a field and an operator.`;
    if (operatorTakesNoValue(op)) continue;
    if (operatorTakesList(op)) {
      if (!Array.isArray(value) || value.length === 0) return `${label}: add at least one value.`;
      if (value.length > MAX_LIST_VALUES) return `${label}: use at most ${MAX_LIST_VALUES} values.`;
    } else if (operatorTakesRange(op)) {
      if (!Array.isArray(value) || value.length !== 2 || value.some(isBlank)) return `${label}: enter both a low and a high value.`;
    } else if (isBlank(value)) {
      return `${label}: enter a value.`;
    } else if (op === 'in_last_days') {
      if (!Number.isInteger(value) || value < 1 || value > MAX_DAYS) return `${label}: enter a whole number of days from 1 to ${MAX_DAYS}.`;
    } else if (op === 'contains' && String(value).trim().length < MIN_CONTAINS_LENGTH) {
      return `${label}: enter at least ${MIN_CONTAINS_LENGTH} characters.`;
    }
  }
  return null;
}

// ── API errors ──────────────────────────────────────────────────────────────
// FastAPI puts the problem in response.data.detail, which is one of:
//   a string                                      most 4xx/5xx
//   { message, issues: [{ condition, field, error }] }   400 invalid filter
//   [{ loc: [...], msg, type }]                   422 request validation

const detailOf = (error) => error?.response?.data?.detail;

/**
 * The per-condition problems from a 400 "Invalid filter" response.
 * `condition` is the index into the conditions that were sent, or null for a
 * problem with the filter as a whole. Returns [] for any other error.
 */
export function filterIssuesFromError(error) {
  const detail = detailOf(error);
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && Array.isArray(detail.issues)) {
    return detail.issues.map((issue) => ({
      condition: Number.isInteger(issue?.condition) ? issue.condition : null,
      field: issue?.field ?? null,
      error: String(issue?.error || 'Invalid value'),
    }));
  }
  return [];
}

/** { [conditionIndex]: message } for showing each problem beside its condition. */
export function issuesByCondition(error) {
  const byCondition = {};
  filterIssuesFromError(error).forEach((issue) => {
    if (issue.condition !== null && !(issue.condition in byCondition)) byCondition[issue.condition] = issue.error;
  });
  return byCondition;
}

const describeValidationItem = (item) => {
  const where = Array.isArray(item?.loc) ? item.loc.filter((part) => part !== 'body').join('.') : '';
  const message = item?.msg || 'Invalid value';
  return where ? `${where}: ${message}` : message;
};

/**
 * One readable sentence for any API error, safe to pass to toast.error().
 * Never returns "[object Object]", whatever shape the backend's detail has.
 */
export function describeApiError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error?.response) {
    return error?.code === 'ERR_NETWORK' || error?.request
      ? 'Could not reach the server. Check your connection and that the backend is running.'
      : fallback;
  }
  const detail = detailOf(error);
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail.map(describeValidationItem).join('; ');
  if (detail && typeof detail === 'object') {
    const issues = filterIssuesFromError(error);
    if (issues.length > 0) {
      const first = issues[0];
      const where = first.condition !== null ? `Condition ${first.condition + 1}` : 'Filter';
      const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : '';
      return `${detail.message || 'Invalid filter'} — ${where}: ${first.error}${more}`;
    }
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message;
  }
  return fallback;
}

/** True when /parse failed because the AI service is down or gave an unusable answer. */
export const isAiUnavailable = (error) => [502, 503].includes(error?.response?.status);

// ── Dates ───────────────────────────────────────────────────────────────────
// A date condition is sent as a plain day, "2026-01-31". The backend reads that
// as the whole day in the tenant's timezone and hands it back as a UTC
// timestamp: the first instant of that day ("2026-01-30T18:30:00+00:00" for a
// tenant in India) or its last ("2026-01-31T18:29:59.999999+00:00"). The UTC
// date of such a timestamp is often the day before or after the one meant.

const DAY_MS = 24 * 60 * 60 * 1000;
// Every timezone offset is a multiple of 15 minutes, so a day starts on one in UTC.
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?$/i;

const offsetMs = (zone) => {
  if (!zone || /^z$/i.test(zone)) return 0;
  const digits = zone.replace(':', '');
  const minutes = Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5));
  return (digits[0] === '-' ? -minutes : minutes) * 60 * 1000;
};

/** The UTC-midnight time of the calendar day that starts at the instant `start`. */
function dayStartingAt(start) {
  // When the browser is in the tenant's timezone the answer is exact.
  const local = new Date(start);
  if (local.getHours() === 0 && local.getMinutes() === 0) {
    return Date.UTC(local.getFullYear(), local.getMonth(), local.getDate());
  }
  // Otherwise: a day starts within 12 hours of UTC midnight of the same date.
  return Math.round(start / DAY_MS) * DAY_MS;
}

/**
 * The calendar day a date value means, as "YYYY-MM-DD" for a date input, or ''
 * when there is none. Only for display: the stored value is left as it is, and
 * an edit replaces it with the plain day the input gives.
 */
export function dateInputValue(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (PLAIN_DATE.test(text)) return text;
  const parts = TIMESTAMP.exec(text);
  if (!parts) return '';
  const [, year, month, day, hours, minutes, seconds = '0', fraction = '', zone] = parts;
  const written = `${year}-${month}-${day}`;
  // No offset: the backend reads it in the tenant's timezone, so the day is as written.
  if (!zone) return written;

  const instant = Date.UTC(+year, +month - 1, +day, +hours, +minutes, +seconds) - offsetMs(zone);
  if (Number.isNaN(instant)) return '';
  let dayStart;
  if (/^0*$/.test(fraction) && instant % QUARTER_HOUR_MS === 0) {
    dayStart = dayStartingAt(instant);
  } else if (/^9{3,}$/.test(fraction) && (instant + 1000) % QUARTER_HOUR_MS === 0) {
    // The last instant of a day: the next day starts just after it.
    dayStart = dayStartingAt(instant + 1000) - DAY_MS;
  } else {
    // A time of day rather than a whole day: show the date it was written with.
    return written;
  }
  return new Date(dayStart).toISOString().slice(0, 10);
}

// ── Display ─────────────────────────────────────────────────────────────────

const displayScalar = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (isBlank(value)) return '—';
  return String(value);
};

/** A condition's value as text for read-only display, in the shape its operator uses. */
export function formatConditionValue(op, value) {
  if (operatorTakesNoValue(op)) return '';
  if (Array.isArray(value)) return value.map(displayScalar).join(operatorTakesRange(op) ? ' – ' : ', ');
  return displayScalar(value);
}
