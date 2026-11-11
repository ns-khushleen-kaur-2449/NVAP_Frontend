import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallLogs } from '@/hooks/useCallLogs';
import { isConnectedStatus, isNotConnectedStatus } from '@/lib/callOutcome';
import { Phone, Clock, Calendar, RefreshCw, MessagesSquare, MessageSquare, PhoneOff, Loader2, XCircle } from 'lucide-react';

// How engaged the latest call was, from its outcome and length.  A call-level fact, not the
// lead's temperature (that comes from the lead score): it never says Hot, Warm or Cold.
export const ENGAGEMENT_FILTERS = [
  { value: 'strong', label: 'Strong engagement' },
  { value: 'moderate', label: 'Moderate engagement' },
  { value: 'short', label: 'Short call' },
  { value: 'not_connected', label: 'Not connected' },
];

export function getCallEngagement(log) {
  if (log.appointment_booked || (isConnectedStatus(log.status) && log.duration_seconds >= 300)) {
    return {
      key: 'strong',
      label: 'Strong engagement',
      icon: MessagesSquare,
      color: 'bg-emerald-500/15 text-emerald-600 border-emerald-400/30',
      reason: log.appointment_booked
        ? 'An appointment was booked during the call.'
        : 'Connected for 5 minutes or more.',
    };
  }
  if (isConnectedStatus(log.status) && log.duration_seconds >= 120) {
    return {
      key: 'moderate',
      label: 'Moderate engagement',
      icon: MessageSquare,
      color: 'bg-sky-400/15 text-sky-600 border-sky-400/30',
      reason: 'Connected for 2 minutes or more.',
    };
  }
  if (isNotConnectedStatus(log.status)) {
    return {
      key: 'not_connected',
      label: 'Not connected',
      icon: PhoneOff,
      color: 'bg-gray-200 text-gray-600 border-gray-300',
      reason: 'The call failed or was not connected.',
    };
  }
  return {
    key: 'short',
    label: 'Short call',
    icon: Phone,
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    reason: 'A short or incomplete conversation (under 2 minutes).',
  };
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
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EngagementsPage() {
  const [engagementFilter, setEngagementFilter] = useState('');

  const { logs, loading, error, refresh } = useCallLogs({
    page: 1, pageSize: 50, sortBy: 'latest', autoRefresh: false,
  });

  // One card per lead: group by name+phone combo, keep most recent call
  const leadMap = new Map();
  for (const log of logs) {
    const name = (log.customer_name || '').trim().toLowerCase();
    const phone = (log.phone_number || '').trim();
    const key = name ? `${name}||${phone}` : (phone || log.id);
    if (!leadMap.has(key)) {
      leadMap.set(key, { ...log, callCount: 1 });
    } else {
      leadMap.get(key).callCount += 1;
    }
  }
  const dedupedLeads = Array.from(leadMap.values());

  const filtered = engagementFilter
    ? dedupedLeads.filter(l => getCallEngagement(l).key === engagementFilter)
    : dedupedLeads;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="gradient-header rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight mb-1">Engagements</h1>
            <p className="text-sm text-muted-foreground">Call engagement and outcome summary.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="tabular-nums text-xs">{dedupedLeads.length} leads</Badge>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Call engagement filter */}
      <div className="flex items-center gap-2">
        <Select value={engagementFilter} onValueChange={v => setEngagementFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px] text-sm bg-white" aria-label="Call engagement">
            <SelectValue placeholder="All calls" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All calls</SelectItem>
            {ENGAGEMENT_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading && filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <Card><CardContent className="py-16 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{typeof error === 'string' ? error : 'Failed to load engagements'}</p>
          <Button variant="outline" size="sm" onClick={refresh} className="mt-4">Retry</Button>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Phone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No engagements yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const engagement = getCallEngagement(log);
            const Icon = engagement.icon;
            return (
              <Card key={log.phone_number || log.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#F87217]/30 hover:bg-[#F87217]/5 transition-all duration-200 cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Left — customer info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{log.customer_name || 'Unknown'}</p>
                        {log.callCount > 1 && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{log.callCount} calls</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{log.phone_number || '--'}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(log.duration_seconds)}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatTime(log.created_at)}</span>
                      </div>
                    </div>

                    {/* Right — call engagement + reason */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[220px] text-right">
                      <Badge className={`${engagement.color} gap-1 text-xs font-semibold`} data-testid="call-engagement">
                        <Icon className="w-3 h-3" /> {engagement.label}
                      </Badge>
                      <p className="text-[11px] text-gray-500 leading-snug">{engagement.reason}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
