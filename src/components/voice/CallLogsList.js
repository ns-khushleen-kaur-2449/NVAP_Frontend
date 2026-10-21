import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallLogs } from '@/hooks/useCallLogs';
import CallLogDetail from './CallLogDetail';
import {
  Search, RefreshCw, Phone, Clock, Calendar,
  CheckCircle2, XCircle, AlertCircle, Loader2, Mic,
  ChevronLeft, ChevronRight, PhoneCall, Trash2, Bot
} from 'lucide-react';
import { deleteCallLog } from '@/lib/api';
import { CALL_STATUS_FILTERS, callStatusMeta } from '@/lib/callOutcome';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const TONE_ICONS = { good: CheckCircle2, live: Loader2, waiting: AlertCircle, bad: XCircle, neutral: AlertCircle };

function StatusBadge({ status, label }) {
  // `label` is the backend's status_label ("Analysing…" while the analysis is on its way).
  const meta = label ? { ...callStatusMeta('in-progress'), label } : callStatusMeta(status);
  const Icon = TONE_ICONS[meta.tone];
  return (
    <Badge variant="outline" className={`${meta.className} gap-1 text-[10px] font-medium`}>
      <Icon className="w-2.5 h-2.5" aria-hidden="true" /> {meta.label}
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
    <Badge variant="outline" className={`${s} gap-1 text-[10px] font-semibold uppercase tracking-wider shrink-0`}>
      {label}
    </Badge>
  );
}

function SourceBadge({ source }) {
  const map = {
    manual: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    csv: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <Badge variant="outline" className={`${map[source] || map.manual} text-[10px]`}>
      {source || 'manual'}
    </Badge>
  );
}


function formatDuration(sec) {
  if (!sec && sec !== 0) return '--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso) {
  if (!iso) return '--';
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return new Date(normalized).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function CallLogsList({ assistantId = '', assistantName = '', onClearAssistant }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedCallId, setSelectedCallId] = useState(null);

  const { logs, total, totalPages, loading, error, refresh } = useCallLogs({
    page,
    pageSize: 15,
    status: statusFilter,
    sourceType: sourceFilter,
    assistantId,
    search,
    sortBy: 'latest',
  });

  // Arriving from an agent card pre-filters the list; reset paging when the
  // agent changes so page 3 of the previous agent does not come up empty.
  useEffect(() => { setPage(1); }, [assistantId]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // If a call is selected, show detail view
  if (selectedCallId) {
    return <CallLogDetail callId={selectedCallId} onBack={() => setSelectedCallId(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          {assistantId && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F87217]/30 bg-[#FBEFE4] text-[#C2560E]">
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-semibold">
                Showing calls by {assistantName || 'this agent'}
              </span>
              {onClearAssistant && (
                <button
                  type="button"
                  onClick={onClearAssistant}
                  className="text-xs font-bold underline underline-offset-2 hover:no-underline"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs tabular-nums">{total} calls</Badge>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="bg-card rounded-xl border border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, transcript..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-3 w-full py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F87217] focus:border-[#F87217] transition duration-150"
                />
              </div>
              <Button type="submit" size="sm" className="bg-[#F87217] hover:bg-[#C2560E] text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm">Search</Button>
            </form>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[140px] px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#F87217] focus:border-[#F87217]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {CALL_STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#F87217] focus:border-[#F87217]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Call logs list */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="bg-card rounded-xl border border-border shadow-sm">
          <CardContent className="py-16 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card className="bg-card rounded-xl border border-border shadow-sm">
          <CardContent className="py-16 text-center">
            <PhoneCall className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground/80 mb-1">No call logs yet</p>
            <p className="text-xs text-muted-foreground">Call logs will appear here after calls are made via the Voice Agent.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-[#F87217]/30 hover:bg-[#F87217]/5 transition-all duration-200 cursor-pointer group"
              onClick={() => setSelectedCallId(log.vapi_call_id || log.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#F87217]/8 flex items-center justify-center shrink-0 group-hover:bg-[#F87217]/15 transition-colors">
                    <Phone className="w-4 h-4 text-[#F87217]" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{log.customer_name || 'Unknown'}</p>
                      <StatusBadge status={log.status} label={log.status_label} />
                      <SourceBadge source={log.source_type} />
                      <LeadStatusBadge status={log.lead_status} />
                      {log.appointment_booked && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] gap-0.5">
                          <Calendar className="w-2.5 h-2.5" /> Booked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" /> {log.phone_number || '--'}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /> {formatDuration(log.duration_seconds)}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground" /> {formatTime(log.created_at)}</span>
                      {log.recording_url && log.recording_url !== 'rawRecordingUploadDisabled' && <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-[#F87217]" /> Rec</span>}
                    </div>
                  </div>

                  {/* End reason — right side */}
                  {log.end_reason && (
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-[11px] text-muted-foreground">{log.end_reason}</p>
                    </div>
                  )}

                  {/* Admin-only Delete Button */}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 relative z-10 shrink-0 self-center"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm('Are you sure you want to delete this call log? This cannot be undone.')) return;
                        try {
                          await deleteCallLog(log.vapi_call_id || log.id);
                          toast.success('Call log deleted successfully');
                          refresh();
                        } catch (err) {
                          toast.error('Failed to delete call log');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
