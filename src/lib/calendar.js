import { createCalendarEvent, getCalendarConnections, listCalendarEvents } from '@/lib/api';

export const NOT_CONNECTED = 'Connect your calendar in Settings to see and book meetings.';

/** The user's primary connected calendar, or null when none is connected. */
export async function getPrimaryCalendar() {
  const res = await getCalendarConnections();
  const connected = (res.data || []).filter((c) => c.status === 'connected');
  return connected.find((c) => c.is_primary) || connected[0] || null;
}

/** Events overlapping [start, end) — the API allows a window of at most 62 days. */
export async function listEventsBetween(connectionId, start, end) {
  const res = await listCalendarEvents(connectionId, {
    time_min: start.toISOString(),
    time_max: end.toISOString(),
    max_results: 250,
  });
  return res.data || [];
}

/** Events from now until `days` ahead. */
export async function listUpcomingEvents(connectionId, days = 30) {
  const now = new Date();
  return listEventsBetween(connectionId, now, new Date(now.getTime() + days * 86400000));
}

/** Book a meeting; attendees get an invite email from the calendar provider. */
export async function bookMeeting(connectionId, { summary, start, durationMinutes = 30, attendees = [], description }) {
  const begin = new Date(start);
  const res = await createCalendarEvent(connectionId, {
    summary,
    description: description || undefined,
    start: begin.toISOString(),
    end: new Date(begin.getTime() + (Number(durationMinutes) || 30) * 60000).toISOString(),
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    attendees,
    send_updates: attendees.length ? 'all' : 'none',
  });
  return res.data;
}
