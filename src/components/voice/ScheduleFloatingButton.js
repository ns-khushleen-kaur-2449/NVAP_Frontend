import { CalendarClock } from 'lucide-react';

export default function ScheduleFloatingButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Schedule & Reminders"
      className="fixed right-6 top-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-md transition-transform duration-200 hover:scale-[1.08] hover:shadow-lg active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
    >
      <CalendarClock className="h-5 w-5 text-[hsl(var(--primary))]" />
    </button>
  );
}
