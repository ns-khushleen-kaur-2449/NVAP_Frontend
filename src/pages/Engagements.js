import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallLogs } from '@/hooks/useCallLogs';
import { Phone, Clock, Calendar, RefreshCw, Flame, Thermometer, Snowflake, Loader2, XCircle } from 'lucide-react';

function getLeadTemp(log) {
  if (log.appointment_booked || (log.status === 'completed' && log.duration_seconds >= 300)) {
    return {
      label: 'Hot',
      icon: Flame,
      color: 'bg-red-500/15 text-red-500 border-red-400/30',
      reason: log.appointment_booked
        ? 'Appointment was booked during the call.'
        : 'Long, engaged conversation — strong buying intent.',
    };
  }
  if (log.status === 'completed' && log.duration_seconds >= 120) {
    return {
      label: 'Warm',
      icon: Thermometer,
      color: 'bg-orange-400/15 text-orange-500 border-orange-400/30',
      reason: 'Call completed with reasonable engagement. Needs follow-up.',
    };
  }
  return {
    label: 'Cold',
    icon: Snowflake,
    color: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
    reason: log.status === 'failed'
      ? 'Call failed or was not connected.'
      : 'Very short or incomplete conversation. Low engagement.',
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
  const [tempFilter, setTempFilter] = useState('');

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

  const filtered = tempFilter
    ? dedupedLeads.filter(l => getLeadTemp(l).label.toLowerCase() === tempFilter)
    : dedupedLeads;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="gradient-header rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight mb-1">Engagements</h1>
            <p className="text-sm text-muted-foreground">Lead temperature and call outcome summary.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="tabular-nums text-xs">{dedupedLeads.length} leads</Badge>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Temperature filter */}
      <div className="flex items-center gap-2">
        <Select value={tempFilter} onValueChange={v => setTempFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[150px] text-sm bg-white">
            <SelectValue placeholder="All Leads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leads</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌡️ Warm</SelectItem>
            <SelectItem value="cold">🧊 Cold</SelectItem>
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
            const temp = getLeadTemp(log);
            const Icon = temp.icon;
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

                    {/* Right — temperature + reason */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[220px] text-right">
                      <Badge className={`${temp.color} gap-1 text-xs font-semibold`}>
                        <Icon className="w-3 h-3" /> {temp.label}
                      </Badge>
                      <p className="text-[11px] text-gray-500 leading-snug">{temp.reason}</p>
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
