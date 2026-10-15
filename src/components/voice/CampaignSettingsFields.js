import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

// Mirrors CallingWindow / CallingConfig in app/schemas/requests/voice_campaigns.py.
export const WEEKDAYS = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' }, { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];
export const RETRY_OUTCOMES = [
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'failed', label: 'Failed' },
];
export const DEFAULT_WINDOW = { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], start_time: '10:00', end_time: '19:00' };
export const DEFAULT_CONFIG = {
  max_concurrent_calls: 3,
  max_attempts_per_lead: 3,
  retry_interval_minutes: 30,
  retry_on: ['no_answer', 'busy', 'failed'],
};

export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
};

const TIME_ZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Kolkata', 'UTC', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'];
  }
})();

// Offset (ms) of timeZone from UTC at the instant utcMs.
const zoneOffset = (timeZone, utcMs) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utcMs;
};

/** "2026-10-20" + "10:30" as wall-clock time in timeZone -> ISO string in UTC. */
export const zonedToIso = (dateStr, timeStr, timeZone) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - zoneOffset(timeZone, wall);
  utc = wall - zoneOffset(timeZone, utc); // second pass settles DST edges
  return new Date(utc).toISOString();
};

/** ISO instant -> { date: "YYYY-MM-DD", time: "HH:MM" } as seen in timeZone. */
export const isoToZoned = (iso, timeZone) => {
  if (!iso) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};

export const describeWindow = (window) => {
  if (!window) return 'Any day, any time';
  const days = WEEKDAYS.filter((d) => window.days?.includes(d.value)).map((d) => d.label).join(', ');
  return `${days} · ${window.start_time}–${window.end_time}`;
};

export const describeConfig = (config) => {
  if (!config) return '—';
  const retryOn = RETRY_OUTCOMES.filter((o) => config.retry_on?.includes(o.value)).map((o) => o.label.toLowerCase()).join(', ');
  return `${config.max_concurrent_calls} at a time · up to ${config.max_attempts_per_lead} attempts · retry after ${config.retry_interval_minutes} min${retryOn ? ` on ${retryOn}` : ''}`;
};

const Label = ({ children }) => <label className="text-xs font-medium text-muted-foreground">{children}</label>;

export function TimeZoneField({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>Timezone</Label>
      <Input list="campaign-timezones" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Asia/Kolkata" />
      <datalist id="campaign-timezones">
        {TIME_ZONES.map((tz) => <option key={tz} value={tz} />)}
      </datalist>
    </div>
  );
}

/** Calling hours. value === null means "any day, any time". */
export function CallingWindowFields({ value, onChange }) {
  const enabled = value !== null;
  const window = value || DEFAULT_WINDOW;
  const toggleDay = (day) => {
    const days = window.days.includes(day) ? window.days.filter((d) => d !== day) : [...window.days, day];
    onChange({ ...window, days });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Only call during set hours</p>
          <p className="text-[11px] text-muted-foreground">Outside these hours the campaign pauses and resumes automatically.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(on) => onChange(on ? DEFAULT_WINDOW : null)} />
      </div>
      {enabled && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = window.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="time" value={window.start_time} onChange={(e) => onChange({ ...window, start_time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Until</Label>
              <Input type="time" value={window.end_time} onChange={(e) => onChange({ ...window, end_time: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CallingConfigFields({ value, onChange }) {
  const config = value || DEFAULT_CONFIG;
  const setNumber = (key) => (e) => onChange({ ...config, [key]: e.target.value === '' ? '' : Number(e.target.value) });
  const toggleRetry = (outcome) => {
    const retry_on = config.retry_on.includes(outcome)
      ? config.retry_on.filter((o) => o !== outcome)
      : [...config.retry_on, outcome];
    onChange({ ...config, retry_on });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Calls at once</Label>
          <Input type="number" min={1} max={20} value={config.max_concurrent_calls} onChange={setNumber('max_concurrent_calls')} />
        </div>
        <div className="space-y-1.5">
          <Label>Attempts per lead</Label>
          <Input type="number" min={1} max={10} value={config.max_attempts_per_lead} onChange={setNumber('max_attempts_per_lead')} />
        </div>
        <div className="space-y-1.5">
          <Label>Retry after (min)</Label>
          <Input type="number" min={1} max={1440} value={config.retry_interval_minutes} onChange={setNumber('retry_interval_minutes')} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Retry when the call</Label>
        <div className="flex flex-wrap gap-4">
          {RETRY_OUTCOMES.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={config.retry_on.includes(o.value)} onCheckedChange={() => toggleRetry(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Client-side check matching the backend rules; returns an error message or null. */
export const validateSettings = ({ window, config, timeZone }) => {
  if (!timeZone?.trim()) return 'Pick a timezone.';
  if (window) {
    if (!window.days.length) return 'Pick at least one calling day.';
    if (!window.start_time || !window.end_time || window.end_time <= window.start_time) {
      return 'Calling hours must end after they start (overnight windows are not supported).';
    }
  }
  const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!inRange(config.max_concurrent_calls, 1, 20)) return 'Calls at once must be between 1 and 20.';
  if (!inRange(config.max_attempts_per_lead, 1, 10)) return 'Attempts per lead must be between 1 and 10.';
  if (!inRange(config.retry_interval_minutes, 1, 1440)) return 'Retry interval must be between 1 and 1440 minutes.';
  return null;
};

export const apiErrorMessage = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = (detail[0].loc || []).filter((p) => p !== 'body').join('.');
    return field ? `${field}: ${detail[0].msg}` : detail[0].msg;
  }
  return fallback;
};

/** Tell the user what happened to the campaign's calendar entry (calendar_sync from the API). */
export const announceCalendarSync = (sync) => {
  if (!sync) return;
  if (sync.status === 'created') toast.success('Added to your calendar');
  else if (sync.status === 'removed') toast.message('Removed from your calendar');
  else if (sync.status === 'not_connected' || sync.status === 'failed') toast.warning(sync.message);
};
