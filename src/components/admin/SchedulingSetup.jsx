import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Pencil, Plus, Sparkles, Trash2, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createExecutive, createMeetingType, deactivateExecutive, deactivateMeetingType, listExecutiveCandidates,
  listExecutives, listMeetingTypes, seedScheduling, updateExecutive, updateMeetingType,
} from '@/lib/api';

// Mirrors the backend's meeting_types policy (docs/scheduling/README.md).
const ASSIGNMENT_METHODS = [
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_loaded', label: 'Least loaded' },
  { value: 'owner', label: "Lead's owner" },
];
const CANCELLATION_ACTIONS = [
  { value: 'offer_rebook', label: 'Offer a new time' },
  { value: 'nurture', label: 'Thank and keep in touch' },
  { value: 'none', label: 'Just confirm' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NO_FALLBACK = 'none';
const NEW_MEETING_TYPE = {
  key: '', name: '', duration_minutes: 30, buffer_minutes: 15, min_notice_minutes: 120, booking_window_days: 14,
  slots_offered: 3, slot_interval_minutes: 30, assignment_method: 'round_robin', fallback_method: 'least_loaded',
  cancellation_action: 'offer_rebook', reminder_offsets_minutes: [1440, 60], active: true,
};
const WEEKDAY_HOURS = [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start_time: '09:00', end_time: '18:00' }));

const fieldClass = 'mt-1 bg-[hsl(var(--surface-2))] border-border';

const errorList = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return [detail];
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = (d.loc || []).filter((p) => p !== 'body').join('.');
      return field ? `${field}: ${d.msg}` : d.msg;
    });
  }
  return [fallback];
};

const methodLabel = (value) => ASSIGNMENT_METHODS.find((m) => m.value === value)?.label || value;

function hoursSummary(hours) {
  if (!hours?.length) return 'No working hours';
  const byTime = {};
  hours.forEach((h) => {
    const key = `${h.start_time}–${h.end_time}`;
    (byTime[key] = byTime[key] || []).push(WEEKDAYS[h.weekday]);
  });
  return Object.entries(byTime).map(([time, days]) => `${days.join(', ')} ${time}`).join(' · ');
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Errors({ errors }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-600 space-y-1">
      {errors.map((err) => <p key={err} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{err}</p>)}
    </div>
  );
}

function NumberField({ label, hint, value, onChange, min, max }) {
  return (
    <Field label={label} hint={hint}>
      <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </Field>
  );
}

function MeetingTypeDialog({ open, onOpenChange, meetingType, onSaved }) {
  const editing = Boolean(meetingType);
  const [form, setForm] = useState(NEW_MEETING_TYPE);
  const [reminders, setReminders] = useState('');
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = meetingType || NEW_MEETING_TYPE;
    setForm({ ...start, fallback_method: start.fallback_method || NO_FALLBACK });
    setReminders((start.reminder_offsets_minutes || []).join(', '));
    setErrors([]);
  }, [open, meetingType]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const offsets = reminders.split(',').map((v) => v.trim()).filter(Boolean).map(Number);
    if (offsets.some((n) => !Number.isInteger(n) || n < 1)) {
      setErrors(['Reminders must be whole minutes, e.g. 1440, 60']);
      return;
    }
    const body = {
      name: form.name.trim(),
      duration_minutes: Number(form.duration_minutes),
      buffer_minutes: Number(form.buffer_minutes),
      min_notice_minutes: Number(form.min_notice_minutes),
      booking_window_days: Number(form.booking_window_days),
      slots_offered: Number(form.slots_offered),
      slot_interval_minutes: Number(form.slot_interval_minutes),
      assignment_method: form.assignment_method,
      fallback_method: form.fallback_method === NO_FALLBACK ? null : form.fallback_method,
      cancellation_action: form.cancellation_action,
      reminder_offsets_minutes: offsets,
      active: form.active,
    };
    setSaving(true);
    try {
      if (editing) await updateMeetingType(meetingType.id, body);
      else await createMeetingType({ ...body, key: form.key.trim() });
      toast.success(editing ? 'Meeting type saved' : 'Meeting type created');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setErrors(errorList(e, 'Failed to save meeting type'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${meetingType.name}` : 'New meeting type'}</DialogTitle>
          <DialogDescription>How the voice agent offers and books this kind of meeting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name"><Input value={form.name} maxLength={255} onChange={(e) => set({ name: e.target.value })} className={fieldClass} /></Field>
            <Field label="Key" hint="What the agent asks for, e.g. demo. Lowercase letters, digits, underscores.">
              <Input value={form.key} maxLength={64} disabled={editing} onChange={(e) => set({ key: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField label="Length (min)" min={5} max={480} value={form.duration_minutes} onChange={(v) => set({ duration_minutes: v })} />
            <NumberField label="Buffer (min)" hint="Kept free around other meetings." min={0} max={240} value={form.buffer_minutes} onChange={(v) => set({ buffer_minutes: v })} />
            <NumberField label="Start every (min)" min={5} max={240} value={form.slot_interval_minutes} onChange={(v) => set({ slot_interval_minutes: v })} />
            <NumberField label="Minimum notice (min)" min={0} max={20160} value={form.min_notice_minutes} onChange={(v) => set({ min_notice_minutes: v })} />
            <NumberField label="Book up to (days ahead)" min={1} max={90} value={form.booking_window_days} onChange={(v) => set({ booking_window_days: v })} />
            <NumberField label="Times offered" min={1} max={5} value={form.slots_offered} onChange={(v) => set({ slots_offered: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Assign to">
              <Select value={form.assignment_method} onValueChange={(v) => set({ assignment_method: v })}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>{ASSIGNMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Otherwise">
              <Select value={form.fallback_method} onValueChange={(v) => set({ fallback_method: v })}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FALLBACK}>No fallback</SelectItem>
                  {ASSIGNMENT_METHODS.filter((m) => m.value !== form.assignment_method)
                    .map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="After a cancellation">
              <Select value={form.cancellation_action} onValueChange={(v) => set({ cancellation_action: v })}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>{CANCELLATION_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Reminders (minutes before)" hint="Comma-separated, up to 5. 1440 = a day, 60 = an hour.">
              <Input value={reminders} onChange={(e) => setReminders(e.target.value)} placeholder="1440, 60" className={fieldClass} />
            </Field>
            <Field label="Active">
              <div className="flex items-center gap-2 mt-2.5">
                <Switch checked={form.active} onCheckedChange={(v) => set({ active: v })} />
                <span className="text-xs text-muted-foreground">The agent can book it</span>
              </div>
            </Field>
          </div>
          <Errors errors={errors} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {editing ? 'Save changes' : 'Create meeting type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoursEditor({ hours, onChange }) {
  const update = (index, patch) => onChange(hours.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  return (
    <div className="space-y-2">
      {hours.map((h, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={String(h.weekday)} onValueChange={(v) => update(i, { weekday: Number(v) })}>
            <SelectTrigger className="w-24 h-8 text-xs bg-[hsl(var(--surface-2))] border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{WEEKDAYS.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="time" value={h.start_time} onChange={(e) => update(i, { start_time: e.target.value })}
            className="w-32 h-8 text-xs bg-[hsl(var(--surface-2))] border-border" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="time" value={h.end_time} onChange={(e) => update(i, { end_time: e.target.value })}
            className="w-32 h-8 text-xs bg-[hsl(var(--surface-2))] border-border" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(hours.filter((_, j) => j !== i))}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={hours.length >= 21}
          onClick={() => onChange([...hours, { weekday: 0, start_time: '09:00', end_time: '18:00' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add hours
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(WEEKDAY_HOURS)}>Mon–Fri 9–6</Button>
      </div>
    </div>
  );
}

function ExecutiveDialog({ open, onOpenChange, executive, meetingTypes, candidates, onSaved }) {
  const editing = Boolean(executive);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const available = candidates.filter((c) => !c.executive_id);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setForm(executive ? {
      user_id: executive.user_id, timezone: executive.timezone, daily_meeting_limit: executive.daily_meeting_limit ?? '',
      active: executive.active, working_hours: executive.working_hours, meeting_type_ids: executive.meeting_type_ids,
    } : {
      user_id: available[0]?.user_id ?? null, timezone: '', daily_meeting_limit: '', active: true,
      working_hours: WEEKDAY_HOURS, meeting_type_ids: meetingTypes.filter((m) => m.active).map((m) => m.id),
    });
  }, [open, executive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const chosen = candidates.find((c) => c.user_id === form.user_id);
  const toggleType = (id, on) => set({
    meeting_type_ids: on ? [...form.meeting_type_ids, id] : form.meeting_type_ids.filter((t) => t !== id),
  });

  const save = async () => {
    const body = {
      timezone: form.timezone.trim() || undefined,
      daily_meeting_limit: form.daily_meeting_limit === '' ? null : Number(form.daily_meeting_limit),
      active: form.active,
      working_hours: form.working_hours,
      meeting_type_ids: form.meeting_type_ids,
    };
    setSaving(true);
    try {
      if (editing) await updateExecutive(executive.id, body);
      else await createExecutive({ ...body, user_id: form.user_id });
      toast.success(editing ? 'Executive saved' : 'Executive added');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setErrors(errorList(e, 'Failed to save executive'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${executive.name}` : 'Add executive'}</DialogTitle>
          <DialogDescription>Someone the voice agent can book meetings with. Their connected calendar is checked before every booking.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Team member">
            {editing ? (
              <p className="text-sm mt-1">{executive.name} <span className="text-muted-foreground">· {executive.email}</span></p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">Everyone already has an executive profile.</p>
            ) : (
              <Select value={form.user_id ? String(form.user_id) : undefined} onValueChange={(v) => set({ user_id: Number(v) })}>
                <SelectTrigger className={fieldClass}><SelectValue placeholder="Choose a user" /></SelectTrigger>
                <SelectContent>
                  {available.map((c) => (
                    <SelectItem key={c.user_id} value={String(c.user_id)}>
                      {c.name} · {c.email}{c.calendar_connected ? '' : ' (no calendar)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!editing && chosen && !chosen.calendar_connected && (
              <p className="text-[11px] text-amber-600 mt-1">
                Not bookable until they connect a calendar in Settings.
              </p>
            )}
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Time zone" hint="IANA name, e.g. Asia/Kolkata. Blank = company default.">
              <Input value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} placeholder="Asia/Kolkata" className={fieldClass} />
            </Field>
            <NumberField label="Meetings per day" hint="Blank = no limit." min={1} max={50} value={form.daily_meeting_limit}
              onChange={(v) => set({ daily_meeting_limit: v })} />
            <Field label="Active">
              <div className="flex items-center gap-2 mt-2.5">
                <Switch checked={form.active} onCheckedChange={(v) => set({ active: v })} />
                <span className="text-xs text-muted-foreground">Takes new meetings</span>
              </div>
            </Field>
          </div>
          <Field label="Working hours" hint="In the executive's time zone. Add two rows on one day for a break.">
            <div className="mt-1"><HoursEditor hours={form.working_hours} onChange={(working_hours) => set({ working_hours })} /></div>
          </Field>
          <Field label="Meeting types">
            {meetingTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">Create a meeting type first.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-3">
                {meetingTypes.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.meeting_type_ids.includes(m.id)} onCheckedChange={(v) => toggleType(m.id, Boolean(v))} />
                    {m.name}{!m.active && <span className="text-[11px] text-muted-foreground">(inactive)</span>}
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Errors errors={errors} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || (!editing && !form.user_id)} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {editing ? 'Save changes' : 'Add executive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tenant Admin (Managers view): meeting types and executives behind the appointment tools. */
export default function SchedulingSetup({ canEdit }) {
  const [meetingTypes, setMeetingTypes] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [typeDialog, setTypeDialog] = useState({ open: false, item: null });
  const [executiveDialog, setExecutiveDialog] = useState({ open: false, item: null });

  const load = useCallback(async () => {
    try {
      const [types, execs, people] = await Promise.all([listMeetingTypes(true), listExecutives(), listExecutiveCandidates()]);
      setMeetingTypes(types.data);
      setExecutives(execs.data);
      setCandidates(people.data);
    } catch (e) {
      toast.error(errorList(e, 'Failed to load scheduling setup')[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const typeNames = (ids) => meetingTypes.filter((m) => ids.includes(m.id)).map((m) => m.name).join(', ') || 'No meeting types';

  const seed = async () => {
    setBusy('seed');
    try {
      const res = await seedScheduling();
      toast.success(`Defaults added: ${res.data.meeting_type_created ? 'demo meeting type, ' : ''}${res.data.executives_created} executive(s)`);
      await load();
    } catch (e) {
      toast.error(errorList(e, 'Failed to add defaults')[0]);
    } finally {
      setBusy(null);
    }
  };

  const deactivate = async (kind, item) => {
    if (!window.confirm(`Deactivate "${item.name}"? Meetings already booked are kept.`)) return;
    setBusy(item.id);
    try {
      if (kind === 'type') await deactivateMeetingType(item.id);
      else await deactivateExecutive(item.id);
      toast.success('Deactivated');
      await load();
    } catch (e) {
      toast.error(errorList(e, 'Failed to deactivate')[0]);
    } finally {
      setBusy(null);
    }
  };

  const bookable = executives.filter((e) => e.active && e.calendar_connected && e.meeting_type_ids.length).length;

  return (
    <Card className="card-base p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Meeting scheduling</h2>
          <p className="text-xs text-muted-foreground mt-1">
            What your voice agents can book and with whom. Used by the appointment tools (check availability, book, reschedule, cancel).
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={seed} disabled={busy === 'seed'} className="shrink-0"
            title="Adds a 30-minute demo type and an executive for each user with a connected calendar. Changes nothing that exists.">
            {busy === 'seed' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Add defaults
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {!bookable && (
            <p className="text-xs text-amber-600 flex gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              No executive can take meetings yet: each needs to be active, have a connected calendar and at least one meeting type.
            </p>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting types</h3>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setTypeDialog({ open: true, item: null })}>
                  <Plus className="w-4 h-4 mr-1" /> New meeting type
                </Button>
              )}
            </div>
            {meetingTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-5 text-center">No meeting types yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {meetingTypes.map((m) => (
                  <div key={m.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{m.name}</span>
                        <Badge variant="secondary" className="font-mono text-[11px]">{m.key}</Badge>
                        {!m.active && <Badge variant="outline" className="text-[11px]">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.duration_minutes} min · {m.buffer_minutes} min buffer · {m.slots_offered} times offered · up to {m.booking_window_days} days ahead
                        · {methodLabel(m.assignment_method)}{m.fallback_method ? `, then ${methodLabel(m.fallback_method).toLowerCase()}` : ''}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => setTypeDialog({ open: true, item: m })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {m.active && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Deactivate" disabled={busy === m.id}
                            onClick={() => deactivate('type', m)}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Executives
              </h3>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setExecutiveDialog({ open: true, item: null })}
                  disabled={!candidates.some((c) => !c.executive_id)}>
                  <Plus className="w-4 h-4 mr-1" /> Add executive
                </Button>
              )}
            </div>
            {executives.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-5 text-center">No executives yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {executives.map((e) => (
                  <div key={e.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.email}</span>
                        {e.calendar_connected ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 text-[11px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Calendar connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/25 text-[11px]">No calendar</Badge>
                        )}
                        {!e.active && <Badge variant="outline" className="text-[11px]">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hoursSummary(e.working_hours)} ({e.timezone}){e.daily_meeting_limit ? ` · max ${e.daily_meeting_limit}/day` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{typeNames(e.meeting_type_ids)}</p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => setExecutiveDialog({ open: true, item: e })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {e.active && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Deactivate" disabled={busy === e.id}
                            onClick={() => deactivate('executive', e)}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <MeetingTypeDialog open={typeDialog.open} meetingType={typeDialog.item} onSaved={load}
        onOpenChange={(open) => setTypeDialog((s) => ({ ...s, open }))} />
      <ExecutiveDialog open={executiveDialog.open} executive={executiveDialog.item} meetingTypes={meetingTypes}
        candidates={candidates} onSaved={load} onOpenChange={(open) => setExecutiveDialog((s) => ({ ...s, open }))} />
    </Card>
  );
}
