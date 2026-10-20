import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LeadTimelineDialog from '@/components/shared/LeadTimelineDialog';
import { useCallLogDetail } from '@/hooks/useCallLogs';
import { getCallRecordingUrl } from '@/lib/api';
import { callStatusMeta } from '@/lib/callOutcome';
import { NOT_CONNECTED, bookMeeting, getPrimaryCalendar } from '@/lib/calendar';
import { toast } from 'sonner';
import {
  ArrowLeft, Clock, Phone, User, FileText, Calendar,
  CheckCircle2, XCircle, AlertCircle, Loader2,
  MessageSquare, Wrench, BarChart3, Info, Layers, CalendarPlus, History, Mic
} from 'lucide-react';

function BookMeetingDialog({ open, onOpenChange, log, onBooked }) {
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!when) { toast.error('Pick a date and time'); return; }
    setBusy(true);
    try {
      const calendar = await getPrimaryCalendar();
      if (!calendar) {
        toast.error(NOT_CONNECTED);
        setBusy(false);
        return;
      }
      const context = [
        notes.trim(),
        log.customer_name && `Lead: ${log.customer_name}`,
        log.phone_number && `Phone: ${log.phone_number}`,
        `Booked from call ${log.vapi_call_id}`,
      ].filter(Boolean).join('\n');
      await bookMeeting(calendar.id, {
        summary: `Meeting with ${log.customer_name || 'Lead'}`,
        start: when,
        durationMinutes: 30,
        description: context,
      });
      toast.success('Meeting added to your calendar');
      onOpenChange(false);
      onBooked?.();
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to book meeting');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book meeting with {log.customer_name || 'this lead'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date &amp; time</label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5" placeholder="Context for this meeting..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-[#F87217] hover:bg-[#C2560E] text-white">
            {busy ? 'Booking…' : 'Book meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Plays a call recording. Private (HIPAA) recordings need a signed URL that
 * expires after ~30 minutes, and <audio> cannot send the login token, so ask
 * the API for a fresh URL with the token, then play that URL directly.
 * An expired URL errors on play; fetch a new one once and retry.
 */
function RecordingPlayer({ callId }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [retried, setRetried] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCallRecordingUrl(callId);
      setUrl(res.data.url);
    } catch (e) {
      setError(e.response?.status === 404 ? 'No recording for this call.' : 'Could not load the recording.');
    }
  }, [callId]);

  useEffect(() => { setRetried(false); load(); }, [load]);

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!url) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading recording…</div>;
  }
  return (
    <audio
      key={url}
      controls
      preload="metadata"
      className="w-full"
      src={url}
      onError={() => {
        if (!retried) { setRetried(true); load(); } else { setError('The recording could not be played.'); }
      }}
    >
      Your browser does not support audio playback.
    </audio>
  );
}

const TONE_ICONS = { good: CheckCircle2, live: Loader2, waiting: AlertCircle, bad: XCircle, neutral: AlertCircle };

function StatusBadge({ status }) {
  const meta = callStatusMeta(status);
  const Icon = TONE_ICONS[meta.tone];
  return (
    <Badge variant="outline" className={`${meta.className} gap-1 text-xs font-medium`}>
      <Icon className="w-3 h-3" aria-hidden="true" /> {meta.label}
    </Badge>
  );
}

function LeadStatusBadge({ status }) {
  const map = {
    hot: 'bg-rose-500/15 text-rose-500 border-rose-500/25',
    cold: 'bg-blue-500/15 text-blue-500 border-blue-500/25',
    warm: 'bg-amber-500/15 text-amber-500 border-amber-500/25',
  };
  const labelMap = {
    hot: '🔥 Hot Lead',
    cold: '❄️ Cold Lead',
    warm: '🌤️ Warm Lead',
  };
  const s = map[status] || map.warm;
  const label = labelMap[status] || '🌤️ Warm Lead';
  return (
    <Badge variant="outline" className={`${s} gap-1 text-xs font-semibold uppercase tracking-wider`}>
      {label}
    </Badge>
  );
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDateTime(iso) {
  if (!iso) return '--';
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return new Date(normalized).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium break-all text-foreground">{value || '--'}</p>
      </div>
    </div>
  );
}

export default function CallLogDetail({ callId, onBack }) {
  const { detail, loading, error } = useCallLogDetail(callId);
  const [bookOpen, setBookOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!detail) return null;

  const d = detail;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground hover:bg-muted">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1" />
        {d.lead_id && (
          <>
            <Button size="sm" variant="outline" onClick={() => setTimelineOpen(true)} className="gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" /> View Journey
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBookOpen(true)} className="gap-1.5 text-xs">
              <CalendarPlus className="w-3.5 h-3.5" /> Book Meeting
            </Button>
          </>
        )}
        <StatusBadge status={d.status} />
        {d.lead_status && <LeadStatusBadge status={d.lead_status} />}
        {d.appointment_booked && (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25 gap-1 text-xs">
            <Calendar className="w-3 h-3" /> Appointment Booked
          </Badge>
        )}
      </div>
      {d.lead_id && <BookMeetingDialog open={bookOpen} onOpenChange={setBookOpen} log={d} />}
      {d.lead_id && (
        <LeadTimelineDialog leadId={d.lead_id} leadName={d.customer_name} open={timelineOpen} onOpenChange={setTimelineOpen} />
      )}

      {/* Title card */}
      <Card className="bg-card rounded-xl border border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F87217]/10 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-[#F87217]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{d.customer_name || 'Unknown Caller'}</h2>
              <p className="text-sm text-muted-foreground">{d.phone_number || 'No phone'}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {formatDuration(d.duration_seconds)}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {formatDateTime(d.started_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left column */}
        <div className="xl:col-span-8 space-y-4">
          {/* AI Summary */}
          {d.summary && (
            <Card className="bg-card rounded-xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#F87217]" /> AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{d.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Transcript */}
          <Card className="bg-card rounded-xl border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground/80 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#F87217]" /> Full Transcript
                </span>
                {d.transcript && (
                  <button
                    onClick={() => {
                      const formatted = d.transcript
                        .split('\n')
                        .filter(line => line.trim())
                        .map(line => {
                          const isBot = /^(bot|assistant|ai):/i.test(line);
                          const isUser = /^user:/i.test(line);
                          const text = line.replace(/^(bot|assistant|ai|user):\s*/i, '');
                          if (isBot) return `Executive: ${text}`;
                          if (isUser) return `${d.customer_name || 'Lead'}: ${text}`;
                          return line;
                        })
                        .join('\n');
                      const blob = new Blob([formatted], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `transcript-${d.vapi_call_id || d.id || 'call'}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#F87217] hover:text-[#C2560E] border border-[#F87217]/30 hover:border-[#F87217] bg-[#F87217]/5 hover:bg-[#F87217]/10 px-2.5 py-1 rounded-md transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.transcript ? (
                <div className="max-h-[480px] overflow-y-auto">
                  {d.transcript.split('\n').filter(line => line.trim()).map((line, i) => {
                    const isBot = /^(bot|assistant|ai):/i.test(line);
                    const isUser = /^user:/i.test(line);
                    const text = line.replace(/^(bot|assistant|ai|user):\s*/i, '');
                    const speakerName = isBot ? 'Executive' : isUser ? (d.customer_name || 'Lead') : null;
                    if (!speakerName) return null;
                    return (
                      <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted transition-colors">
                        <div className="w-24 shrink-0 pt-0.5">
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${isBot ? 'text-[#F87217]' : 'text-muted-foreground'}`}>
                            {speakerName}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed flex-1">{text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No transcript available</p>
              )}
            </CardContent>
          </Card>

          {/* Call recording */}
          {d.recording_url && d.recording_url !== 'rawRecordingUploadDisabled' && (
            <Card className="bg-card rounded-xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#F87217]" /> Call Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecordingPlayer callId={d.vapi_call_id || d.id} />
              </CardContent>
            </Card>
          )}


          {/* Tool Calls */}
          {d.tool_calls && d.tool_calls.length > 0 && (
            <Card className="bg-card rounded-xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#F87217]" /> Tool Calls / Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border bg-muted p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{JSON.stringify(d.tool_calls, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column – metadata */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="bg-card rounded-xl border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#F87217]" /> Call Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100">
              <MetaRow icon={Layers} label="Campaign" value={d.campaign_name || "Manual / On-demand"} />
              <MetaRow icon={FileText} label="Call ID" value={d.vapi_call_id} />
              <MetaRow icon={User} label="Customer" value={d.customer_name} />
              <MetaRow icon={Phone} label="Phone" value={d.phone_number} />
              <MetaRow icon={Clock} label="Duration" value={formatDuration(d.duration_seconds)} />
              <MetaRow icon={Calendar} label="Started" value={formatDateTime(d.started_at)} />
              <MetaRow icon={Calendar} label="Ended" value={formatDateTime(d.ended_at)} />
              <MetaRow icon={AlertCircle} label="End Reason" value={d.end_reason} />
              <MetaRow icon={FileText} label="Source" value={d.source_type} />
              <MetaRow icon={CheckCircle2} label="Appointment" value={d.appointment_booked ? 'Yes ✓' : 'No'} />
              <MetaRow icon={BarChart3} label="Lead Status" value={d.lead_status ? d.lead_status.toUpperCase() : "WARM"} />
            </CardContent>
          </Card>

          {/* Structured Data */}
          {d.structured_data && (
            <Card className="bg-card rounded-xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80">Extracted Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[250px] overflow-y-auto rounded-lg border border-border bg-muted p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{JSON.stringify(d.structured_data, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
