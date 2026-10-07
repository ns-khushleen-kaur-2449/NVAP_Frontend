import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDashboardStats, listUsers, getSystemHealth, getManagerDashboard, getVoiceCallStats } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import KpiCard from '@/components/shared/KpiCard';
import { ShieldCheck, Users, Building2, MessageSquare, Phone, Activity, AlertTriangle, RotateCw, Mic, FileBarChart2, Eye } from 'lucide-react';

const roleColors = {
  admin:   'bg-[#F87217]/10 text-[#F87217] border-[#F87217]/30',
  manager: 'bg-amber-500/10 text-amber-600 border-amber-200',
  agent:   'bg-zinc-500/10 text-zinc-600 border-zinc-200',
};


export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [voiceCallStats, setVoiceCallStats] = useState(null);

  // Health Modal State
  const [selectedHealthCard, setSelectedHealthCard] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarConnected = params.get('calendar_connected');
    const calendarError = params.get('calendar_error');
    if (calendarConnected) {
      navigate(`/settings?calendar_connected=${calendarConnected}`, { replace: true });
      return;
    } else if (calendarError) {
      navigate(`/settings?calendar_error=${calendarError}`, { replace: true });
      return;
    }

    getDashboardStats().then((res) => setStats(res.data)).catch(() => setStats(null));
    getSystemHealth().then((res) => setHealth(res.data)).catch(() => setHealth(null));
    listUsers().then((res) => setUsers(res.data.users || res.data || [])).catch(() => setUsers([]));
    getManagerDashboard().then((res) => setReportStats(res.data)).catch(() => setReportStats(null));
    getVoiceCallStats().then((res) => setVoiceCallStats(res.data)).catch(() => setVoiceCallStats(null));
  }, [navigate]);

  const kpiCards = [
    { label: 'Total Leads',         value: stats?.leads?.total || 0,         icon: Users,        color: '#F87217' },
    { label: 'Active Engagements',  value: stats?.engagements?.active || 0,  icon: MessageSquare, color: '#4a5aa0' },
    { label: 'Properties Listed',   value: stats?.properties?.total || 0,    icon: Building2,    color: '#F87217' },
    { label: 'Calls Today',         value: stats?.calls?.today || 0,         icon: Phone,        color: '#F87217' },
  ];

  const healthCards = [
    { id: 'webhook_errors', label: 'Webhook Errors', value: health?.webhook_errors_total || 0, color: 'hsl(0,72%,52%)', data: health?.webhook_errors || [] },
    { id: 'dlq_items', label: 'Dead-Letter Jobs', value: health?.dlq_items_total || 0, color: 'hsl(0,72%,52%)', data: health?.dlq_items || [] },
    { id: 'retry_pending', label: 'Pending Retries', value: health?.leads_retry_pending || 0, color: 'hsl(38,92%,50%)', data: health?.retry_pending_leads || [] },
    { id: 'manual_followup', label: 'Manual Follow-ups', value: health?.leads_manual_followup || 0, color: 'hsl(38,92%,50%)', data: health?.manual_followup_leads || [] },
  ];

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <AdminSidebar />
      <main className="flex-1 overflow-x-hidden">
        {/* Header */}
        <div className="gradient-header border-b border-border px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Admin Command Center</h1>
              <p className="text-sm text-muted-foreground">Enterprise analytics, lead ops, and property governance.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">

          {/* Agent Overviews */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Voice Agent */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F87217]/10">
                      <Mic className="h-4 w-4 text-primary" />
                    </span>
                    Voice Agent
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-[#C2560E]" onClick={() => navigate('/voice_agent')}>
                    View <Eye className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{stats?.leads?.total ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Total Leads</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{stats?.calls?.today ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Calls Today</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{voiceCallStats?.total_calls ?? stats?.engagements?.active ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Total Calls</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Agent */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F87217]/10">
                      <FileBarChart2 className="h-4 w-4 text-primary" />
                    </span>
                    Report Agent
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-[#C2560E]" onClick={() => navigate('/call-quality')}>
                    View <Eye className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{reportStats?.total_summary?.calls_processed ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Analyzed</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {reportStats?.total_summary?.avg_score != null ? `${reportStats.total_summary.avg_score}%` : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Avg Score</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{reportStats?.total_summary?.hot_leads ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Hot Leads</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{reportStats?.total_summary?.needs_review ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Need Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Voice Agent Section */}
          <div className="flex items-center gap-3 pt-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F87217]/10">
              <Mic className="h-3.5 w-3.5 text-primary" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Voice Agent</h2>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* KPI Cards */}
          <div className="kpi-grid">
            {kpiCards.map((kpi) => (
              <KpiCard
                key={kpi.label}
                title={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                color={kpi.color}
              />
            ))}
          </div>

          {/* System Health Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {healthCards.map((hc) => (
              <KpiCard
                key={hc.label}
                title={hc.label}
                value={hc.value}
                icon={hc.id === 'webhook_errors' ? AlertTriangle : hc.id === 'retry_pending' ? RotateCw : Activity}
                color={hc.value > 0 ? hc.color : '#6b7280'}
                className={hc.value > 0 ? 'cursor-pointer' : 'opacity-70'}
                onClick={() => hc.value > 0 && setSelectedHealthCard(hc)}
              />
            ))}
          </div>

          {/* User Management */}
          <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> User Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {users.slice(0, 6).map((user) => (
                  <div key={user.id || user.email} className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--surface-2))] px-3 py-2 hover:border-[#F87217]/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{user.name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email || 'No email'}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${roleColors[user.role] || roleColors.agent}`}>
                      {user.role || 'agent'}
                    </Badge>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No users available.</p>
                )}
              </CardContent>
            </Card>

          {/* Report Agent Section */}
          <div className="flex items-center gap-3 pt-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F87217]/10">
              <FileBarChart2 className="h-3.5 w-3.5 text-primary" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Report Agent</h2>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Report Agent KPIs — Today */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Calls Analysed Today", value: reportStats?.today_summary?.calls_processed ?? '—', color: '#F87217' },
              { label: "Avg Score Today",       value: reportStats?.today_summary?.avg_score != null ? `${reportStats.today_summary.avg_score}%` : '—', color: '#F87217' },
              { label: "Hot Leads Today",       value: reportStats?.today_summary?.hot_leads ?? '—', color: 'hsl(142,71%,45%)' },
              { label: "Needs Review Today",    value: reportStats?.today_summary?.needs_review ?? '—', color: 'hsl(38,92%,50%)' },
            ].map((kpi) => (
              <Card key={kpi.label} className="bg-card border-border">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Executive Scorecards + Outcome Distribution */}
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Executive Scorecards
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                      <TableHead className="text-xs">Executive</TableHead>
                      <TableHead className="text-xs">Calls</TableHead>
                      <TableHead className="text-xs">Avg Score</TableHead>
                      <TableHead className="text-xs">Trend</TableHead>
                      <TableHead className="text-xs">Best / Worst</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reportStats?.executive_scorecards || []).slice(0, 6).map((sc) => (
                      <TableRow key={sc.username} className="hover:bg-[hsl(var(--surface-2))]">
                        <TableCell className="text-sm font-medium">{sc.username}</TableCell>
                        <TableCell className="text-sm">{sc.call_count}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${sc.avg_score >= 75 ? 'text-green-600' : sc.avg_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {sc.avg_score}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${sc.trend_delta > 0 ? 'text-green-600' : sc.trend_delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {sc.trend_delta > 0 ? `+${sc.trend_delta}` : sc.trend_delta === 0 ? '—' : sc.trend_delta}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sc.best_dimension && <span className="text-green-600">{sc.best_dimension}</span>}
                          {sc.best_dimension && sc.worst_dimension && <span className="mx-1">/</span>}
                          {sc.worst_dimension && <span className="text-red-400">{sc.worst_dimension}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!reportStats?.executive_scorecards?.length) && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No scorecards yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Outcome Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(reportStats?.outcome_distribution || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No outcomes recorded yet.</p>
                ) : (
                  Object.entries(reportStats?.outcome_distribution || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([outcome, count]) => {
                      const total = Object.values(reportStats.outcome_distribution).reduce((s, v) => s + v, 0);
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={outcome} className="flex items-center gap-3 rounded-lg border border-border bg-[hsl(var(--surface-2))] px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{outcome}</p>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-sm font-bold text-foreground shrink-0">{count}</span>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* System Health Details Modal */}
        <Dialog open={!!selectedHealthCard} onOpenChange={(open) => !open && setSelectedHealthCard(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {selectedHealthCard?.label} Details
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {selectedHealthCard?.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data available.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(var(--surface-3))]">
                      {selectedHealthCard?.id === 'webhook_errors' && (
                        <>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Call ID</TableHead>
                          <TableHead className="text-xs">Error</TableHead>
                        </>
                      )}
                      {selectedHealthCard?.id === 'dlq_items' && (
                        <>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Job ID</TableHead>
                          <TableHead className="text-xs">Error</TableHead>
                        </>
                      )}
                      {(selectedHealthCard?.id === 'retry_pending' || selectedHealthCard?.id === 'manual_followup') && (
                        <>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Retries</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedHealthCard?.data?.map((item, i) => (
                      <TableRow key={i} className="hover:bg-[hsl(var(--surface-2))]">
                        {selectedHealthCard.id === 'webhook_errors' && (
                          <>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{item.call_id || 'N/A'}</TableCell>
                            <TableCell className="text-xs text-red-400 font-mono break-all">{item.error_trace}</TableCell>
                          </>
                        )}
                        {selectedHealthCard.id === 'dlq_items' && (
                          <>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{item.job_id}</TableCell>
                            <TableCell className="text-xs text-red-400 font-mono break-all">{item.error_trace}</TableCell>
                          </>
                        )}
                        {(selectedHealthCard.id === 'retry_pending' || selectedHealthCard.id === 'manual_followup') && (
                          <>
                            <TableCell className="text-sm font-medium">{item.name}</TableCell>
                            <TableCell className="text-xs">{item.phone || 'N/A'}</TableCell>
                            <TableCell className="text-xs">{item.retry_count || 0}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
