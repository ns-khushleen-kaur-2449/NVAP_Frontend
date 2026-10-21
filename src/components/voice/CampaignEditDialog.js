import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getProspects, updateVoiceCampaign } from '@/lib/api';
import { toLeadRow } from '@/lib/prospects';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import {
  CallingConfigFields, CallingWindowFields, DEFAULT_CONFIG, ScheduleWarnings, TimeZoneField,
  announceCalendarSync, apiErrorMessage, configErrors, isoToZoned, useScheduleCheck, validateSettings, zonedToIso,
} from './CampaignSettingsFields';

const OPEN_STATUSES = ['draft', 'scheduled'];
const FINAL_STATUSES = ['completed', 'failed', 'cancelled'];
// Changing the calling window or rules of these needs a reason and only affects future dials.
const LIVE_STATUSES = ['processing', 'paused'];

/**
 * Edit a campaign through PATCH /api/campaigns/{id}. What can change depends on
 * status: name/description/notes always; calling hours and rules until it
 * finishes; timezone, start time and leads only while draft or scheduled.
 */
export default function CampaignEditDialog({ campaign, open, onOpenChange, onSaved }) {
  const status = campaign?.status;
  const live = LIVE_STATUSES.includes(status);
  const isOpen = OPEN_STATUSES.includes(status);
  const settingsEditable = !FINAL_STATUSES.includes(status);
  const leadsEditable = isOpen && campaign?.source_type === 'leads';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [callingWindow, setCallingWindow] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [prospectIds, setProspectIds] = useState(new Set());
  const [allLeads, setAllLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadQuery, setLeadQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open || !campaign) return;
    const tz = campaign.timezone || 'Asia/Kolkata';
    const zoned = isoToZoned(campaign.scheduled_at, tz);
    setName(campaign.name || '');
    setDescription(campaign.description || '');
    setNotes(campaign.notes || '');
    setTimeZone(tz);
    setStartDate(zoned.date);
    setStartTime(zoned.time);
    setCallingWindow(campaign.calling_window || null);
    setConfig({ ...DEFAULT_CONFIG, ...(campaign.calling_config || {}) });
    setProspectIds(new Set((campaign.prospects || []).map((l) => l.prospect_id)));
    setLeadQuery('');
    setReason(''); setTried(false); setFormError('');
  }, [open, campaign]);

  let plannedStart = null;
  try { plannedStart = isOpen && startDate && startTime ? zonedToIso(startDate, startTime, timeZone.trim()) : null; } catch { plannedStart = null; }
  const check = useScheduleCheck({ scheduledAt: plannedStart, timeZone: timeZone.trim(), callingWindow,
    enabled: open && settingsEditable });
  const rulesChanged = Boolean(campaign) && (JSON.stringify(callingWindow || null) !== JSON.stringify(campaign.calling_window || null)
    || JSON.stringify(config) !== JSON.stringify({ ...DEFAULT_CONFIG, ...(campaign.calling_config || {}) }));
  const errors = tried ? configErrors(config) : {};

  useEffect(() => {
    if (!open || !leadsEditable) return;
    setLoadingLeads(true);
    getProspects({ leads_only: true, limit: 1000 })
      .then((res) => setAllLeads((res.data?.prospects || []).map(toLeadRow)))
      .catch(() => setAllLeads([]))
      .finally(() => setLoadingLeads(false));
  }, [open, leadsEditable]);

  // Current campaign leads first, then the rest; both filtered by the search box.
  const leadOptions = useMemo(() => {
    const known = new Map(allLeads.map((l) => [l.id, { id: l.id, name: l.name, phone: l.phone }]));
    for (const l of campaign?.prospects || []) {
      if (!known.has(l.prospect_id)) known.set(l.prospect_id, { id: l.prospect_id, name: l.name, phone: l.phone });
    }
    const q = leadQuery.trim().toLowerCase();
    return [...known.values()]
      .filter((l) => !q || `${l.name || ''} ${l.phone || ''}`.toLowerCase().includes(q))
      .sort((a, b) => Number(prospectIds.has(b.id)) - Number(prospectIds.has(a.id)) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [allLeads, campaign, leadQuery, prospectIds]);

  const toggleLead = (id) => {
    setProspectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setTried(true);
    setFormError('');
    if (!name.trim() || !description.trim()) {
      setFormError('Name and description are required.');
      return;
    }
    const body = { name: name.trim(), description: description.trim(), notes: notes.trim() };
    if (settingsEditable && (!live || rulesChanged)) {
      const problem = validateSettings({ window: callingWindow, config, timeZone });
      if (problem) { setFormError(problem); return; }
      if (live && !reason.trim()) { setFormError('Say why the rules change while the campaign runs.'); return; }
      body.calling_window = callingWindow;
      body.calling_config = config;
      if (live) body.reason = reason.trim();
    }
    if (isOpen) {
      body.timezone = timeZone.trim();
      if (startDate && startTime) {
        let iso;
        try {
          iso = zonedToIso(startDate, startTime, timeZone.trim());
        } catch {
          toast.error('That timezone is not recognised.');
          return;
        }
        if (new Date(iso) <= new Date()) { toast.error('The start time must be in the future.'); return; }
        body.scheduled_at = iso;
      } else if (status === 'scheduled') {
        toast.error('A scheduled campaign needs a start date and time.');
        return;
      }
    }
    if (leadsEditable) {
      if (prospectIds.size === 0) { toast.error('Keep at least one lead in the campaign.'); return; }
      const current = new Set((campaign.prospects || []).map((l) => l.prospect_id));
      const changed = current.size !== prospectIds.size || [...prospectIds].some((id) => !current.has(id));
      if (changed) body.prospect_ids = Array.from(prospectIds);
    }
    setSaving(true);
    try {
      const res = await updateVoiceCampaign(campaign.id, body);
      toast.success('Campaign updated');
      if (res.data.calendar_sync?.status !== 'updated') announceCalendarSync(res.data.calendar_sync);
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (e) {
      const message = apiErrorMessage(e, 'Failed to update campaign');
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const label = (text) => <label className="text-xs font-medium text-muted-foreground">{text}</label>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ops max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>
            {isOpen
              ? 'This campaign has not started, so everything can change.'
              : settingsEditable
                ? 'This campaign is running: you can change its details and calling settings, but not its start time or leads.'
                : `This campaign is ${status}; only its name, description and notes can change.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            {label('Name')}
            <Input value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            {label(<>What is this campaign about? <span className="text-red-500">*</span></>)}
            <Textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} className="min-h-[72px]" />
          </div>
          <div className="space-y-1.5">
            {label('Notes')}
            <Textarea value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" />
          </div>

          {isOpen && (
            <div className="space-y-3">
              <TimeZoneField value={timeZone} onChange={setTimeZone} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  {label('Start date')}
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  {label(`Start time (${timeZone || 'timezone'})`)}
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {settingsEditable && (
            <>
              {live && <p className="rounded-lg ops-tone ops-tone-info px-3 py-2 text-sm">Changes to calling hours and rules apply to future dials only.</p>}
              <CallingWindowFields value={callingWindow} onChange={setCallingWindow} />
              <CallingConfigFields value={config} onChange={setConfig} errors={errors} />
              <ScheduleWarnings check={check} />
              {live && rulesChanged && (
                <div className="space-y-1.5">
                  <label htmlFor="edit-rules-reason" className="text-xs font-medium text-muted-foreground">Why change the rules now? *</label>
                  <Textarea id="edit-rules-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)}
                    aria-required="true" className="min-h-[56px]" placeholder="Kept in the campaign's history" />
                </div>
              )}
            </>
          )}
          {formError && <p role="alert" className="text-sm text-[#b42318]">{formError}</p>}

          {leadsEditable && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                {label('Leads')}
                <span className="text-[11px] text-muted-foreground tabular-nums">{prospectIds.size} selected</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search leads" className="pl-8 h-8 text-xs" />
              </div>
              <ScrollArea className="h-44 rounded-md border border-border">
                {loadingLeads ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading leads…
                  </div>
                ) : leadOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No leads match.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {leadOptions.map((l) => (
                      <li key={l.id}>
                        <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[hsl(var(--surface-2))]">
                          <Checkbox checked={prospectIds.has(l.id)} onCheckedChange={() => toggleLead(l.id)} />
                          <span className="text-xs font-medium truncate flex-1">{l.name || 'Unnamed'}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{l.phone || '—'}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">Leads without a valid phone number are skipped.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
