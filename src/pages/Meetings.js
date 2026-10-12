import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarClock, ExternalLink, Plus, Megaphone, RefreshCw, Loader2, Trash2, Users, User, CalendarCheck,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import {
  addDays, addMonths, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import MultiEmailInput from '@/components/shared/MultiEmailInput';
import { deleteCalendarEvent, getVoiceCampaigns } from '@/lib/api';
import { NOT_CONNECTED, bookMeeting, getPrimaryCalendar, listEventsBetween, listUpcomingEvents } from '@/lib/calendar';

const WINDOW_DAYS = 30;

const errorText = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

function NewMeetingDialog({ open, onOpenChange, connectionId, onBooked }) {
  const [subject, setSubject] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(30);
  const [emails, setEmails] = useState([]);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const emailsInputRef = useRef(null);

  const reset = () => { setSubject(''); setWhen(''); setDuration(30); setEmails([]); setDescription(''); };

  const submit = async () => {
    if (!when) { toast.error('Pick a date and time'); return; }
    if (new Date(when) <= new Date()) { toast.error('Pick a time in the future'); return; }
    // Commit any address still sitting in the box without Enter/comma — see MultiEmailInput.flush().
    const finalEmails = emailsInputRef.current?.flush() ?? emails;
    setBusy(true);
    try {
      const event = await bookMeeting(connectionId, {
        summary: subject.trim() || (finalEmails[0] ? `Meeting with ${finalEmails[0]}` : 'Meeting'),
        start: when,
        durationMinutes: duration,
        attendees: finalEmails,
        description: description.trim(),
      });
      toast.success(
        finalEmails.length ? `Meeting booked. Google sent the invite to ${finalEmails.length} attendee${finalEmails.length > 1 ? 's' : ''}.` : 'Meeting booked',
        event?.html_link ? { action: { label: 'Open', onClick: () => window.open(event.html_link, '_blank', 'noopener') } } : undefined,
      );
      onOpenChange(false);
      reset();
      onBooked?.();
    } catch (e) {
      toast.error(errorText(e, 'Failed to book meeting'));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5" placeholder="Meeting title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date &amp; time</label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration (min)</label>
              <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attendees</label>
            <div className="mt-1.5">
              <MultiEmailInput ref={emailsInputRef} emails={emails} onChange={setEmails} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Press Enter or comma after each address. Google emails each attendee an invite.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" placeholder="What's this meeting about..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? 'Booking…' : 'Book meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const dayKey = (date) => date.toDateString();

function dayLabel(date) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function timeLabel(item) {
  if (item.allDay) return 'All day';
  const start = item.start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return item.end ? `${start} – ${item.end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : start;
}

function CampaignItem({ item }) {
  const { campaign } = item;
  return (
    <Link to={`/voice-campaigns/${campaign.id}`} className="block">
      <Card className="card-base p-4 border-l-4 border-l-[#F87217] hover:border-primary/40 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#F87217] text-white border-0 text-[10px] gap-1"><Megaphone className="w-3 h-3" /> Campaign</Badge>
              <span className="text-sm font-medium truncate">{campaign.name}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Starts {timeLabel(item)}{campaign.timezone ? ` · ${campaign.timezone}` : ''}
            </div>
            {campaign.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{campaign.description}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {campaign.total_leads} contacts</span>
              {campaign.created_by_user && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {campaign.created_by_user.name || campaign.created_by_user.email}</span>
              )}
              {campaign.calendar_event_id && (
                <span className="flex items-center gap-1 text-emerald-600"><CalendarCheck className="w-3 h-3" /> On Google Calendar</span>
              )}
            </div>
          </div>
          <span className="text-xs text-primary shrink-0">Open →</span>
        </div>
      </Card>
    </Link>
  );
}

function EventItem({ item, onCancel }) {
  const { event } = item;
  return (
    <Card className="card-base p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{event.summary || '(No title)'}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {timeLabel(item)}{event.location ? ` · ${event.location}` : ''}
        </div>
        {event.attendees?.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1 truncate">{event.attendees.join(', ')}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {event.html_link && (
          <a href={event.html_link} target="_blank" rel="noreferrer" title="Open in Google Calendar"
             className="p-1.5 rounded text-muted-foreground hover:text-foreground">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button type="button" onClick={() => onCancel(event)} title="Cancel meeting"
                className="p-1.5 rounded text-muted-foreground hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

function buildItems(events, campaigns) {
  // A campaign's own calendar entry is shown as the campaign, not twice.
  const campaignEventIds = new Set(campaigns.map((c) => c.calendar_event_id).filter(Boolean));
  return [
    ...campaigns
      .filter((c) => c.scheduled_at && !['draft', 'cancelled'].includes(c.status))
      .map((c) => ({ kind: 'campaign', key: `c-${c.id}`, start: new Date(c.scheduled_at), campaign: c })),
    ...events
      .filter((e) => !campaignEventIds.has(e.id) && e.status !== 'cancelled')
      .map((e) => ({
        kind: 'event',
        key: `e-${e.id}`,
        // All-day events come as a plain date; read it as local midnight.
        start: new Date(e.all_day ? `${e.start}T00:00:00` : e.start),
        end: e.end && !e.all_day ? new Date(e.end) : null,
        allDay: e.all_day,
        event: e,
      })),
  ].sort((a, b) => a.start - b.start);
}

function itemTitle(item) {
  return item.kind === 'campaign' ? item.campaign.name : (item.event.summary || '(No title)');
}

/** Month grid: dots for days with events, a hover preview of the day, click to select it. */
function MonthCalendar({ month, onMonthChange, selected, onSelect, itemsByDay, loading }) {
  const gridStart = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  return (
    <Card className="card-base p-4">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonthChange(subMonths(month, 1))} aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm font-semibold flex items-center gap-2">
          {format(month, 'MMMM yyyy')}
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const items = itemsByDay.get(dayKey(day)) || [];
          const inMonth = isSameMonth(day, month);
          const isSelected = selected && isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          return (
            <HoverCard key={day.toISOString()} openDelay={150} closeDelay={50}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : day)}
                  className={`relative h-12 rounded-md flex flex-col items-center justify-start pt-1.5 text-xs transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground'
                      : isToday ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-[hsl(var(--surface-2))]'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  {format(day, 'd')}
                  {items.length > 0 && (
                    <span className="flex items-center gap-0.5 mt-1">
                      {items.slice(0, 3).map((item) => (
                        <span
                          key={item.key}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : item.kind === 'campaign' ? 'bg-[#F87217]' : 'bg-primary'}`}
                        />
                      ))}
                      {items.length > 3 && <span className="text-[8px] leading-none">+{items.length - 3}</span>}
                    </span>
                  )}
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="left" className="w-72 p-3">
                <p className="text-xs font-semibold mb-2">{format(day, 'EEEE, d MMMM')}</p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events</p>
                ) : (
                  <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                    {items.map((item) => (
                      <li key={item.key} className="flex items-start gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.kind === 'campaign' ? 'bg-[#F87217]' : 'bg-primary'}`} />
                        <span className="min-w-0">
                          <span className="font-medium block truncate">{itemTitle(item)}</span>
                          <span className="text-muted-foreground">
                            {item.kind === 'campaign' ? `Campaign · starts ${timeLabel(item)}` : timeLabel(item)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Meeting</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#F87217]" /> Campaign</span>
        <span className="ml-auto">Click a day to see its events</span>
      </div>
    </Card>
  );
}

/**
 * The one scheduling page: upcoming meetings from the user's Google Calendar and
 * scheduled voice campaigns on the left, a month calendar on the right.
 */
export default function MeetingsPage() {
  const navigate = useNavigate();
  const [connection, setConnection] = useState(undefined); // undefined = loading, null = not connected
  const [eventsById, setEventsById] = useState(() => new Map());
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);

  const mergeEvents = (list) => setEventsById((prev) => {
    const next = new Map(prev);
    list.forEach((e) => next.set(e.id, e));
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [calendarResult, campaignResult] = await Promise.allSettled([
      (async () => {
        const primary = await getPrimaryCalendar();
        return { primary, events: primary ? await listUpcomingEvents(primary.id, WINDOW_DAYS) : [] };
      })(),
      getVoiceCampaigns(),
    ]);
    if (calendarResult.status === 'fulfilled') {
      setConnection(calendarResult.value.primary);
      setEventsById(new Map(calendarResult.value.events.map((e) => [e.id, e])));
    } else {
      setConnection(null);
      setEventsById(new Map());
      setError(errorText(calendarResult.reason, 'Could not load your calendar.'));
    }
    setCampaigns(campaignResult.status === 'fulfilled' ? campaignResult.value.data?.campaigns || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch the six weeks the month grid shows (42 days, inside the API's 62-day limit).
  useEffect(() => {
    if (!connection) return undefined;
    let stale = false;
    const gridStart = startOfWeek(startOfMonth(month));
    setLoadingMonth(true);
    listEventsBetween(connection.id, gridStart, addDays(gridStart, 42))
      .then((list) => { if (!stale) mergeEvents(list); })
      .catch(() => { if (!stale) toast.error('Could not load events for that month'); })
      .finally(() => { if (!stale) setLoadingMonth(false); });
    return () => { stale = true; };
  }, [connection, month]);

  const allItems = useMemo(() => buildItems([...eventsById.values()], campaigns), [eventsById, campaigns]);

  const itemsByDay = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      const key = dayKey(item.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }, [allItems]);

  // Left column: the selected day, or everything coming up in the next WINDOW_DAYS.
  const days = useMemo(() => {
    if (selectedDay) {
      return [{ key: dayKey(selectedDay), label: dayLabel(selectedDay), items: itemsByDay.get(dayKey(selectedDay)) || [] }];
    }
    const now = new Date();
    const horizon = new Date(now.getTime() + WINDOW_DAYS * 86400000);
    const upcoming = allItems.filter((item) => (item.end || item.start) >= now && item.start <= horizon
      && (item.kind !== 'campaign' || item.campaign.status === 'scheduled'));
    const grouped = [];
    for (const item of upcoming) {
      const key = dayKey(item.start);
      if (!grouped.length || grouped[grouped.length - 1].key !== key) grouped.push({ key, label: dayLabel(item.start), items: [] });
      grouped[grouped.length - 1].items.push(item);
    }
    return grouped;
  }, [allItems, itemsByDay, selectedDay]);

  const selectDay = (day) => {
    setSelectedDay(day);
    if (day && !isSameMonth(day, month)) setMonth(startOfMonth(day));
  };

  const cancelMeeting = async () => {
    const event = pendingCancel;
    setPendingCancel(null);
    try {
      await deleteCalendarEvent(connection.id, event.id);
      setEventsById((prev) => {
        const next = new Map(prev);
        next.delete(event.id);
        return next;
      });
      toast.success('Meeting cancelled');
    } catch (e) {
      toast.error(errorText(e, 'Failed to cancel meeting'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Meetings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your Google Calendar meetings and scheduled campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/voice_agent?tab=builder')}>
            <Megaphone className="w-3.5 h-3.5 mr-1" /> Schedule campaign
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)} disabled={!connection} className="bg-primary text-primary-foreground">
            <Plus className="w-3.5 h-3.5 mr-1" /> New meeting
          </Button>
        </div>
      </div>

      {connection === null && !loading && (
        <Card className="card-base p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
          <span>{error || NOT_CONNECTED}</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>Open Settings</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* Left: upcoming events, or the selected day */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {selectedDay ? `Events on ${format(selectedDay, 'EEEE, d MMMM yyyy')}` : `Upcoming events · next ${WINDOW_DAYS} days`}
            </h2>
            {selectedDay && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDay(null)}>
                <X className="w-3.5 h-3.5 mr-1" /> Show upcoming
              </Button>
            )}
          </div>

          {loading && allItems.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your schedule…
            </div>
          ) : days.length === 0 || (selectedDay && days[0].items.length === 0) ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
              {selectedDay
                ? 'Nothing on this day.'
                : 'Nothing coming up. Book a meeting, or schedule a campaign from the Lead-to-Campaign Builder.'}
            </div>
          ) : (
            <div className="space-y-6">
              {days.map((day) => (
                <section key={day.key} className="space-y-2">
                  {!selectedDay && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day.label}</h3>}
                  {day.items.map((item) => (item.kind === 'campaign'
                    ? <CampaignItem key={item.key} item={item} />
                    : <EventItem key={item.key} item={item} onCancel={setPendingCancel} />))}
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Right: month calendar */}
        <div className="lg:sticky lg:top-4 space-y-2">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={selectedDay}
            onSelect={selectDay}
            itemsByDay={itemsByDay}
            loading={loadingMonth}
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Jump to date"
              value={selectedDay ? format(selectedDay, 'yyyy-MM-dd') : ''}
              onChange={(e) => selectDay(e.target.value ? parseISO(e.target.value) : null)}
              className="h-8 text-xs"
            />
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0"
                    onClick={() => { setMonth(startOfMonth(new Date())); selectDay(new Date()); }}>
              Today
            </Button>
          </div>
        </div>
      </div>

      {connection && (
        <NewMeetingDialog open={newOpen} onOpenChange={setNewOpen} connectionId={connection.id} onBooked={load} />
      )}

      <AlertDialog open={!!pendingCancel} onOpenChange={(open) => !open && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingCancel?.summary || 'Untitled'}" will be deleted from your Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={cancelMeeting} className="bg-red-600 text-white hover:bg-red-700">Cancel meeting</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
