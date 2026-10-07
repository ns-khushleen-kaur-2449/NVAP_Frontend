import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Download, Loader2 } from 'lucide-react';
import { getAgentRuns, getAgentRunStats, retryAgentRun, exportAgentRunsCSV, downloadBlob } from '@/lib/api';
import { formatDateTime, timeAgo } from '@/lib/utils';

const agentNames = {
  lead_qualification: 'Lead Qualification',
  engagement: 'Customer Engagement',
  research: 'Research',
  exec_report: 'Executive Analytics',
  call_summary: 'Voice Agent',
};

const statusIcons = {
  success: <CheckCircle className="w-4 h-4 text-[hsl(158,64%,42%)]" />,
  failed: <XCircle className="w-4 h-4 text-[hsl(0,72%,52%)]" />,
  running: <Loader2 className="w-4 h-4 text-[hsl(199,70%,45%)] animate-spin" />,
};

const statusColors = {
  success: 'bg-[hsla(158,64%,42%,0.18)] text-[hsl(158,64%,55%)]',
  failed: 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)]',
  running: 'bg-[hsla(199,70%,45%,0.18)] text-[hsl(199,70%,65%)]',
};

export default function AgentRunsPage() {
  const [runs, setRuns] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [retrying, setRetrying] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (typeFilter && typeFilter !== 'all') params.agent_type = typeFilter;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const [runsR, statsR] = await Promise.all([getAgentRuns(params), getAgentRunStats()]);
      setRuns(runsR.data.runs);
      setTotal(runsR.data.total);
      setStats(statsR.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRetry = async (runId) => {
    setRetrying(runId);
    try {
      await retryAgentRun(runId);
      toast.success('Agent re-run completed');
      fetchData();
    } catch (e) {
      toast.error('Retry failed: ' + (e.response?.data?.detail || e.message));
    }
    setRetrying(null);
  };

  const handleExport = async () => {
    try {
      const r = await exportAgentRunsCSV();
      downloadBlob(r.data, 'agent_runs_export.csv');
      toast.success('Agent runs exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Runs</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Successful</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-[hsl(158,64%,42%)]">{stats.success}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-[hsl(0,72%,52%)]">{stats.failed}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Running</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-[hsl(199,70%,45%)]">{stats.running}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Latency</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{stats.avg_latency_ms ? `${(stats.avg_latency_ms / 1000).toFixed(1)}s` : '--'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-[hsl(var(--surface-2))] border-border" data-testid="agent-runs-type-filter">
            <SelectValue placeholder="Agent Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="lead_qualification">Lead Qualification</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="exec_report">Executive Analytics</SelectItem>
            <SelectItem value="call_summary">Voice Agent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-[hsl(var(--surface-2))] border-border" data-testid="agent-runs-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExport} className="border-border" data-testid="export-agent-runs">
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-border">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Runs Table */}
      <Card className="bg-card border-border">
        <ScrollArea className="h-[500px]">
          <Table data-testid="agent-runs-table">
            <TableHeader>
              <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Entity</TableHead>
                <TableHead className="text-xs">Output</TableHead>
                <TableHead className="text-xs text-right">Latency</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow key={run.id} className="hover:bg-[hsl(var(--surface-2))]">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{agentNames[run.agent_type] || run.agent_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {statusIcons[run.status]}
                      <Badge variant="outline" className={`text-[10px] border-0 ${statusColors[run.status] || ''}`}>
                        {run.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{run.entity_name || '--'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {run.status === 'failed' ? (
                      <span className="text-[hsl(0,72%,70%)]">{run.error_message}</span>
                    ) : (run.output_summary || '--')}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-mono">
                    {run.latency_ms ? `${(run.latency_ms / 1000).toFixed(1)}s` : '--'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{timeAgo(run.created_at)}</TableCell>
                  <TableCell>
                    {run.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(run.id)}
                        disabled={retrying === run.id}
                        className="h-7 text-xs"
                        data-testid={`retry-run-${run.id}`}
                      >
                        {retrying === run.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {loading ? 'Loading...' : 'No agent runs yet. Run an AI agent to see logs here.'}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
      <p className="text-xs text-muted-foreground">{total} runs total</p>
    </div>
  );
}
