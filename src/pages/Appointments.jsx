import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  appointmentAction, getAppointment, getAppointments, getAssistants, getProspects, getVoiceCampaigns, relinkAppointment,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canViewAssistants } from '@/lib/rbac';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import useDisplayZone from '@/hooks/useDisplayZone';
import { formatDateTime } from '@/lib/ops';
import { isoToZoned, zonedToIso } from '@/components/voice/CampaignSettingsFields';
import StatusBadge, { APPOINTMENT_TONES } from '@/components/ops/StatusBadge';
import EventTimeline, { appointmentEventItems } from '@/components/ops/EventTimeline';
import ReasonDialog from '@/components/ops/ReasonDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import OpsButton from '@/components/ops/OpsButton';
import { EmptyState, ErrorState, ScrollTable, SkeletonRows } from '@/components/ops/States';

export const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'rescheduled', label: 'Rescheduled' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'past', label: 'Past' },
  { id: 'needs_outcome', label: 'Needs outcome' },
];
const PAGE_SIZE = 25;
const REFRESH_MS = 30000;

// Buttons for allowed_actions (the backend decides which apply; the role is checked there too).
export const ACTION_META = {
  complete: { label: 'Mark completed', path: 'complete', title: 'Mark this meeting completed', success: 'Marked completed' },
  no_show: { label: 'No-show', path: 'no-show', title: 'Mark this meeting as a no-show', success: 'Marked as a no-show' },
  reschedule: { label: 'Reschedule', path: 'reschedule', title: 'Move this meeting', success: 'Meeting moved' },
  cancel: { label: 'Cancel', path: 'cancel', title: 'Cancel this meeting', success: 'Meeting cancelled', danger: true },
  restore: { label: 'Restore', path: 'restore', title: 'Undo this cancellation', success: 'Meeting restored' },
  relink: { label: 'Change link', title: 'Change the lead or campaign', success: 'Link changed' },
};

const leadName = (a) => a.prospect?.name || a.attendee?.name || a.attendee?.email || '—';
const sourceText = (a) => a.campaign?.name || (a.source_vapi_call_id ? 'Agent call' : '—');

function Filters({ filters, onChange, assistants, campaigns }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  const field = 'h-9 rounded-lg border border-border bg-card px-3 text-sm';
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Search
        <input type="search" value={filters.q} onChange={set('q')} placeholder="Lead, email or phone" className={`${field} w-56`} />
      </label>
      {assistants && (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Agent
          <select value={filters.agent} onChange={set('agent')} className={field}>
            <option value="">All agents</option>
            {assistants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Campaign
        <select value={filters.campaign} onChange={set('campaign')} className={field}>
          <option value="">All campaigns</option>
          {(campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <input type="date" value={filters.from} onChange={set('from')} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <input type="date" value={filters.to} onChange={set('to')} className={field} />
      </label>
    </div>
  );
}

/** The dialog for one action on one appointment; reschedule adds a time, relink adds the new links. */
function ActionDialog({ action, appointment, zone, onClose, onDone }) {
  const meta = ACTION_META[action];
  const start = isoToZoned(appointment?.start, zone);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [campaignId, setCampaignId] = useState(appointment?.campaign?.id || '');
  const [campaigns, setCampaigns] = useState(null);
  const [prospectQuery, setProspectQuery] = useState('');
  const [prospects, setProspects] = useState([]);
  const [prospectId, setProspectId] = useState(appointment?.prospect?.id || '');
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (action !== 'relink') return;
    getVoiceCampaigns().then((r) => setCampaigns(r.data.campaigns)).catch(() => setCampaigns([]));
  }, [action]);
  useEffect(() => {
    if (action !== 'relink' || prospectQuery.trim().length < 2) { setProspects([]); return undefined; }
    const timer = setTimeout(() => {
      getProspects({ search: prospectQuery.trim(), limit: 10 }).then((r) => setProspects(r.data.prospects || []))
        .catch(() => setProspects([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [action, prospectQuery]);

  const request = useCallback((reason) => {
    const base = { reason, expected_version: appointment.version };
    if (action === 'reschedule') return appointmentAction(appointment.id, 'reschedule', { ...base, start_at: zonedToIso(date, time, zone) });
    if (action === 'relink') {
      const body = { ...base };
      if ((appointment.campaign?.id || '') !== campaignId) body.campaign_id = campaignId || null;
      if ((appointment.prospect?.id || '') !== prospectId) body.prospect_id = prospectId || null;
      return relinkAppointment(appointment.id, body);
    }
    return appointmentAction(appointment.id, meta.path, base);
  }, [action, appointment, meta, date, time, zone, campaignId, prospectId]);

  const { run } = useApiAction(request, {
    success: meta?.success,
    onSuccess: onDone,
    onConflict: (error) => { setConflict(error?.response?.data?.detail?.conflict || null); onDone?.(); },
  });

  if (!meta || !appointment) return null;
  const when = formatDateTime(appointment.start, zone);
  const changes = {
    cancel: [`The ${when} meeting is cancelled in the executive's calendar; the lead gets a cancellation.`],
    reschedule: [`Moves the meeting from ${when} to ${date && time ? formatDateTime(zonedToIso(date, time, zone), zone) : '…'}.`,
      'The calendar invite is updated.'],
    restore: [`The ${when} meeting is booked again (the calendar event is kept or re-created).`],
    complete: ['The meeting is recorded as completed.'],
    no_show: ['The meeting is recorded as a no-show.'],
    relink: ['The meeting is moved to the chosen lead and/or campaign.'],
  }[action];
  const relinkChanged = action !== 'relink' || (appointment.campaign?.id || '') !== campaignId
    || (appointment.prospect?.id || '') !== prospectId;

  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }} title={meta.title} changes={changes}
      confirmLabel={meta.label} danger={meta.danger} canConfirm={relinkChanged && (action !== 'reschedule' || (date && time))}
      onConfirm={async (reason) => Boolean(await run(reason))}>
      {action === 'reschedule' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">New date
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Time ({zone})
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
        </div>
      )}
      {action === 'relink' && (
        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-sm font-medium">Campaign
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2">
              <option value="">No campaign</option>
              {(campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Lead
            <input type="search" value={prospectQuery} onChange={(e) => setProspectQuery(e.target.value)}
              placeholder={appointment.prospect?.name || 'Search leads by name'} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
          {prospects.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-border">
              {prospects.map((p) => (
                <li key={p.prospect_id}>
                  <button type="button" onClick={() => { setProspectId(p.prospect_id); setProspectQuery(p.full_name || ''); setProspects([]); }}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[hsl(var(--surface-2))] ${prospectId === p.prospect_id ? 'font-semibold' : ''}`}>
                    {p.full_name || p.email || p.phone}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {conflict && (
        <p role="alert" className="rounded-lg border px-3 py-2 text-sm ops-tone ops-tone-bad">
          That slot is taken by the meeting at {conflict.label}.{' '}
          <Link to={`/operations/appointments?open=${conflict.appointment_id}`} className="font-semibold underline">Open it</Link>
        </p>
      )}
    </ReasonDialog>
  );
}

function AppointmentDrawer({ id, onClose, onChanged, zone }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getAppointment(id);
      setDetail(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 404 ? 'This appointment is not available to you.' : errorMessage(err));
    }
  }, [id]);
  useEffect(() => { setDetail(null); load(); }, [load]);

  const done = async () => { await load(); onChanged?.(); };
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="ops w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{detail ? leadName(detail) : 'Appointment'}</SheetTitle>
          <SheetDescription>{detail ? formatDateTime(detail.start, zone) : 'Loading…'}</SheetDescription>
        </SheetHeader>
        {error && <div className="mt-4"><ErrorState message={error} onRetry={load} /></div>}
        {!error && !detail && <div className="mt-4"><SkeletonRows rows={4} /></div>}
        {detail && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={detail.status_label} tone={APPOINTMENT_TONES[detail.status]} />
              {detail.late_cancel && <StatusBadge label="Late cancellation" tone="warn" />}
              {detail.needs_outcome && <StatusBadge label="Needs outcome" tone="warn" />}
            </div>
            {detail.cancel_reason_display && (
              <p className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">{detail.cancel_reason_display}</p>
            )}
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Executive</dt><dd>{detail.executive?.name || '—'}</dd>
              <dt className="text-muted-foreground">Meeting</dt><dd>{detail.meeting_type || '—'}</dd>
              <dt className="text-muted-foreground">Attendee</dt><dd>{[detail.attendee?.email, detail.attendee?.phone].filter(Boolean).join(' · ') || '—'}</dd>
              <dt className="text-muted-foreground">Lead</dt>
              <dd>{detail.prospect ? <Link className="font-medium text-[color:var(--ops-accent-ink)] underline" to={`/leads?prospect=${detail.prospect.id}`}>{detail.prospect.name || 'Open lead'}</Link> : '—'}</dd>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd>{detail.campaign ? <Link className="font-medium text-[color:var(--ops-accent-ink)] underline" to={`/voice-campaigns/${detail.campaign.id}`}>{detail.campaign.name || 'Open campaign'}</Link> : '—'}</dd>
              <dt className="text-muted-foreground">Call</dt>
              <dd>{detail.source_vapi_call_id ? <Link className="font-medium text-[color:var(--ops-accent-ink)] underline" to="/voice_agent?tab=logs">Open the call log</Link> : '—'}</dd>
            </dl>
            {detail.allowed_actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.allowed_actions.map((a) => ACTION_META[a] && (
                  <OpsButton key={a} size="sm" variant={ACTION_META[a].danger ? 'quiet' : 'outline'} onClick={() => setAction(a)}>
                    {ACTION_META[a].label}
                  </OpsButton>
                ))}
              </div>
            )}
            <section aria-labelledby="appointment-history">
              <h3 id="appointment-history" className="mb-2 text-sm font-semibold">History</h3>
              <EventTimeline items={appointmentEventItems(detail.events, zone)} />
            </section>
          </div>
        )}
        {action && detail && (
          <ActionDialog action={action} appointment={detail} zone={zone} onClose={() => setAction(null)} onDone={done} />
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const zone = useDisplayZone();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'upcoming';
  const openId = params.get('open');
  const [filters, setFilters] = useState({ q: '', agent: '', campaign: '', from: '', to: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [assistants, setAssistants] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  // Typing in the search waits 300 ms before it asks the server.
  useEffect(() => { const t = setTimeout(() => { setQuery(filters); setPage(1); }, 300); return () => clearTimeout(t); }, [filters]);
  useEffect(() => {
    if (canViewAssistants(user)) getAssistants().then((r) => setAssistants(r.data)).catch(() => setAssistants(null));
    getVoiceCampaigns().then((r) => setCampaigns(r.data.campaigns)).catch(() => setCampaigns([]));
  }, [user]);

  const load = useCallback(async () => {
    const request = { tab, page, page_size: PAGE_SIZE };
    if (query.q.trim()) request.q = query.q.trim();
    if (query.agent) request.agent = query.agent;
    if (query.campaign) request.campaign = query.campaign;
    if (query.from) request.from = zonedToIso(query.from, '00:00', zone);
    if (query.to) request.to = zonedToIso(query.to, '23:59', zone);
    try {
      const res = await getAppointments(request);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [tab, page, query, zone]);
  const refresh = usePolling(load, REFRESH_MS, [load]);

  const setTab = (id) => { setPage(1); setData(null); setParams((p) => { const next = new URLSearchParams(p); next.set('tab', id); next.delete('open'); return next; }); };
  const openRow = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('open', id); return next; });
  const closeRow = () => setParams((p) => { const next = new URLSearchParams(p); next.delete('open'); return next; });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const showReason = tab === 'cancelled';
  const counts = data?.counts || {};

  const rows = useMemo(() => data?.items || [], [data]);
  return (
    <div className="ops mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">Meetings booked by your agents, with their full history. Times in {zone}.</p>
        </div>
        <OpsButton size="sm" variant="outline" onClick={refresh} aria-label="Refresh the appointments">
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </OpsButton>
      </header>

      {data?.calendar?.message && (
        <div role="alert" className="ops-tone ops-tone-bad flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 font-semibold">{data.calendar.message}</span>
          <Link to="/settings/calendar" className="font-semibold underline">Open Settings</Link>
        </div>
      )}

      <div role="tablist" aria-label="Appointments" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label} {counts[t.id] != null && <span className="ops-num rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <Filters filters={filters} onChange={setFilters} assistants={assistants} campaigns={campaigns} />

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <SkeletonRows rows={6} label="Loading appointments" />}
      {!error && data && rows.length === 0 && (
        <EmptyState title="No appointments here." body="Change the tab or the filters to see more." />
      )}
      {!error && rows.length > 0 && (
        <>
          <ScrollTable label="Appointments">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Lead</th>
                <th className="px-4 py-2 font-semibold">Slot</th>
                <th className="px-4 py-2 font-semibold">Executive</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Source</th>
                {showReason && <th className="px-4 py-2 font-semibold">Reason</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-[hsl(var(--surface-2))]">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => openRow(a.id)} className="text-left font-semibold text-[color:var(--ops-accent-ink)] hover:underline">
                      {leadName(a)}
                    </button>
                  </td>
                  <td className="ops-num whitespace-nowrap px-4 py-2.5">
                    <RelativeTime iso={a.start} mode="absolute" />
                  </td>
                  <td className="px-4 py-2.5">{a.executive?.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge label={a.status_label} tone={APPOINTMENT_TONES[a.status]} />
                      {a.late_cancel && <StatusBadge label="Late" tone="warn" />}
                      {a.needs_outcome && <StatusBadge label="Needs outcome" tone="warn" />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{sourceText(a)}</td>
                  {showReason && <td className="px-4 py-2.5 text-muted-foreground">{a.cancel_reason_display}</td>}
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <nav aria-label="Pages" className="flex items-center justify-between text-sm">
            <span className="ops-num text-muted-foreground">{data.total} in this tab · page {page} of {pages}</span>
            <span className="flex gap-2">
              <OpsButton size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</OpsButton>
              <OpsButton size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</OpsButton>
            </span>
          </nav>
        </>
      )}

      {openId && <AppointmentDrawer id={openId} zone={zone} onClose={closeRow} onChanged={load} />}
      {/* Kept for screen readers when the drawer closes. */}
      <span className="sr-only" aria-live="polite">{openId ? 'Appointment details opened' : ''}</span>
    </div>
  );
}
