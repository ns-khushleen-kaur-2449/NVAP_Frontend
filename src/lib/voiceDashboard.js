// Formatting for the Voice Agent dashboard. Every number comes from
// GET /api/v1/voice/dashboard/summary; these helpers only format it (no metric
// math here: rates, totals and deltas' inputs are the backend's).

export const RANGES = [
  { id: 'today', label: 'Today', days: 1, compare: 'yesterday' },
  { id: '7d', label: '7 days', days: 7, compare: 'previous 7 days' },
  { id: '30d', label: '30 days', days: 30, compare: 'previous 30 days' },
];

export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** [from, to) for a range: local midnight `days - 1` days ago until tomorrow's local midnight. */
export function windowFor(rangeId, now = new Date()) {
  const range = RANGES.find((r) => r.id === rangeId) || RANGES[0];
  const to = new Date(now);
  to.setHours(24, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - range.days);
  return { from: from.toISOString(), to: to.toISOString() };
}

const DASH = '—';

export function formatCount(value) {
  return value == null ? DASH : value.toLocaleString();
}

/** 0.353 -> "35%"; null -> "—". */
export function formatRate(value) {
  return value == null ? DASH : `${Math.round(value * 100)}%`;
}

/** 115 -> "1:55"; null -> "—". */
export function formatDuration(seconds) {
  if (seconds == null) return DASH;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const FORMATTERS = { count: formatCount, rate: formatRate, duration: formatDuration };

/**
 * The change vs the previous window, as text plus a tone.
 * kind: "count" | "rate" (percentage points) | "duration" (m:ss).
 * tone: "up" / "down" for a real change, "flat" for none, "none" without previous data.
 */
export function formatDelta(kpi, kind, compareLabel) {
  const value = kpi?.value;
  const previous = kpi?.previous;
  if (value == null || previous == null) {
    return { text: DASH, tone: 'none', label: `No data for the ${compareLabel} to compare` };
  }
  const previousText = FORMATTERS[kind](previous);
  const change = kind === 'rate' ? Math.round(value * 100) - Math.round(previous * 100) : value - previous;
  if (change === 0) {
    return { text: `same as ${compareLabel}`, tone: 'flat', label: `No change vs ${compareLabel} (${previousText})` };
  }
  const size = kind === 'rate' ? `${Math.abs(change)} pts` : kind === 'duration' ? formatDuration(Math.abs(change)) : Math.abs(change).toLocaleString();
  const tone = change > 0 ? 'up' : 'down';
  return {
    text: `${size} vs ${compareLabel} (${previousText})`,
    tone,
    label: `${tone === 'up' ? 'Up' : 'Down'} ${size} vs ${compareLabel}, was ${previousText}`,
  };
}

/** First letter of the first two name parts, split on spaces, "-" and "_" ("Riya -ns1" -> "RN"). */
export function initials(name) {
  const letters = String(name || '')
    .split(/[\s\-_]+/)
    .map((part) => (part.match(/[A-Za-z0-9]/) || [])[0])
    .filter(Boolean)
    .slice(0, 2);
  return letters.join('').toUpperCase() || '?';
}

/** Clock time in the viewer's time zone. */
export function formatClock(iso) {
  if (!iso) return DASH;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? DASH : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** A call's start in the viewer's time zone: the clock today, otherwise with the date ("16 Oct, 18:34"). */
export function formatCallTime(iso, now = new Date()) {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const clock = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return clock;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${clock}`;
}

/** "just now", "16 min ago", "2 h ago", "4 days ago". */
export function relativeTime(iso, now = new Date()) {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** 15 -> "3p", 0 -> "12a". */
export function formatHour(hour) {
  const suffix = hour < 12 ? 'a' : 'p';
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

/** 15 -> "3 PM". */
export function formatHourLong(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

export const OUTCOME_LABELS = {
  interested: 'Interested',
  callback_requested: 'Callback requested',
  not_interested: 'Not interested',
  unclear: 'Unclear',
  unclassified: 'Not classified',
  no_answer: 'No answer',
  busy: 'Busy',
  voicemail: 'Voicemail',
  not_reachable: 'Not reachable',
  error: 'Error',
  unknown: 'Unknown outcome',
  in_progress: 'In progress',
};

/** Outcomes of calls that never connected, in display order. */
export const NOT_CONNECTED_OUTCOMES = ['no_answer', 'busy', 'voicemail', 'not_reachable', 'error', 'unknown', 'in_progress'];

export const HEALTH_LABELS = {
  vapi_webhooks: 'Vapi webhooks',
  crm_sync: 'CRM sync',
  retry_worker: 'Retry worker',
  call_failures: 'Call failures',
};

export const HEALTH_STATES = {
  healthy: 'Healthy',
  watch: 'Watch',
  down: 'Down',
  scheduled: 'Scheduled',
  idle: 'Idle',
  not_configured: 'Not configured',
};

export const AGENT_STATUS_LABELS = { calling: 'Calling', idle: 'Idle', paused: 'Paused' };
