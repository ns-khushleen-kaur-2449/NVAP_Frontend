import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { checkCampaignSchedule } from '@/lib/api';
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
// Per-outcome retry delays (CallingConfig.retry_*_minutes). The values themselves come from the
// tenant's contact rules (schedule-check's retry_defaults) or the campaign; only the bounds live here.
export const RETRY_DELAY_FIELDS = [
  { key: 'retry_no_answer_minutes', label: 'After no answer', min: 120, max: 240, hint: '2–4 hours' },
  { key: 'retry_busy_minutes', label: 'After busy', min: 1, max: 1440 },
  { key: 'retry_failed_minutes', label: 'After unreachable', min: 1, max: 1440 },
];
export const DEFAULT_CONFIG = {
  max_concurrent_calls: 3,
  max_attempts_per_lead: 3,
  retry_on: ['no_answer', 'busy', 'failed'],
};

/** `config` with any missing retry delay taken from the tenant's defaults. */
export const withRetryDefaults = (config, defaults) => {
  const out = { ...config };
  RETRY_DELAY_FIELDS.forEach(({ key }) => {
    if ((out[key] === undefined || out[key] === null) && defaults?.[key] != null) out[key] = defaults[key];
  });
  delete out.retry_interval_minutes; // the old single delay; the backend no longer stores it
  return out;
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
  return `${config.max_concurrent_calls} at a time · up to ${config.max_attempts_per_lead} attempts${retryOn ? ` · retries on ${retryOn}` : ''}`;
};

/** "No answer 3 h · Busy 45 min · Unreachable 30 min". */
export const describeRetryDelays = (config) => RETRY_DELAY_FIELDS
  .map(({ key, label }) => {
    const minutes = config?.[key];
    if (minutes == null) return null;
    const text = minutes % 60 === 0 && minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
    return `${label.replace(/^After /, '').replace(/^\w/, (c) => c.toUpperCase())} ${text}`;
  })
  .filter(Boolean)
  .join(' · ') || '—';

/** Field-by-field problems in the calling rules: { key: message }. */
export const configErrors = (config) => {
  const errors = {};
  const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!inRange(config.max_concurrent_calls, 1, 20)) errors.max_concurrent_calls = 'Between 1 and 20.';
  if (!inRange(config.max_attempts_per_lead, 1, 10)) errors.max_attempts_per_lead = 'Between 1 and 10.';
  RETRY_DELAY_FIELDS.forEach(({ key, min, max, hint }) => {
    if (config[key] !== undefined && !inRange(config[key], min, max)) {
      errors[key] = `Between ${min} and ${max} minutes${hint ? ` (${hint})` : ''}.`;
    }
  });
  return errors;
};

/**
 * POST /api/campaigns/schedule-check as the form changes (debounced): the calling-hours
 * warnings to show before saving, the effective start, and the tenant's retry defaults.
 * A 422 (hours outside the allowed bound) comes back as `error`.
 */
export function useScheduleCheck({ scheduledAt, timeZone, callingWindow, enabled = true }) {
  const [result, setResult] = useState({ warnings: [], retryDefaults: null, startsAt: null, error: null });
  const windowKey = JSON.stringify(callingWindow);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(async () => {
      try {
        const res = await checkCampaignSchedule({
          scheduled_at: scheduledAt || null, timezone: timeZone || null, calling_window: callingWindow || null,
        });
        setResult({ warnings: res.data.warnings || [], retryDefaults: res.data.retry_defaults || null,
          startsAt: res.data.starts_at, error: null });
      } catch (e) {
        setResult((prev) => ({ ...prev, warnings: [], error: apiErrorMessage(e, null) }));
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledAt, timeZone, windowKey, enabled]);
  return result;
}

/** The backend's calling-hours notes (and a refusal) shown before saving. */
export function ScheduleWarnings({ check }) {
  if (!check?.error && !check?.warnings?.length) return null;
  return (
    <div role="status" className="ops-tone ops-tone-warn space-y-1 rounded-[14px] px-3 py-2 text-sm">
      {check.error && <p className="font-semibold">{check.error}</p>}
      {check.warnings.map((w) => <p key={w}>{w}</p>)}
    </div>
  );
}

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

export function CallingConfigFields({ value, onChange, errors = {} }) {
  const config = value || DEFAULT_CONFIG;
  const setNumber = (key) => (e) => onChange({ ...config, [key]: e.target.value === '' ? '' : Number(e.target.value) });
  const fieldError = (key) => errors[key] && <p id={`err-${key}`} className="text-[11px] text-[color:var(--ops-bad,#b42318)]">{errors[key]}</p>;
  const toggleRetry = (outcome) => {
    const retry_on = config.retry_on.includes(outcome)
      ? config.retry_on.filter((o) => o !== outcome)
      : [...config.retry_on, outcome];
    onChange({ ...config, retry_on });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Calls at once</Label>
          <Input type="number" min={1} max={20} value={config.max_concurrent_calls} onChange={setNumber('max_concurrent_calls')}
            aria-invalid={Boolean(errors.max_concurrent_calls)} aria-describedby={errors.max_concurrent_calls ? 'err-max_concurrent_calls' : undefined} />
          {fieldError('max_concurrent_calls')}
        </div>
        <div className="space-y-1.5">
          <Label>Attempts per lead</Label>
          <Input type="number" min={1} max={10} value={config.max_attempts_per_lead} onChange={setNumber('max_attempts_per_lead')}
            aria-invalid={Boolean(errors.max_attempts_per_lead)} aria-describedby={errors.max_attempts_per_lead ? 'err-max_attempts_per_lead' : undefined} />
          {fieldError('max_attempts_per_lead')}
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-muted-foreground">Wait before retrying (minutes)</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RETRY_DELAY_FIELDS.map(({ key, label, min, max, hint }) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={`field-${key}`} className="text-xs font-medium text-muted-foreground">{label}{hint ? ` (${hint})` : ''}</label>
              <Input id={`field-${key}`} type="number" min={min} max={max} value={config[key] ?? ''} onChange={setNumber(key)}
                placeholder="Tenant default" aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `err-${key}` : undefined} />
              {fieldError(key)}
            </div>
          ))}
        </div>
      </fieldset>
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
  if (Object.keys(configErrors(config)).length) return 'Fix the calling rules marked below.';
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
