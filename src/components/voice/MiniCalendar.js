import { addDays, addMonths, endOfMonth, endOfWeek, format, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Video, ExternalLink, Clock, Users, MapPin, FileText, X, Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @param {{ selectedDate: Date, onSelect: Function, disabled: boolean, events: Array }} props
 * `events` – optional array of objects with an ISO `start` field. Dates with events show a dot.
 */
export default function MiniCalendar({ selectedDate, onSelect, disabled, events = [] }) {
  const today = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState(selectedDate ? startOfMonth(selectedDate) : startOfMonth(today));
  const [popoverDate, setPopoverDate] = useState(null);

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = [];
  let day = gridStart;
  while (day <= gridEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Build a map: date string → array of events
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      if (evt.start) {
        try {
          const d = new Date(evt.start);
          const key = format(d, 'yyyy-MM-dd');
          if (!map[key]) map[key] = [];
          map[key].push(evt);
        } catch {
          // ignore
        }
      }
    });
    return map;
  }, [events]);

  const handleSelect = (date) => {
    if (disabled) return;
    if (isBefore(date, today)) return;
    onSelect?.(date);
  };

  const handleDayClick = (date) => {
    const key = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[key];
    if (dayEvents && dayEvents.length > 0) {
      setPopoverDate(popoverDate === key ? null : key);
    } else {
      setPopoverDate(null);
      handleSelect(date);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
          aria-label="Previous month"
          disabled={disabled}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
          aria-label="Next month"
          disabled={disabled}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {dayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const isDisabled = isBefore(date, today) || !isSameMonth(date, monthStart) || disabled;
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const dayEvents = eventsByDate[dateKey] || [];
          const hasEvent = dayEvents.length > 0;
          const isPopoverOpen = popoverDate === dateKey;

          const dayButton = (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => handleDayClick(date)}
              disabled={isDisabled}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-[hsl(var(--primary))] text-primary-foreground'
                  : isToday
                  ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]'
                  : 'text-foreground'
              } ${isDisabled ? 'opacity-40' : 'hover:bg-[hsl(var(--surface-2))]'}`}
            >
              {format(date, 'd')}
              {hasEvent && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
                  style={{
                    background: isSelected ? 'hsl(0,0%,100%)' : 'hsl(158, 64%, 42%)',
                  }}
                />
              )}
            </button>
          );

          if (!hasEvent) {
            return <div key={date.toISOString()}>{dayButton}</div>;
          }

          return (
            <Popover key={date.toISOString()} open={isPopoverOpen} onOpenChange={(open) => {
              if (!open) setPopoverDate(null);
            }}>
              <PopoverTrigger asChild>
                {dayButton}
              </PopoverTrigger>
              <PopoverContent
                align="center"
                side="bottom"
                sideOffset={8}
                className="w-[320px] p-0 rounded-xl shadow-xl border border-border overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--surface-2))] border-b border-border">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
                    <span className="text-sm font-semibold">
                      {format(date, 'EEEE, d MMM')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPopoverDate(null)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-card/60 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Events list */}
                <div className="max-h-[300px] overflow-y-auto">
                  {dayEvents.map((evt, idx) => {
                    const startTime = evt.start ? new Date(evt.start) : null;
                    const endTime = evt.end ? new Date(evt.end) : null;
                    const timeRange = startTime
                      ? `${format(startTime, 'h:mm a')}${endTime ? ` – ${format(endTime, 'h:mm a')}` : ''}`
                      : '';

                    return (
                      <div
                        key={evt.id || idx}
                        className={`px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} hover:bg-[hsl(var(--surface-2))] transition-colors`}
                      >
                        {/* Event Title */}
                        <div className="flex items-start gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--primary))] mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">
                              {evt.summary || 'Untitled Event'}
                            </p>
                            {timeRange && (
                              <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="text-xs">{timeRange}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Google Meet link */}
                        {evt.hangoutLink && (
                          <a
                            href={evt.hangoutLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-lg bg-[hsla(158,64%,42%,0.08)] hover:bg-[hsla(158,64%,42%,0.15)] transition-colors group"
                          >
                            <Video className="w-4 h-4 text-[hsl(158,64%,42%)]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[hsl(158,64%,42%)]">Join with Google Meet</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {evt.hangoutLink.replace('https://', '')}
                              </p>
                            </div>
                          </a>
                        )}

                        {/* Attendees */}
                        {evt.attendees?.length > 0 && (
                          <div className="flex items-start gap-2 mt-2.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[11px] text-muted-foreground mb-1">
                                {evt.attendees.length} guest{evt.attendees.length > 1 ? 's' : ''}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {evt.attendees.map((a, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 bg-card"
                                  >
                                    {a.name || a.email}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {evt.description && (
                          <div className="flex items-start gap-2 mt-2.5">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                              {evt.description}
                            </p>
                          </div>
                        )}

                        {/* Location */}
                        {evt.location && (
                          <div className="flex items-start gap-2 mt-2">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">{evt.location}</p>
                          </div>
                        )}

                        {/* Open in the calendar */}
                        {evt.htmlLink && (
                          <div className="mt-3 pt-2.5 border-t border-border/60">
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open in calendar
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Select date action */}
                <div className="px-4 py-2.5 border-t border-border bg-[hsl(var(--surface-2))]">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelect(date);
                      setPopoverDate(null);
                    }}
                    className="w-full text-center text-xs font-medium text-[hsl(var(--primary))] hover:underline"
                  >
                    Select this date
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
