import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const DEFAULT_PERIOD = { period: 'this_month' };

const QUICK = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_90_days', label: 'Last 90 days' },
  { key: 'all_time', label: 'All time' },
  { key: 'custom', label: 'Custom dates' },
];

const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);

/** The dates being shown, as the backend worked them out. Periods run in UTC, like the monthly limits. */
export function periodRange(period) {
  if (!period) return '';
  const end = new Date(new Date(period.end).getTime() - 1);
  if (!period.start) return `Everything up to ${dateOnly(end)} (UTC)`;
  return `${dateOnly(period.start)} to ${dateOnly(end)} (UTC)`;
}

/**
 * Pick the period a page reports on. `months` comes from the backend: every month that has calls.
 * Calls onChange with the query to send; custom dates only once both are chosen and Apply is pressed.
 */
export default function PeriodPicker({ value, months = [], onChange }) {
  const [choice, setChoice] = useState(value?.period || DEFAULT_PERIOD.period);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const pick = (next) => {
    setChoice(next);
    if (next !== 'custom') onChange({ period: next });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={choice} onValueChange={pick}>
        <SelectTrigger className="w-[190px]" aria-label="Period"><SelectValue /></SelectTrigger>
        <SelectContent>
          {QUICK.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
          {months.map((month) => <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {choice === 'custom' && (
        <>
          <Input type="date" aria-label="Start date" className="w-[150px]" value={start} max={end || undefined}
            onChange={(e) => setStart(e.target.value)} />
          <Input type="date" aria-label="End date" className="w-[150px]" value={end} min={start || undefined}
            onChange={(e) => setEnd(e.target.value)} />
          <Button variant="outline" size="sm" disabled={!start || !end || start > end}
            onClick={() => onChange({ period: 'custom', start, end })}>Apply</Button>
        </>
      )}
    </div>
  );
}
