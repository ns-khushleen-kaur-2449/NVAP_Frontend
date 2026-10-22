import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createVoiceCampaign } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Play, CalendarClock, Users, FileSpreadsheet } from 'lucide-react';
import {
  CallingConfigFields, CallingWindowFields, DEFAULT_CONFIG, ScheduleWarnings, TimeZoneField,
  announceCalendarSync, apiErrorMessage, browserTimeZone, configErrors, useScheduleCheck, validateSettings,
  withRetryDefaults, zonedToIso,
} from './CampaignSettingsFields';

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

/**
 * Campaign details form shown when the user launches a campaign.
 *
 * source: { type: 'leads', prospectIds: string[] }
 *       | { type: 'csv', contacts: object[], filename: string, skipped?: number }
 * Calls POST /api/campaigns with start "now" or "scheduled", then onCreated(campaign).
 */
export default function CampaignLaunchDialog({ open, onOpenChange, source, assistants: offered = [], defaultAssistantId = '', onCreated }) {
  // A local-only assistant (no Vapi id, e.g. the demo seed) cannot place calls, and an option
  // needs a value: leave it out.
  const assistants = useMemo(() => offered.filter((a) => a.vapi_assistant_id), [offered]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [timeZone, setTimeZone] = useState(browserTimeZone());
  const [startMode, setStartMode] = useState('now');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [callingWindow, setCallingWindow] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAssistantId((prev) => prev || defaultAssistantId || assistants[0]?.vapi_assistant_id || '');
    setError('');
  }, [open, defaultAssistantId, assistants]);

  const [tried, setTried] = useState(false);
  let plannedStart = null;
  try { plannedStart = startMode === 'scheduled' ? zonedToIso(startDate, startTime, timeZone.trim()) : null; } catch { plannedStart = null; }
  // The backend's calling-hours notes before saving, and the tenant's retry delays to start from.
  const check = useScheduleCheck({ scheduledAt: plannedStart, timeZone: timeZone.trim(), callingWindow, enabled: open });
  useEffect(() => {
    if (check.retryDefaults) setConfig((prev) => withRetryDefaults(prev, check.retryDefaults));
  }, [check.retryDefaults]);
  const errors = tried ? configErrors(config) : {};

  const contactCount = source?.type === 'csv' ? source.contacts?.length || 0 : source?.prospectIds?.length || 0;

  const reset = () => {
    setName(''); setDescription(''); setNotes(''); setStartMode('now'); setStartDate(''); setStartTime('');
    setCallingWindow(null); setConfig(withRetryDefaults(DEFAULT_CONFIG, check.retryDefaults)); setTimeZone(browserTimeZone());
    setError(''); setTried(false);
  };

  const submit = async () => {
    setTried(true);
    const problem =
      (!name.trim() && 'Give the campaign a name.') ||
      (!description.trim() && 'Say what the campaign is about.') ||
      (!assistantId && 'Pick the assistant that will make the calls.') ||
      validateSettings({ window: callingWindow, config, timeZone });
    if (problem) { setError(problem); return; }

    let scheduledAt = null;
    if (startMode === 'scheduled') {
      try {
        scheduledAt = zonedToIso(startDate, startTime, timeZone.trim());
      } catch {
        setError('That timezone is not recognised.');
        return;
      }
      if (!scheduledAt) { setError('Pick a start date and time.'); return; }
      if (new Date(scheduledAt) <= new Date()) { setError('The start time must be in the future.'); return; }
    }

    const body = {
      name: name.trim(),
      description: description.trim(),
      notes: notes.trim() || null,
      assistant_id: assistantId,
      timezone: timeZone.trim(),
      calling_window: callingWindow,
      calling_config: config,
      start: startMode,
      ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      ...(source.type === 'csv'
        ? { contacts: source.contacts, source_filename: source.filename }
        : { prospect_ids: source.prospectIds }),
    };

    setSubmitting(true);
    setError('');
    try {
      const res = await createVoiceCampaign(body);
      const campaign = res.data;
      const skipped = campaign.skipped_contacts || 0;
      toast.success(
        `${startMode === 'scheduled' ? 'Campaign scheduled' : 'Campaign started'} with ${campaign.total_leads} contact${campaign.total_leads === 1 ? '' : 's'}` +
        (skipped ? ` (${skipped} skipped: no valid or duplicate number)` : ''),
      );
      announceCalendarSync(campaign.calendar_sync);
      reset();
      onOpenChange(false);
      onCreated?.(campaign);
    } catch (e) {
      const message = apiErrorMessage(e, 'Failed to create campaign');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="ops max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Launch campaign</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            {source?.type === 'csv'
              ? <><FileSpreadsheet className="w-3.5 h-3.5" /> {contactCount} contacts from {source.filename}</>
              : <><Users className="w-3.5 h-3.5" /> {contactCount} selected lead{contactCount === 1 ? '' : 's'}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Section title="Campaign details">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Campaign name <span className="text-red-500">*</span></label>
              <Input value={name} maxLength={255} onChange={(e) => setName(e.target.value)} placeholder="e.g. October site-visit follow-ups" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">What is this campaign about? <span className="text-red-500">*</span></label>
              <Textarea
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[72px]"
                placeholder="e.g. Invite leads who enquired in October to book a site visit this weekend"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Textarea value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" placeholder="Anything the team should know" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assistant <span className="text-red-500">*</span></label>
              <Select value={assistantId} onValueChange={setAssistantId}>
                <SelectTrigger><SelectValue placeholder={assistants.length ? 'Select an assistant' : 'No assistants available'} /></SelectTrigger>
                <SelectContent>
                  {assistants.map((a) => (
                    <SelectItem key={a.vapi_assistant_id} value={a.vapi_assistant_id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="When">
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'now', label: 'Start now', hint: 'Begin dialling right away', icon: Play },
                { value: 'scheduled', label: 'Schedule', hint: 'Pick a date and time', icon: CalendarClock },
              ].map((option) => {
                const Icon = option.icon;
                const active = startMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStartMode(option.value)}
                    className={`text-left rounded-lg border p-3 transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="text-sm font-medium flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {option.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{option.hint}</p>
                  </button>
                );
              })}
            </div>
            {startMode === 'scheduled' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Time ({timeZone || 'timezone'})</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              </div>
            )}
            <TimeZoneField value={timeZone} onChange={setTimeZone} />
          </Section>

          <Section title="Calling hours">
            <CallingWindowFields value={callingWindow} onChange={setCallingWindow} />
          </Section>

          <Section title="Calling rules">
            <CallingConfigFields value={config} onChange={setConfig} errors={errors} />
          </Section>

          <ScheduleWarnings check={check} />
          {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || contactCount === 0} className="bg-primary text-primary-foreground">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {startMode === 'scheduled' ? 'Schedule campaign' : 'Start campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
