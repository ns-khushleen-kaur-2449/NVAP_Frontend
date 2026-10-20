import {
  formatCallTime, formatCount, formatDelta, formatDuration, formatHour, formatHourLong, formatRate, initials, relativeTime, windowFor,
} from './voiceDashboard';

describe('KPI formatting', () => {
  it('shows "—" for null, never 0', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatCount(null)).toBe('—');
    expect(formatRate(0)).toBe('0%');
  });

  it('formats rates as whole percentages and durations as m:ss', () => {
    expect(formatRate(0.353)).toBe('35%');
    expect(formatRate(1)).toBe('100%');
    expect(formatDuration(115)).toBe('1:55');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('describes changes against the previous window', () => {
    expect(formatDelta({ value: 17, previous: 12 }, 'count', 'yesterday'))
      .toMatchObject({ tone: 'up', text: '5 vs yesterday (12)' });
    expect(formatDelta({ value: 0.353, previous: 0.333 }, 'rate', 'yesterday'))
      .toMatchObject({ tone: 'up', text: '2 pts vs yesterday (33%)' });
    expect(formatDelta({ value: 115, previous: 127 }, 'duration', 'yesterday'))
      .toMatchObject({ tone: 'down', text: '0:12 vs yesterday (2:07)' });
    expect(formatDelta({ value: 2, previous: 2 }, 'count', 'yesterday'))
      .toMatchObject({ tone: 'flat', text: 'same as yesterday' });
    // No previous data (or no current rate): a dash, never a fake change.
    expect(formatDelta({ value: 0.5, previous: null }, 'rate', 'yesterday')).toMatchObject({ tone: 'none', text: '—' });
    expect(formatDelta({ value: null, previous: 85 }, 'duration', 'yesterday')).toMatchObject({ tone: 'none', text: '—' });
  });

  it('never reports a rate change smaller than what the shown percentages differ by', () => {
    expect(formatDelta({ value: 0.3534, previous: 0.3531 }, 'rate', 'yesterday').tone).toBe('flat');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two parts split on spaces, hyphens and underscores', () => {
    expect(initials('Riya -ns1')).toBe('RN');
    expect(initials('Riya-AISDR-1')).toBe('RA');
    expect(initials('Priya_AISDR')).toBe('PA');
    expect(initials('neha nets')).toBe('NN');
    expect(initials('Solo')).toBe('S');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});

describe('time helpers', () => {
  it('builds [from, to) from local midnights', () => {
    const now = new Date(2026, 9, 20, 15, 30);
    const today = windowFor('today', now);
    expect(new Date(today.from)).toEqual(new Date(2026, 9, 20));
    expect(new Date(today.to)).toEqual(new Date(2026, 9, 21));
    expect(new Date(windowFor('7d', now).from)).toEqual(new Date(2026, 9, 14));
    expect(new Date(windowFor('30d', now).from)).toEqual(new Date(2026, 8, 21));
  });

  it('dates a call that was not today', () => {
    const now = new Date(2026, 9, 20, 15, 0);
    expect(formatCallTime(new Date(2026, 9, 20, 9, 5).toISOString(), now)).not.toMatch(/Oct/);
    expect(formatCallTime(new Date(2026, 9, 16, 18, 34).toISOString(), now)).toMatch(/16 Oct|Oct 16/);
    expect(formatCallTime(null, now)).toBe('—');
  });

  it('writes relative times as text', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(relativeTime('2026-10-20T11:44:00Z', now)).toBe('16 min ago');
    expect(relativeTime('2026-10-20T10:00:00Z', now)).toBe('2 h ago');
    expect(relativeTime('2026-10-16T12:00:00Z', now)).toBe('4 days ago');
    expect(relativeTime(null, now)).toBe('never');
  });

  it('labels hours', () => {
    expect([formatHour(0), formatHour(9), formatHour(12), formatHour(15)]).toEqual(['12a', '9a', '12p', '3p']);
    expect(formatHourLong(17)).toBe('5 PM');
    expect(formatHourLong(24)).toBe('12 AM');
  });
});
