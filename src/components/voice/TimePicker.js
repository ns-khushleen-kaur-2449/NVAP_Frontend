import { useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatLabel = (hours, minutes) => {
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteStr = String(minutes).padStart(2, '0');
  return `${hour12}:${minuteStr} ${period}`;
};

const formatValue = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

const getNextQuarterHour = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  now.setMinutes(rounded, 0, 0);
  return formatValue(now.getHours(), now.getMinutes());
};

export default function TimePicker({ value, onChange, disabled }) {
  const options = useMemo(() => {
    const list = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 15) {
        list.push({
          value: formatValue(hour, minute),
          label: formatLabel(hour, minute),
        });
      }
    }
    return list;
  }, []);

  useEffect(() => {
    if (!value && onChange) {
      onChange(getNextQuarterHour());
    }
  }, [value, onChange]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-11 rounded-lg border-border bg-card">
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
