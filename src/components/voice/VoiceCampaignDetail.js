import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getVoiceCampaign, getVoiceCampaignContacts } from '@/lib/api';
import { useCallLogs } from '@/hooks/useCallLogs';
import CallLogDetail from './CallLogDetail';
import { IdChip } from './VoiceCampaigns';
import {
  ArrowLeft, Loader2, AlertCircle, Megaphone, Clock, Calendar,
  CheckCircle2, XCircle, PhoneCall, ChevronUp, ChevronDown, RefreshCw,
} from 'lucide-react';

// Matches VoiceCampaigns.js — campaigns.status, not inferred.
const ONGOING_STATUSES = ['processing', 'created', 'scheduled', 'running'];
const isOngoing = (status) => ONGOING_STATUSES.includes(String(status || '').toLowerCase());

// One page of campaign rows. The call-log endpoint caps page_size at 100, so
// this is the largest single fetch it allows — aggregates below are computed
// over the rows actually fetched, and the summary says so when there are more.
const PAGE_SIZE = 100;
const POLL_INTERVAL_MS = 15000;

// end_reason values that mean the phone was never actually answered. A row can
// be status "completed" — the call reached a terminal state — and still never
// have connected, so status alone cannot answer "did we talk to them".
const NOT_CONNECTED_REASONS = [
  'customer-did-not-answer',
  'customer-busy',
  'voicemail',
  'no-answer',
  'busy',
  'twilio-failed-to-connect-call',
];

const isNotConnected = (log) => {
  const reason = String(log.end_reason || '').toLowerCase();
  return NOT_CONNECTED_REASONS.some((r) => reason.includes(r));
};

const isFailed = (row) => ['failed', 'error'].includes(String(row.status || '').toLowerCase());
const isInProgress = (row) => ['in-progress', 'initiated', 'ringing', 'queued', 'processing'].includes(String(row.status || '').toLowerCase());

// call_records carries its own verdict: was_answered, and status 'unanswered'
// for a contact that never picked up. Prefer those over inferring from the call
// log's end_reason, and fall back to end_reason for rows that have a log but no
// call_records verdict.
const isNotAnswered = (row) =>
  String(row.status || '').toLowerCase() === 'unanswered'
  || row.was_answered === false
  || isNotConnected(row);

const isConnected = (row) =>
  !isInProgress(row) && !isFailed(row) && !isNotAnswered(row);

function formatDuration(sec) {
  if (sec === null || sec === undefined) return '—';
  const n = Number(sec);
  if (Number.isNaN(n) || n <= 0) return '—';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-[hsl(var(--surface-2))] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function LeadStatusBadge({ status }) {
  const map = {
    hot: 'bg-red-500/15 text-red-400 border-red-500/25',
    warm: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    cold: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  };
  const s = String(status || 'warm').toLowerCase();
  return (
    <Badge variant="outline" className={`${map[s] || map.warm} text-[10px] font-semibold uppercase tracking-wider`}>
      {s}
    </Badge>
  );
}

function OutcomeBadge({ row: log }) {
  if (isInProgress(log)) {
    return (
      <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/25 gap-1 text-[10px]">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> in progress
      </Badge>
    );
  }
  if (isFailed(log)) {
    return (
      <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/25 gap-1 text-[10px]">
        <XCircle className="w-2.5 h-2.5" /> failed
      </Badge>
    );
  }
  if (isNotAnswered(log)) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 text-[10px]">
        <XCircle className="w-2.5 h-2.5" /> {log.status || 'unanswered'}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 gap-1 text-[10px]">
      <CheckCircle2 className="w-2.5 h-2.5" /> connected
    </Badge>
  );
}

const SORTS = {
  latest: { label: 'Newest first', fn: (a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0) },
  oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0) },
  duration: { label: 'Longest call', fn: (a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0) },
  name: { label: 'Name A–Z', fn: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
};

export default function VoiceCampaignDetail() {
  const { campaignId } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [campaignError, setCampaignError] = useState(null);
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('latest');
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState(null);

  const fetchContacts = useCallback(async () => {
    try {
      setContactsError(null);
      const res = await getVoiceCampaignContacts(campaignId);
      const data = res.data || res;
      setContacts(data.contacts || []);
    } catch (err) {
      if (err?.response?.status !== 404) {
        setContactsError(err?.response?.data?.detail || 'Failed to load contacts');
      }
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [campaignId]);

  const fetchCampaign = useCallback(async () => {
    try {
      setCampaignError(null);
      const res = await getVoiceCampaign(campaignId);
      setCampaign(res.data || res);
    } catch (err) {
      setCampaignError(
        err?.response?.status === 404
          ? 'notfound'
          : (err?.response?.data?.detail || 'Failed to load campaign')
      );
      setCampaign(null);
    } finally {
      setLoadingCampaign(false);
    }
  }, [campaignId]);

  useEffect(() => { setLoadingCampaign(true); fetchCampaign(); }, [fetchCampaign]);
  useEffect(() => { setLoadingContacts(true); fetchContacts(); }, [fetchContacts]);

  const ongoing = isOngoing(campaign?.status);

  // Always scoped to this campaign. campaignId is required by the route, so
  // there is no path where this hook runs without one and pulls the global feed.
  const { logs, total, loading: loadingLogs, error: logsError, refresh } = useCallLogs({
    page: 1,
    pageSize: PAGE_SIZE,
    campaignId,
    sortBy: 'latest',
    autoRefresh: ongoing,
    refreshInterval: POLL_INTERVAL_MS,
  });

  // Poll the campaign row itself alongside the logs, so status flipping to
  // "completed" ends the polling on both.
  useEffect(() => {
    if (!ongoing) return undefined;
    const id = setInterval(() => { fetchCampaign(); fetchContacts(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ongoing, fetchCampaign, fetchContacts]);

  // call_records is the row source — one per dialled contact, unanswered ones
  // included. The call log adds duration and lead_status where Vapi webhooked
  // back, matched on call_id. Contacts with no log keep their call_records
  // verdict and show "—" for the log-only columns rather than a fabricated one.
  const rows = useMemo(() => {
    const byCallId = new Map();
    for (const log of logs) {
      if (log.vapi_call_id) byCallId.set(log.vapi_call_id, log);
    }
    return contacts.map((c) => {
      const log = c.call_id ? byCallId.get(c.call_id) : undefined;
      return {
        ...c,
        name: c.name || log?.customer_name || null,
        phone_number: c.phone_number || log?.phone_number || null,
        // call_records has the definitive per-contact status; the log's status
        // only exists for contacts Vapi reported on.
        status: c.status || log?.status || null,
        summary: c.summary || log?.summary || null,
        scheduled_at: c.created_at || log?.started_at || log?.created_at || null,
        duration_seconds: log?.duration_seconds ?? null,
        lead_status: log?.lead_status || null,
        end_reason: log?.end_reason || null,
        vapi_call_id: log?.vapi_call_id || null,
      };
    });
  }, [contacts, logs]);

  // Every aggregate in one pass over the merged rows.
  const stats = useMemo(() => {
    const s = {
      dialed: rows.length,
      connected: 0,
      notConnected: 0,
      failed: 0,
      inProgress: 0,
      connectedDurationTotal: 0,
      connectedWithDuration: 0,
      leadStatus: { hot: 0, warm: 0, cold: 0 },
    };
    for (const row of rows) {
      if (isInProgress(row)) s.inProgress += 1;
      else if (isFailed(row)) s.failed += 1;
      else if (isNotAnswered(row)) s.notConnected += 1;
      else {
        s.connected += 1;
        if (row.duration_seconds > 0) {
          s.connectedDurationTotal += Number(row.duration_seconds);
          s.connectedWithDuration += 1;
        }
      }
      // Only counted where a call log actually produced one — an unanswered
      // contact has no lead status and must not be bucketed as warm.
      const ls = String(row.lead_status || '').toLowerCase();
      if (ls in s.leadStatus) s.leadStatus[ls] += 1;
    }
    s.connectRate = s.dialed > 0 ? Math.round((s.connected / s.dialed) * 100) : 0;
    s.avgConnectedDuration = s.connectedWithDuration > 0
      ? Math.round(s.connectedDurationTotal / s.connectedWithDuration)
      : null;
    return s;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filters = {
      all: () => true,
      connected: isConnected,
      'not-connected': isNotAnswered,
      failed: isFailed,
      'in-progress': isInProgress,
    };
    return [...rows].filter(filters[outcomeFilter] || filters.all).sort(SORTS[sortKey].fn);
  }, [rows, outcomeFilter, sortKey]);

  if (loadingCampaign) {
    return (
      <div className="va-tab-content">
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading campaign…
        </div>
      </div>
    );
  }

  if (campaignError) {
    return (
      <div className="va-tab-content">
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center space-y-3">
            <AlertCircle className="w-7 h-7 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">
              {campaignError === 'notfound' ? 'Campaign not found' : 'Could not load this campaign'}
            </p>
            <p className="text-xs text-muted-foreground">
              {campaignError === 'notfound'
                ? `No campaign with id "${campaignId}". It may have been deleted.`
                : campaignError}
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/voice-campaigns')}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // A row was clicked — reuse the existing detail component rather than
  // rebuilding it. There is no route for a single call, so it renders inline
  // exactly as CallLogsList does.
  if (selectedCallId) {
    return (
      <div className="va-tab-content">
        <CallLogDetail callId={selectedCallId} onBack={() => setSelectedCallId(null)} />
      </div>
    );
  }

  return (
    <div className="va-tab-content">
      <div className="va-tab-header">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate('/voice-campaigns')}
          aria-label="Back to campaigns"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="va-tab-icon-wrap"><Megaphone className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{campaign?.name || 'Campaign'}</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {formatDateTime(campaign?.created_at)}
            </span>
            <span className="capitalize">{campaign?.status}</span>
            {campaign?.filename && <span className="truncate">{campaign.filename}</span>}
            <IdChip id={campaign?.id} label="campaign" full />
            <IdChip id={campaign?.csv_process_id} label="csv" full />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refresh(); fetchCampaign(); }}
          disabled={loadingLogs}
          className="border-border bg-card hover:bg-[hsl(var(--surface-2))]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingLogs ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Contacts comes from the campaign row (the CSV batch size), not
                from the call logs, so it is shown only when it was recorded. */}
            {campaign?.total_leads > 0 && <Stat label="Contacts" value={campaign.total_leads} />}
            <Stat label="Dialled" value={stats.dialed} />
            <Stat label="Connected" value={stats.connected} />
            <Stat label="Not connected" value={stats.notConnected} />
            <Stat label="Failed" value={stats.failed} />
            <Stat label="In progress" value={stats.inProgress} />
            <Stat label="Connect rate" value={`${stats.connectRate}%`} hint="of dialled" />
            {stats.avgConnectedDuration !== null && (
              <Stat
                label="Avg duration"
                value={formatDuration(stats.avgConnectedDuration)}
                hint="connected calls"
              />
            )}
          </div>

          {/* Lead status distribution. The numeric ai_qualification_score is not
              returned by the call-log endpoints, so this is the three-bucket
              lead_status, which is. */}
          {stats.dialed > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Lead status
              </span>
              {['hot', 'warm', 'cold'].map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <LeadStatusBadge status={k} />
                  <span className="text-xs tabular-nums text-muted-foreground">{stats.leadStatus[k]}</span>
                </span>
              ))}
            </div>
          )}

          {total > logs.length && (
            <p className="text-[10px] text-muted-foreground">
              Every contact is listed below. Duration and lead score come from the call log,
              which is fetched {logs.length} rows at a time — the {total - logs.length} oldest
              calls show "—" in those two columns until you page back through Call Logs.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-contact rows */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
              Contacts
            </h3>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs bg-[hsl(var(--surface-2))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="not-connected">Not connected</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in-progress">In progress</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={setSortKey}>
              <SelectTrigger className="h-8 w-[150px] text-xs bg-[hsl(var(--surface-2))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingContacts && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading contacts…
            </div>
          ) : contactsError ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{contactsError}</p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <PhoneCall className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">No contacts for this campaign</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {ongoing
                  ? 'The campaign is still running — rows appear as each contact is dialled.'
                  : 'No contacts were dialled under this campaign id.'}
              </p>
            </div>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No calls match this filter.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(var(--surface-2))]">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Lead</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Duration</th>
                      <th className="px-3 py-2 font-medium">Lead score</th>
                      <th className="px-3 py-2 font-medium">Scheduled</th>
                      <th className="px-3 py-2 font-medium min-w-[280px]">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.call_id || `${row.phone_number}-${row.scheduled_at}`}
                        onClick={() => row.vapi_call_id && setSelectedCallId(row.vapi_call_id)}
                        className={`border-t border-border align-top ${row.vapi_call_id ? 'cursor-pointer hover:bg-[hsl(var(--surface-2))]' : ''}`}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground text-xs truncate max-w-[180px]">
                            {row.name || 'Unknown'}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {row.phone_number || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-2.5"><OutcomeBadge row={row} /></td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(row.duration_seconds)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {/* Only where a call log produced one. */}
                          {row.lead_status
                            ? <LeadStatusBadge status={row.lead_status} />
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(row.scheduled_at)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {row.summary || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
