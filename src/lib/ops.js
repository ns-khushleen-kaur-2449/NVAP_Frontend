// Shared helpers for the operations screens (campaigns, callbacks, do-not-call, appointments,
// notifications). Formatting only: every value comes from the API.

const DASH = '—';
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

/** The zone times are shown in: the tenant's default, else IST. */
export function displayTimeZone(user) {
  return user?.tenant?.default_timezone || DEFAULT_TIME_ZONE;
}

function valid(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zoneAbbreviation(date, timeZone) {
  try {
    const part = new Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'short' })
      .formatToParts(date).find((p) => p.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}

/** "Thu 23 Oct, 3:00 PM IST" (the year is added when it is not this year). */
export function formatDateTime(iso, timeZone = DEFAULT_TIME_ZONE, now = new Date()) {
  const date = valid(iso);
  if (!date) return DASH;
  const sameYear = new Intl.DateTimeFormat('en-IN', { timeZone, year: 'numeric' }).format(date)
    === new Intl.DateTimeFormat('en-IN', { timeZone, year: 'numeric' }).format(now);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date).replace(',', '');
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
  return `${day}, ${time} ${zoneAbbreviation(date, timeZone)}`;
}

/** The full absolute time for a tooltip: "Thursday, 23 October 2026, 15:00:12 IST". */
export function formatAbsolute(iso, timeZone = DEFAULT_TIME_ZONE) {
  const date = valid(iso);
  if (!date) return DASH;
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date);
  return `${text} ${zoneAbbreviation(date, timeZone)}`;
}

/** "just now", "16 min ago", "2 h ago", "4 days ago", or "in 20 min", "in 3 h", "in 2 days". */
export function relativeTime(iso, now = new Date()) {
  const date = valid(iso);
  if (!date) return DASH;
  const diff = date.getTime() - now.getTime();
  const minutes = Math.floor(Math.abs(diff) / 60000);
  if (minutes < 1) return 'just now';
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const size = minutes < 60 ? `${minutes} min` : hours < 48 ? `${hours} h` : `${days} days`;
  return diff < 0 ? `${size} ago` : `in ${size}`;
}

/** Where a notification leads, by the entity it is about. */
export function notificationLink(notification) {
  const id = notification?.entity_id;
  switch (notification?.entity_type) {
    case 'campaign': return `/voice-campaigns/${id}`;
    case 'scheduled_call': return `/operations/callbacks?open=${id}`;
    case 'appointment': return `/operations/appointments?open=${id}`;
    case 'appointments': return '/operations/appointments?tab=needs_outcome';
    case 'do_not_call': return '/operations/do-not-call';
    case 'calendar_connection': return '/settings/calendar';
    case 'call_log': return '/voice_agent?tab=logs';
    default: return null;
  }
}

export const TOAST_SEVERITIES = ['warning', 'critical'];
export const MAX_TOASTS = 3;

/**
 * Which new notifications become toasts: warnings and criticals not seen before, newest first,
 * at most `max` shown; the rest collapse into one "+N more".
 */
export function planToasts(notifications, seenIds, max = MAX_TOASTS) {
  const fresh = (notifications || []).filter((n) => TOAST_SEVERITIES.includes(n.severity) && !seenIds.has(n.id));
  return { shown: fresh.slice(0, max), more: Math.max(0, fresh.length - max) };
}

/** A toast's one line: "Aditi Attri cancelled Thu 3:00 PM — No reason given (cancelled from calendar)". */
export function toastText(notification) {
  return notification.body ? `${notification.title} — ${notification.body}` : notification.title;
}

/** "3 calls" / "1 call". */
export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

/** "+91 98••• ••412": the backend's masking rule (voice/metrics.mask_phone) for numbers it sends whole. */
export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return digits ? '•••' : DASH;
  const [country, national] = digits.length > 10 ? [digits.slice(0, -10), digits.slice(-10)] : ['', digits];
  const masked = `${national.slice(0, 2)}••• ••${national.slice(-3)}`;
  return country ? `+${country} ${masked}` : masked;
}
