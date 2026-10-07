import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Terminal, ChevronDown, ChevronRight, Activity, RefreshCw } from 'lucide-react';
import { getSystemHealth } from '@/lib/api';

export default function WebhookLogViewer({ webhookErrors = [], dlqItems = [] }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const [inspecting, setInspecting] = useState(null);
  const [errors, setErrors] = useState(webhookErrors);
  const [dlq, setDlq] = useState(dlqItems);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await getSystemHealth();
      setErrors(res.data.webhook_errors || []);
      setDlq(res.data.dlq_items || []);
    } catch (_) {}
    setRefreshing(false);
  };

  const combined = [
    ...errors.map(e => ({ ...e, type: 'Webhook Crash', _id: `we-${e.id}` })),
    ...dlq.map(d => ({ ...d, type: 'Dead-Letter Queue', _id: `dlq-${d.id}` }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <>
      <Card className="card-base flex flex-col h-full">
        <CardHeader className="pb-3 border-b border-border/50 bg-[hsl(var(--surface-3))]">
          <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-600" /> System Logs & Traces
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto flex-1 max-h-[400px]">
          {combined.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium">All systems operational</p>
              <p className="text-xs">No recent webhook errors or failed jobs.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-[hsl(var(--surface-3))] z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-xs font-semibold">Call / Job ID</TableHead>
                  <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combined.map((log) => {
                  const isExpanded = expandedRow === log._id;
                  const shortId = log.call_id || log.job_id || '—';
                  return (
                    <React.Fragment key={log._id}>
                      <TableRow
                        className={`table-row-hover cursor-pointer ${isExpanded ? 'bg-[hsl(var(--surface-2))]' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : log._id)}
                      >
                        <TableCell className="p-2 w-8">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="p-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${log.type.includes('Webhook') ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                            {log.type}
                          </span>
                        </TableCell>
                        <TableCell className="p-2 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                          {shortId}
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); setInspecting(log); }}
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-[hsl(var(--surface-2))] border-b border-border">
                          <TableCell colSpan={5} className="p-0">
                            <div className="p-3 bg-slate-50 border-t border-border/50 text-xs font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                              {log.error_trace || '(no trace)'}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inspect Detail Modal */}
      <Dialog open={!!inspecting} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-base flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              {inspecting?.type} — {inspecting?.call_id || inspecting?.job_id || inspecting?._id}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-[hsl(var(--surface-2))] p-3">
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="font-medium">{inspecting?.type}</p>
              </div>
              <div className="rounded-md border border-border bg-[hsl(var(--surface-2))] p-3">
                <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                <p className="font-medium tabular-nums">
                  {inspecting?.created_at ? new Date(inspecting.created_at).toLocaleString() : '—'}
                </p>
              </div>
              {inspecting?.call_id && (
                <div className="col-span-2 rounded-md border border-border bg-[hsl(var(--surface-2))] p-3">
                  <p className="text-xs text-muted-foreground mb-1">VAPI Call ID</p>
                  <p className="font-mono text-xs break-all">{inspecting.call_id}</p>
                </div>
              )}
              {inspecting?.job_id && (
                <div className="col-span-2 rounded-md border border-border bg-[hsl(var(--surface-2))] p-3">
                  <p className="text-xs text-muted-foreground mb-1">Job ID</p>
                  <p className="font-mono text-xs break-all">{inspecting.job_id}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Error / Stack Trace</p>
              <div className="rounded-md bg-slate-950 text-red-400 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {inspecting?.error_trace || '(no error trace available)'}
              </div>
            </div>
            {inspecting?.function && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Failed Function</p>
                <div className="rounded-md bg-slate-950 text-amber-400 font-mono text-xs p-4">
                  {inspecting.function}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
