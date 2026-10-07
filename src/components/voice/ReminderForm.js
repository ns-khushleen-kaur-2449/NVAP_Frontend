import { useState } from 'react';
import { addDays, addMinutes, startOfDay } from 'date-fns';
import MiniCalendar from '@/components/voice/MiniCalendar';
import TimePicker from '@/components/voice/TimePicker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const quickOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: '+15 min', value: '15' },
  { label: '+30 min', value: '30' },
  { label: '+1 hr', value: '60' },
];

const formatTimeValue = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const nextQuarter = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  now.setMinutes(rounded, 0, 0);
  return now;
};

export default function ReminderForm({
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  scheduleNotes,
  setScheduleNotes,
  onSubmit,
  scheduling,
  error,
  leadSelected,
  calendarEvents = [],
  notesLabel = 'Reminder Notes',
  notesPlaceholder = 'Add context for this call...',
  submitLabel = 'Schedule Call',
}) {
  const [quickPick, setQuickPick] = useState('');
  const [attempted, setAttempted] = useState(false);

  const isComplete = Boolean(scheduleDate && scheduleTime);
  const showValidation = attempted && !isComplete;

  const handleQuickPick = (value) => {
    setQuickPick(value);
    const now = new Date();
    if (value === 'today') {
      setScheduleDate(startOfDay(now));
      if (!scheduleTime) setScheduleTime(formatTimeValue(nextQuarter()));
      return;
    }
    if (value === 'tomorrow') {
      setScheduleDate(startOfDay(addDays(now, 1)));
      if (!scheduleTime) setScheduleTime(formatTimeValue(nextQuarter()));
      return;
    }
    const minutes = Number(value);
    const target = addMinutes(now, minutes);
    setScheduleDate(startOfDay(target));
    setScheduleTime(formatTimeValue(target));
  };

  const handleSubmit = () => {
    setAttempted(true);
    if (!isComplete) return;
    onSubmit?.();
  };

  return (
    <div className="space-y-5">
      <div className={showValidation && !scheduleDate ? 'rounded-2xl border border-red-500/50' : ''}>
        <MiniCalendar
          selectedDate={scheduleDate}
          onSelect={setScheduleDate}
          disabled={scheduling}
          events={calendarEvents}
        />
        {showValidation && !scheduleDate && (
          <p className="mt-2 text-xs text-red-500">Select a date to continue.</p>
        )}
      </div>

      <div>
        <p className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Quick shortcuts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {quickOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleQuickPick(option.value)}
              disabled={scheduling}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                quickPick === option.value
                  ? 'border-[#F87217] bg-[#F87217]/8 text-[#F87217]'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={showValidation && !scheduleTime ? 'rounded-lg border border-red-500/50 p-1' : ''}>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Time</label>
        <div className="mt-2">
          <TimePicker value={scheduleTime} onChange={setScheduleTime} disabled={scheduling} />
        </div>
        {showValidation && !scheduleTime && (
          <p className="mt-2 text-xs text-red-500">Choose a time slot.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">{notesLabel}</label>
        <Textarea
          value={scheduleNotes}
          onChange={(event) => setScheduleNotes(event.target.value)}
          placeholder={notesPlaceholder}
          maxLength={300}
          disabled={scheduling}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F87217] focus:border-[#F87217] transition duration-150 min-h-[110px]"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{scheduleNotes.length}/300</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isComplete || scheduling}
        className="w-full bg-[#F87217] hover:bg-[#C2560E] text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
      >
        {scheduling ? 'Scheduling...' : submitLabel}
      </Button>
    </div>
  );
}
