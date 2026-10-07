import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ExternalLink, Video, UserCheck, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import MultiEmailInput from '@/components/shared/MultiEmailInput';
import { getCalendarEvents, createCalendarEvent } from '@/lib/api';

function NewMeetingDialog({ open, onOpenChange, onBooked }) {
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
    // Pull the authoritative list, committing any email still sitting in the box that
    // the user never pressed Enter/comma on — see MultiEmailInput.flush().
    const finalEmails = emailsInputRef.current?.flush() ?? emails;
    setBusy(true);
    try {
      const { data } = await createCalendarEvent({
        name: subject || finalEmails[0] || 'Meeting',
        emails: finalEmails,
        start_time: new Date(when).toISOString(),
        duration_minutes: Number(duration) || 30,
        subject: subject || undefined,
        description,
      });
      const joinUrl = data?.event?.join_url;
      toast.success(
        finalEmails.length ? `Meeting booked — invite sent to ${finalEmails.length} attendee${finalEmails.length > 1 ? 's' : ''}` : 'Meeting booked',
        joinUrl ? {
          description: joinUrl,
          action: { label: 'Copy link', onClick: () => { navigator.clipboard.writeText(joinUrl); toast.success('Meet link copied'); } },
        } : undefined,
      );
      onOpenChange(false);
      reset();
      onBooked?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to book meeting');
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
            <p className="text-[11px] text-muted-foreground mt-1">Press Enter or comma to add each address — one or many.</p>
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

export default function MeetingsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = () => {
    setLoading(true);
    getCalendarEvents()
      .then((r) => { setEvents(r.data.events || []); setError(null); })
      .catch((e) => setError(e.response?.data?.detail || 'Connect Google Calendar in Settings to see meetings.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Meetings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your real Google Calendar — synced live, no mock data.</p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} className="bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> New meeting
        </Button>
      </div>

      {error && (
        <Card className="card-base p-6 text-sm text-muted-foreground">{error}</Card>
      )}

      <div className="space-y-2">
        {events.map((e) => (
          <Card key={e.id} className="card-base p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">{e.summary || '(No title)'}</div>
                {e.lead_id && (
                  <Badge variant="outline" className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/25">
                    <UserCheck className="w-3 h-3" /> Linked to {e.lead_name || 'lead'}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {e.start ? new Date(e.start).toLocaleString() : ''} {e.location ? `· ${e.location}` : ''}
              </div>
              {e.attendees?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">{e.attendees.map((a) => a.name || a.email).join(', ')}</div>
              )}
              {e.lead_id && (
                <Link to="/prospecting" className="text-xs text-primary mt-1 inline-block underline">View lead in Prospecting →</Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {e.hangoutLink && (
                <>
                  <a href={e.hangoutLink} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                    <Video className="w-3.5 h-3.5" /> Join
                  </a>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(e.hangoutLink); toast.success('Meet link copied'); }}
                    className="text-xs text-muted-foreground inline-flex items-center gap-1"
                    title="Copy Meet link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {e.htmlLink && (
                <a href={e.htmlLink} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </Card>
        ))}
        {!loading && !error && events.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            No upcoming events on your calendar.
          </div>
        )}
      </div>

      <NewMeetingDialog open={newOpen} onOpenChange={setNewOpen} onBooked={load} />
    </div>
  );
}
