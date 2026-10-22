import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, RotateCw } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  campaignContactAction, cancelVoiceCampaign, closeVoiceCampaign, getVoiceCampaign, getVoiceCampaignContacts,
  getVoiceCampaignEvents, pauseVoiceCampaign, resumeVoiceCampaign, startVoiceCampaign,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canManageCampaigns, canOperate } from '@/lib/rbac';
import { formatDateTime } from '@/lib/ops';
import { formatDuration } from '@/lib/voiceDashboard';
import { callStatusMeta } from '@/lib/callOutcome';
import { campaignBanner, insideWindow } from '@/lib/campaignView';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import StatusBadge, { CAMPAIGN_TONES } from '@/components/ops/StatusBadge';
import EventTimeline, { campaignEventItems } from '@/components/ops/EventTimeline';
import ReasonDialog from '@/components/ops/ReasonDialog';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import OpsButton from '@/components/ops/OpsButton';
import { EmptyState, ErrorState, ScrollTable, Skeleton, SkeletonRows } from '@/components/ops/States';
import { describeConfig, describeRetryDelays, describeWindow, isoToZoned, zonedToIso } from './CampaignSettingsFields';
import CampaignEditDialog from './CampaignEditDialog';
import CallLogDetail from './CallLogDetail';
import { IdChip } from './VoiceCampaigns';

const REFRESH_MS = 30000;
const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'contacts', label: 'Contacts' }, { id: 'activity', label: 'Activity' }];
const FINAL = ['completed', 'cancelled', 'failed'];

// Campaign buttons by allowed_actions (the backend decides; these only label them).
export const CAMPAIGN_ACTIONS = {
  start: { label: 'Start now' },
  schedule: { label: 'Schedule' },
  reschedule: { label: 'Reschedule' },
  pause: { label: 'Pause' },
  resume: { label: 'Resume' },
  close: { label: 'Close campaign', operator: true },
  cancel: { label: 'Cancel', danger: true },
};

// Contact row actions (row.actions carries enabled / reason for each).
export const CONTACT_ACTIONS = {
  requeue: { label: 'Requeue', path: 'requeue', success: 'Contact requeued' },
  dial_now: { label: 'Dial now', path: 'dial-now', success: 'It will be dialled at the next runner tick' },
  next_attempt: { label: 'Change next attempt', path: 'next-attempt', success: 'Next attempt changed' },
  attempts: { label: 'Reset attempts / change max', path: 'attempts', success: 'Attempts updated' },
  remove: { label: 'Remove', path: 'remove', success: 'Contact removed', danger: true },
};

/** The row menu's items for a role: nothing for those who cannot override; disabled ones say why. */
export function contactMenuItems(row, user) {
  if (!canOperate(user)) return [];
  return (row.actions || []).filter((a) => CONTACT_ACTIONS[a.action])
    .map((a) => ({ ...a, label: CONTACT_ACTIONS[a.action].label }));
}

function DateTimeFields({ date, time, setDate, setTime, zone }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">Date
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">Time ({zone})
        <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
      </label>
    </div>
  );
}

function CampaignActionDialog({ action, campaign, onClose, onDone }) {
  const zone = campaign.timezone || 'Asia/Kolkata';
  const start = isoToZoned(campaign.scheduled_at, zone);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [toppedUp, setToppedUp] = useState(false);
  const version = { expected_version: campaign.version };
  const systemPause = campaign.status === 'paused' && campaign.paused_by_kind !== 'user';
  const credits = campaign.pause_reason_code === 'vapi_credits';
  const request = useCallback((reason) => {
    switch (action) {
      case 'start': return startVoiceCampaign(campaign.id, null, version);
      case 'schedule':
      case 'reschedule': return startVoiceCampaign(campaign.id, zonedToIso(date, time, zone), { ...version, ...(reason ? { reason } : {}) });
      case 'pause': return pauseVoiceCampaign(campaign.id, { ...version, reason });
      case 'resume': return resumeVoiceCampaign(campaign.id, { ...version, ...(reason ? { reason } : {}), credits_topped_up: toppedUp });
      case 'cancel': return cancelVoiceCampaign(campaign.id, { ...version, reason });
      case 'close': return closeVoiceCampaign(campaign.id, reason);
      default: return Promise.reject(new Error('unknown action'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, campaign, date, time, zone, toppedUp]);
  const { run } = useApiAction(request, { success: 'Done', onSuccess: onDone, onConflict: onDone });
  const confirm = async (reason) => Boolean(await run(reason));
  const close = (open) => { if (!open) onClose(); };
  const name = campaign.name;

  if (action === 'start' || (action === 'resume' && !systemPause)) {
    return (
      <ConfirmDialog open onOpenChange={close} title={action === 'start' ? `Start ${name} now?` : `Resume ${name}?`}
        description={action === 'start' ? 'Dialling begins inside its calling hours.' : 'Dialling continues where it stopped.'}
        confirmLabel={CAMPAIGN_ACTIONS[action].label} onConfirm={() => confirm(null)} />
    );
  }
  const config = {
    schedule: { title: `Schedule ${name}`, changes: ['The campaign starts at the chosen time (inside its calling hours).'], requireReason: false },
    reschedule: { title: `Reschedule ${name}`, changes: ['The missed campaign is scheduled for the new time.'] },
    pause: { title: `Pause ${name}`, changes: ['No new calls are placed; calls in progress finish. It stays paused until someone resumes it.'] },
    resume: { title: `Resume ${name}`, changes: ['Dialling continues; pre-flight checks run first.'] },
    cancel: { title: `Cancel ${name}`, changes: ['No more calls are placed; calls in progress finish. This cannot be undone.'], danger: true },
    close: { title: `Close ${name}`, changes: ['The campaign is marked completed; contacts still waiting are skipped.'] },
  }[action];
  return (
    <ReasonDialog open onOpenChange={close} title={config.title} changes={config.changes} danger={config.danger}
      confirmLabel={CAMPAIGN_ACTIONS[action].label} requireReason={config.requireReason !== false}
      canConfirm={(action !== 'schedule' && action !== 'reschedule') || Boolean(date && time)}
      onConfirm={confirm}>
      {(action === 'schedule' || action === 'reschedule') && (
        <DateTimeFields date={date} time={time} setDate={setDate} setTime={setTime} zone={zone} />
      )}
      {action === 'resume' && credits && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={toppedUp} onChange={(e) => setToppedUp(e.target.checked)} />
          I've topped up credits
        </label>
      )}
      {action === 'resume' && credits && !toppedUp && (
        <p className="text-xs text-muted-foreground">Vapi shows no balance; the first call checks the top-up for real.</p>
      )}
    </ReasonDialog>
  );
}

function ContactActionDialog({ action, contact, campaign, onClose, onDone }) {
  const meta = CONTACT_ACTIONS[action];
  const zone = campaign.timezone || 'Asia/Kolkata';
  const initial = isoToZoned(contact.next_attempt_at || new Date().toISOString(), zone);
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [reset, setReset] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(contact.max_attempts || '');
  const request = useCallback((reason) => {
    const body = { reason };
    if (action === 'requeue' && phone.trim()) body.phone_number = phone.trim();
    if (action === 'next_attempt') body.next_attempt_at = zonedToIso(date, time, zone);
    if (action === 'attempts') {
      body.reset = reset;
      if (maxAttempts !== '') body.max_attempts = Number(maxAttempts);
    }
    return campaignContactAction(campaign.id, contact.contact_id, meta.path, body);
  }, [action, campaign, contact, meta, phone, date, time, zone, reset, maxAttempts]);
  const { run } = useApiAction(request, { success: meta.success, onSuccess: onDone, onConflict: onDone });
  const inHours = insideWindow(campaign.calling_window, date, time);
  const attemptsValid = action !== 'attempts' || reset || (maxAttempts !== '' && Number(maxAttempts) >= 1 && Number(maxAttempts) <= 10);
  const changes = {
    requeue: ['The contact goes back to the queue (the normal rules apply).'],
    dial_now: ['The contact is dialled at the next runner tick, skipping the timing rules once. Never do-not-call or the outer bound.'],
    next_attempt: ['The next call to this contact happens at the new time.'],
    attempts: [reset ? 'The attempt count goes back to 0.' : 'The attempt count stays.', maxAttempts !== '' ? `This contact may be tried up to ${maxAttempts} times.` : 'The campaign\'s attempt limit applies.'],
    remove: ['The contact is never called by this campaign.'],
  }[action];
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }} title={`${meta.label}: ${contact.name || contact.phone_number}`}
      changes={changes} confirmLabel={meta.label} danger={meta.danger}
      canConfirm={(action !== 'next_attempt' || inHours) && attemptsValid}
      onConfirm={async (reason) => Boolean(await run(reason))}>
      {action === 'requeue' && (
        <label className="flex flex-col gap-1 text-sm font-medium">Corrected phone number (optional)
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={contact.phone_number}
            className="h-9 rounded-lg border border-border bg-background px-3" />
        </label>
      )}
      {action === 'next_attempt' && (
        <>
          <DateTimeFields date={date} time={time} setDate={setDate} setTime={setTime} zone={zone} />
          <p className={`text-xs ${inHours ? 'text-muted-foreground' : 'text-[color:var(--ops-bad)] font-semibold'}`}>
            Calling hours: {describeWindow(campaign.calling_window)}{inHours ? '' : ' — pick a time inside them.'}
          </p>
        </>
      )}
      {action === 'attempts' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} /> Reset the attempt count
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Max attempts for this contact (1–10, optional)
            <input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)}
              className="h-9 w-32 rounded-lg border border-border bg-background px-3" />
          </label>
        </div>
      )}
    </ReasonDialog>
  );
}

function RowMenu({ row, user, onPick }) {
  const items = contactMenuItems(row, user);
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${row.name || row.phone_number}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))]">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="ops w-72">
        {items.map((item) => (
          <DropdownMenuItem key={item.action} disabled={!item.enabled} onSelect={() => item.enabled && onPick(item.action)}
            title={item.reason || undefined} className="flex-col items-start gap-0.5">
            <span>{item.label}</span>
            {!item.enabled && item.reason && <span className="text-xs text-muted-foreground">{item.reason}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SORTS = {
  queue: { label: 'Queue order', fn: () => 0 },
  next: { label: 'Next allowed time', fn: (a, b) => String(a.next_attempt_at || '~').localeCompare(String(b.next_attempt_at || '~')) },
  attempts: { label: 'Most attempts', fn: (a, b) => (b.attempts || 0) - (a.attempts || 0) },
  score: { label: 'Lead score', fn: (a, b) => (b.lead_score ?? -1) - (a.lead_score ?? -1) },
  name: { label: 'Name', fn: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
};

function ContactsTab({ campaign, contacts, user, onChanged, onOpenCall }) {
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('queue');
  const [acting, setActing] = useState(null);
  const statuses = useMemo(() => [...new Map(contacts.map((c) => [c.status, c.status_label])).entries()], [contacts]);
  const rows = useMemo(() => {
    const list = contacts.filter((c) => status === 'all' || c.status === status);
    return sort === 'queue' ? list : [...list].sort(SORTS[sort].fn);
  }, [contacts, status, sort]);
  const operator = canOperate(user);
  const zone = campaign.timezone || 'Asia/Kolkata';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-border bg-card px-3 text-sm">
            <option value="all">All ({contacts.length})</option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>{label} ({contacts.filter((c) => c.status === value).length})</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-border bg-card px-3 text-sm">
            {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 ? <EmptyState title="No contacts with this status." /> : (
        <ScrollTable label="Contacts">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lead</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Next allowed</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Lead score</th><th className="px-3 py-2">Last outcome</th>
              {operator && <th className="px-3 py-2"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.contact_id} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2.5">
                  <span className="font-medium">{c.name || '—'}</span>
                  <span className="ops-num block text-xs text-muted-foreground">{c.phone_number}</span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge label={c.status_label} tone={c.on_do_not_call ? 'bad' : 'neutral'} /></td>
                <td className="max-w-[220px] px-3 py-2.5 text-muted-foreground">{c.reason_display || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {c.next_attempt_at ? <span title={formatDateTime(c.next_attempt_at, zone)}><RelativeTime iso={c.next_attempt_at} /></span> : '—'}
                </td>
                <td className="ops-num px-3 py-2.5">{c.attempts ?? 0}{c.max_attempts ? ` / ${c.max_attempts}` : ''}</td>
                <td className="ops-num px-3 py-2.5">{formatDuration(c.duration_seconds)}</td>
                <td className="ops-num px-3 py-2.5">{c.lead_score ?? '—'}</td>
                <td className="px-3 py-2.5">
                  {c.last_outcome ? callStatusMeta(c.last_outcome).label : '—'}
                  {c.call_id && (
                    <button type="button" onClick={() => onOpenCall(c.call_id)} className="block text-xs font-semibold text-[color:var(--ops-accent-ink)] underline">
                      View call
                    </button>
                  )}
                </td>
                {operator && <td className="px-3 py-2.5 text-right"><RowMenu row={c} user={user} onPick={(a) => setActing({ action: a, contact: c })} /></td>}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
      {acting && <ContactActionDialog action={acting.action} contact={acting.contact} campaign={campaign}
        onClose={() => setActing(null)} onDone={onChanged} />}
    </div>
  );
}

function Overview({ campaign, contacts, onEditRules, canEditRules }) {
  const stats = useMemo(() => [...contacts.reduce((m, c) => m.set(c.status_label, (m.get(c.status_label) || 0) + 1), new Map())],
    [contacts]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="ops-card space-y-3 p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold">About this campaign</h2>
        <p className="text-sm">{campaign.description || '—'}</p>
        {campaign.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{campaign.notes}</p>}
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Calling hours</dt><dd>{describeWindow(campaign.calling_window)} ({campaign.timezone})</dd>
          <dt className="text-muted-foreground">Calling rules</dt><dd>{describeConfig(campaign.calling_config)}</dd>
          <dt className="text-muted-foreground">Retry delays</dt><dd>{describeRetryDelays(campaign.calling_config)}</dd>
          <dt className="text-muted-foreground">Leads</dt><dd className="ops-num">{campaign.total_leads}</dd>
          <dt className="text-muted-foreground">Created by</dt><dd>{campaign.created_by_user?.name || '—'}</dd>
        </dl>
        {canEditRules && (
          <div className="flex flex-wrap items-center gap-3">
            <OpsButton size="sm" onClick={onEditRules}>Edit rules</OpsButton>
            <span className="text-xs text-muted-foreground">Applies to future dials only.</span>
          </div>
        )}
      </section>
      <section className="ops-card p-4" aria-labelledby="campaign-stats">
        <h2 id="campaign-stats" className="mb-3 text-sm font-semibold">Contacts</h2>
        {stats.length === 0 ? <p className="text-sm text-muted-foreground">No contacts yet.</p> : (
          <dl className="grid grid-cols-2 gap-3">
            {stats.map(([label, n]) => (
              <div key={label} className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="ops-num text-xl font-semibold">{n}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

export default function VoiceCampaignDetail() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [callId, setCallId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, k, e] = await Promise.all([
        getVoiceCampaign(campaignId), getVoiceCampaignContacts(campaignId), getVoiceCampaignEvents(campaignId),
      ]);
      setCampaign(c.data);
      setContacts(k.data.contacts || []);
      setEvents(e.data || []);
      setError(null);
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 404 ? 'This campaign does not exist or is not yours to see.'
        : status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [campaignId]);
  const refresh = usePolling(load, REFRESH_MS, [load]);

  if (callId) return <div className="p-4"><CallLogDetail callId={callId} onBack={() => setCallId(null)} /></div>;
  const zone = campaign?.timezone || 'Asia/Kolkata';
  const banner = campaignBanner(campaign, zone);
  const operator = canOperate(user);
  // A Super Admin reads campaigns but cannot run or edit them (the backend answers 403).
  const manager = canManageCampaigns(user);
  const actions = (campaign?.allowed_actions || []).filter((a) => manager && CAMPAIGN_ACTIONS[a] && (!CAMPAIGN_ACTIONS[a].operator || operator)
    && !(a === 'resume' && campaign.paused_by_kind === 'system' && !operator));
  const bannerActions = { missed: ['start', 'reschedule'], waiting: ['close'], credits: ['resume'], system_pause: ['resume'] }[banner?.kind] || [];

  return (
    <div className="ops mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <button type="button" onClick={() => navigate('/voice-campaigns')} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All campaigns
      </button>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !campaign && <div className="space-y-3"><Skeleton className="h-24" /><SkeletonRows rows={4} /></div>}
      {campaign && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
                <StatusBadge label={campaign.display_label || campaign.status_label} tone={CAMPAIGN_TONES[campaign.status]} />
              </div>
              <p className="text-sm text-muted-foreground">
                {campaign.scheduled_at ? <>Scheduled for {formatDateTime(campaign.scheduled_at, zone)}</>
                  : campaign.started_at ? <>Started {formatDateTime(campaign.started_at, zone)}</> : 'Not scheduled'}
                {' · '}Assistant: {campaign.assistant?.name || '—'}
              </p>
              <IdChip id={campaign.id} label="campaign id" full />
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <OpsButton key={a} size="sm" variant={a === 'start' || a === 'resume' ? 'primary' : CAMPAIGN_ACTIONS[a].danger ? 'quiet' : 'outline'}
                  onClick={() => setAction(a)}>{CAMPAIGN_ACTIONS[a].label}</OpsButton>
              ))}
              {manager && <OpsButton size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit</OpsButton>}
              <OpsButton size="sm" variant="quiet" onClick={refresh} aria-label="Refresh the campaign"><RotateCw className="h-4 w-4" aria-hidden="true" /></OpsButton>
            </div>
          </header>

          {banner && (
            <div role="status" className={`ops-tone ops-tone-${banner.tone} flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-sm`}>
              <span className="flex-1 font-semibold">{banner.text}</span>
              {bannerActions.filter((a) => actions.includes(a)).map((a) => (
                <OpsButton key={a} size="sm" variant="outline" onClick={() => setAction(a)}>{CAMPAIGN_ACTIONS[a].label}</OpsButton>
              ))}
            </div>
          )}

          <div role="tablist" aria-label="Campaign" className="flex flex-wrap gap-1 border-b border-border">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.label}{t.id === 'contacts' ? ` (${contacts.length})` : ''}
              </button>
            ))}
          </div>

          {tab === 'overview' && <Overview campaign={campaign} contacts={contacts} onEditRules={() => setEditOpen(true)}
            canEditRules={manager && !FINAL.includes(campaign.status) && ['processing', 'paused'].includes(campaign.status)} />}
          {tab === 'contacts' && <ContactsTab campaign={campaign} contacts={contacts} user={user} onChanged={load} onOpenCall={setCallId} />}
          {tab === 'activity' && <div className="ops-card p-4"><EventTimeline items={campaignEventItems(events)} /></div>}

          {action && <CampaignActionDialog action={action} campaign={campaign} onClose={() => setAction(null)} onDone={load} />}
          <CampaignEditDialog campaign={campaign} open={editOpen} onOpenChange={setEditOpen} onSaved={() => load()} />
        </>
      )}
    </div>
  );
}
