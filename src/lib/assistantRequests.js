/**
 * Assistant change requests (backend: app/features/assistants/change_requests.py).
 *
 * A Sales Rep proposes changes to a published assistant; their Manager (or a Tenant Admin
 * when they have none) approves, which applies the change, or rejects with feedback.
 * The backend validates and enforces everything; these helpers only shape the form.
 */

// The settings a Sales Rep can propose from the UI. `key` is the API (camelCase) name used
// by GET /api/v1/assistants/{id} and accepted in `changes`; `field` is the stored name the
// review screens use. Publishing, tools, knowledge files and server URLs are not proposable.
export const PROPOSABLE_FIELDS = Object.freeze([
  { key: 'name', field: 'name', label: 'Name', type: 'text' },
  { key: 'firstMessage', field: 'first_message', label: 'First message', type: 'textarea' },
  { key: 'systemPrompt', field: 'system_prompt', label: 'System prompt', type: 'textarea', rows: 8 },
  { key: 'endCallMessage', field: 'end_call_message', label: 'End-of-call message', type: 'textarea' },
  { key: 'language', field: 'language', label: 'Language', type: 'text' },
  { key: 'tone', field: 'tone', label: 'Tone', type: 'text' },
  { key: 'callIntent', field: 'call_intent', label: 'Call intent', type: 'text' },
  { key: 'modelTemperature', field: 'model_temperature', label: 'Model temperature', type: 'number', step: 0.1, min: 0, max: 2 },
  { key: 'maxDurationSeconds', field: 'max_duration_seconds', label: 'Max call length (seconds)', type: 'number', step: 30, min: 30 },
]);

const LABELS = Object.fromEntries(PROPOSABLE_FIELDS.map((f) => [f.field, f.label]));

/** A readable label for a stored field name (falls back to the name itself). */
export function fieldLabel(field) {
  if (LABELS[field]) return LABELS[field];
  const words = String(field || '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The form's starting values, from an assistant as GET /api/v1/assistants/{id} returns it. */
export function initialDraft(assistant) {
  return Object.fromEntries(PROPOSABLE_FIELDS.map(({ key }) => {
    const value = assistant?.[key];
    return [key, value === null || value === undefined ? '' : String(value)];
  }));
}

function parsed(spec, raw) {
  const text = String(raw ?? '');
  if (spec.type === 'number') {
    if (!text.trim()) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : NaN;
  }
  return text.trim() ? text : null;
}

/**
 * Only the fields the person changed, keyed by API name: { changes, invalid }.
 * `invalid` lists the labels of number fields that are not numbers.
 */
export function buildChanges(assistant, draft) {
  const changes = {};
  const invalid = [];
  PROPOSABLE_FIELDS.forEach((spec) => {
    const next = parsed(spec, draft?.[spec.key]);
    if (Number.isNaN(next)) {
      invalid.push(spec.label);
      return;
    }
    const before = assistant?.[spec.key] ?? null;
    const same = spec.type === 'number' ? Number(before) === next && before !== null : (before ?? null) === next;
    if (!same && !(before === null && next === null)) changes[spec.key] = next;
  });
  return { changes, invalid };
}

/** A value as plain text for the compare view. */
export function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** One row per proposed field: { field, label, current, proposed, stale }. */
export function compareRows(request) {
  const current = request?.current_values || request?.base_values || {};
  const stale = new Set(request?.stale_fields || []);
  return Object.keys(request?.proposed_changes || {}).sort().map((field) => ({
    field,
    label: fieldLabel(field),
    current: current[field],
    proposed: request.proposed_changes[field],
    stale: stale.has(field),
  }));
}

export const REQUEST_STATUS_LABELS = Object.freeze({
  pending: 'Pending review', applied: 'Approved and applied', rejected: 'Not approved', withdrawn: 'Withdrawn',
});
export const REQUEST_STATUS_TONES = Object.freeze({
  pending: 'accent', applied: 'good', rejected: 'bad', withdrawn: 'neutral',
});

/** The API's error message, or a fallback. */
export function errorText(error, fallback = 'Something went wrong.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d?.msg || String(d)).join(' ');
  return fallback;
}
