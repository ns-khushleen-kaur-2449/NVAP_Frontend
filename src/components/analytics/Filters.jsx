// Filter values are what the API receives (see toParams in lib/analytics/service.js); 'all' is never sent.
export const PERIODS = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['custom', 'Custom range']];
export const CAMPAIGNS = [['all', 'All campaigns'], ['auto-mfg-india', 'Auto Mfg – India'], ['saas-mid-market', 'SaaS Mid-Market'], ['webinar-follow-up', 'Webinar Follow-up']];
export const CHANNELS = [['all', 'All channels'], ['call', 'Call'], ['email', 'Email'], ['sms', 'SMS']];
export const REPS = [['all', 'Whole team'], ['anita-r', 'Anita R.'], ['dev-s', 'Dev S.'], ['meera-k', 'Meera K.'], ['raj-p', 'Raj P.']];
export const TEAMS = [['all', 'All teams'], ['north', 'Team North'], ['south', 'Team South'], ['enterprise', 'Enterprise']];

export const defaultFilters = (extra = {}) => ({ period: '7d', from: '', to: '', campaign: 'all', channel: 'all', ...extra });

const CONTROL = 'h-9 rounded-lg border border-border bg-card px-3 text-sm font-normal text-foreground';

function Select({ label, options, value, onChange }) {
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground sm:flex-none">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/**
 * One row of filters above the content. `show` picks which apply here: period always; campaign and channel on
 * Reports; 'rep' for a Manager, 'team' for a Tenant Admin.
 */
export default function Filters({ value, onChange, show = [] }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });
  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-end gap-3">
      <Select label="Date range" options={PERIODS} value={value.period} onChange={set('period')} />
      {value.period === 'custom' && (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">From
            <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => set('from')(e.target.value)} className={CONTROL} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">To
            <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => set('to')(e.target.value)} className={CONTROL} />
          </label>
        </>
      )}
      {show.includes('campaign') && <Select label="Campaign" options={CAMPAIGNS} value={value.campaign} onChange={set('campaign')} />}
      {show.includes('channel') && <Select label="Channel" options={CHANNELS} value={value.channel} onChange={set('channel')} />}
      {show.includes('rep') && <Select label="Rep" options={REPS} value={value.rep} onChange={set('rep')} />}
      {show.includes('team') && <Select label="Team" options={TEAMS} value={value.team} onChange={set('team')} />}
    </div>
  );
}
