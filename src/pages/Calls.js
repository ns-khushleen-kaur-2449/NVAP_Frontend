import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Plus, Sparkles, Clock, X, PhoneIncoming, PhoneOutgoing, AlertTriangle, Download, HelpCircle } from 'lucide-react';
import { getCalls, createCall, getCall, summarizeCall, getProspects, exportCallsCSV, downloadBlob } from '@/lib/api';
import { toLeadRow } from '@/lib/prospects';
import { formatDuration, formatDateTime, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadges';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { AgentButton } from '@/components/shared/AgentButton';
import { Progress } from '@/components/ui/progress';

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newCall, setNewCall] = useState({
    lead_id: '', lead_name: '', caller_phone: '', direction: 'inbound',
    duration_seconds: '', language: 'English', status: 'completed', transcript: ''
  });

  const fetchCalls = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const r = await getCalls(params);
      setCalls(r.data.calls);
      setTotal(r.data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const selectCall = async (call) => {
    try {
      const r = await getCall(call.id);
      setSelected(r.data);
    } catch (e) {
      setSelected(call);
    }
  };

  const handleSummarize = async () => {
    if (!selected) return;
    setSummarizing(true);
    try {
      const r = await summarizeCall(selected.id);
      setSelected(r.data.call);
      toast.success(`Call analyzed - Score: ${r.data.analysis.qualification_score}/100`);
      fetchCalls();
    } catch (e) {
      toast.error('Summarization failed: ' + (e.response?.data?.detail || e.message));
    }
    setSummarizing(false);
  };

  const handleCreate = async () => {
    try {
      const data = { ...newCall };
      if (data.duration_seconds) data.duration_seconds = parseInt(data.duration_seconds);
      else delete data.duration_seconds;
      if (!data.lead_id) delete data.lead_id;
      if (!data.lead_name) delete data.lead_name;
      await createCall(data);
      toast.success('Call log created');
      setShowCreate(false);
      setNewCall({ lead_id: '', lead_name: '', caller_phone: '', direction: 'inbound', duration_seconds: '', language: 'English', status: 'completed', transcript: '' });
      fetchCalls();
    } catch (e) {
      toast.error('Failed to create call log');
    }
  };

  const openCreateDialog = async () => {
    try {
      const r = await getProspects({ leads_only: true, limit: 1000 });
      setLeads(r.data.prospects.map(toLeadRow));
    } catch (e) { setLeads([]); }
    setShowCreate(true);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left: Call List */}
      <div className="flex flex-col w-full xl:w-[50%] min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-[hsl(var(--surface-2))] border-border" data-testid="calls-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={async () => {
            try { const r = await exportCallsCSV(); downloadBlob(r.data, 'calls_export.csv'); toast.success('Calls exported'); }
            catch (e) { toast.error('Export failed'); }
          }} className="border-border" data-testid="export-calls-csv">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button size="sm" className="ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)]" onClick={openCreateDialog} data-testid="add-call-button">
            <Plus className="w-4 h-4 mr-1" /> Log Call
          </Button>
        </div>

        <Card className="bg-card border-border flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table data-testid="calls-table">
              <TableHeader>
                <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                  <TableHead className="text-xs">Caller</TableHead>
                  <TableHead className="text-xs">Direction</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">AI Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map(call => (
                  <TableRow
                    key={call.id}
                    className={`cursor-pointer hover:bg-[hsl(var(--surface-2))] ${selected?.id === call.id ? 'bg-[hsl(var(--surface-2))]' : ''}`}
                    onClick={() => selectCall(call)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{call.lead_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{call.caller_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {call.direction === 'inbound' ? (
                        <div className="flex items-center gap-1 text-xs"><PhoneIncoming className="w-3.5 h-3.5 text-[hsl(173,80%,36%)]" /> In</div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs"><PhoneOutgoing className="w-3.5 h-3.5 text-[hsl(199,70%,45%)]" /> Out</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums font-mono">{formatDuration(call.duration_seconds)}</TableCell>
                    <TableCell><StatusBadge status={call.status} /></TableCell>
                    <TableCell className="tabular-nums">
                      {call.ai_qualification_score ? (
                        <span className="text-sm" style={{ color: call.ai_qualification_score >= 70 ? 'hsl(173,80%,36%)' : call.ai_qualification_score >= 40 ? 'hsl(38,55%,62%)' : 'hsl(0,72%,52%)' }}>
                          {call.ai_qualification_score}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">--</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {calls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading...' : 'No calls found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
        <p className="text-xs text-muted-foreground mt-2">{total} calls total</p>
      </div>

      {/* Right: Call Detail */}
      <div className="hidden xl:flex flex-col w-[50%] min-w-0">
        {selected ? (
          <Card className="bg-card border-border flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{selected.lead_name || 'Unknown Caller'}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{selected.caller_phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={selected.status} />
                      <Badge variant="outline" className="text-xs border-0 bg-[hsl(var(--surface-2))]">
                        {selected.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-0 bg-[hsl(var(--surface-2))]">
                        {selected.language}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* AI Analysis */}
                {selected.ai_summary ? (
                  <div className="mb-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-[hsl(var(--surface-2))] mb-3">
                      <ScoreGauge score={selected.ai_qualification_score} size={90} />
                      <div className="flex-1 space-y-1">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground">Sentiment:</span> <span className="capitalize">{selected.ai_sentiment}</span></div>
                          <div><span className="text-muted-foreground">Intent:</span> <span className="capitalize">{selected.ai_buyer_intent}</span></div>
                          <div><span className="text-muted-foreground">Duration:</span> <span className="font-mono">{formatDuration(selected.duration_seconds)}</span></div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Handoff:</span>
                            {selected.ai_handoff_needed ? (
                              <span className="text-[hsl(0,72%,52%)] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Yes</span>
                            ) : <span className="text-[hsl(158,64%,42%)]">No</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))] mb-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Summary</p>
                      <p className="text-sm">{selected.ai_summary}</p>
                    </div>

                    {selected.ai_key_requirements?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="text-xs text-muted-foreground">Requirements:</span>
                        {selected.ai_key_requirements.map((r, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-0 bg-[hsl(var(--surface-3))]">{r}</Badge>
                        ))}
                      </div>
                    )}

                    {selected.ai_objections?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="text-xs text-muted-foreground">Objections:</span>
                        {selected.ai_objections.map((o, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-0 bg-[hsla(38,92%,50%,0.12)] text-[hsl(38,92%,65%)]">{o}</Badge>
                        ))}
                      </div>
                    )}

                    {selected.ai_next_step && (
                      <p className="text-xs"><span className="text-muted-foreground">Next Step:</span> <span className="text-primary">{selected.ai_next_step}</span></p>
                    )}

                    {selected.ai_handoff_reason && (
                      <p className="text-xs mt-1"><span className="text-muted-foreground">Handoff Reason:</span> <span className="text-[hsl(0,72%,70%)]">{selected.ai_handoff_reason}</span></p>
                    )}

                    {/* Explainability */}
                    {selected.ai_why_sentiment && (
                      <div className="mt-3 p-2 rounded border border-border bg-[hsl(var(--surface-2))]">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Why this sentiment</p>
                        <p className="text-xs mt-1">{selected.ai_why_sentiment}</p>
                      </div>
                    )}
                    {selected.ai_why_handoff && (
                      <div className="mt-2 p-2 rounded border border-border bg-[hsl(var(--surface-2))]">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Why handoff decision</p>
                        <p className="text-xs mt-1">{selected.ai_why_handoff}</p>
                      </div>
                    )}
                    {selected.ai_score_factors?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Score Breakdown</p>
                        <div className="space-y-2">
                          {selected.ai_score_factors.map((f, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs">{f.factor}</span>
                                <span className="text-xs tabular-nums" style={{
                                  color: f.score >= 70 ? 'hsl(173,80%,36%)' : f.score >= 40 ? 'hsl(38,55%,62%)' : 'hsl(0,72%,52%)'
                                }}>{f.score}/100</span>
                              </div>
                              <Progress value={f.score} className="h-1" />
                              <p className="text-[10px] text-muted-foreground mt-0.5">{f.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="mb-4">
                  <AgentButton
                    onClick={handleSummarize}
                    loading={summarizing}
                    icon={Sparkles}
                    disabled={!selected.transcript}
                    data-testid="call-summarize-button"
                  >
                    {selected.ai_summary ? 'Re-analyze Call' : 'Generate AI Summary'}
                  </AgentButton>
                  {!selected.transcript && <p className="text-xs text-muted-foreground mt-1">No transcript available</p>}
                </div>

                {/* Transcript */}
                {selected.transcript && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Transcript</h4>
                    <div className="rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                        {selected.transcript}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <Card className="bg-card border-border flex-1 flex items-center justify-center">
            <div className="text-center">
              <Phone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a call to view details</p>
            </div>
          </Card>
        )}
      </div>

      {/* Create Call Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Log Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newCall.lead_id || 'none'} onValueChange={v => {
              const lead = leads.find(l => l.id === v);
              setNewCall({...newCall, lead_id: v === 'none' ? '' : v, lead_name: lead?.name || ''});
            }}>
              <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                <SelectValue placeholder="Link to Lead (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Lead</SelectItem>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Caller Phone" value={newCall.caller_phone} onChange={e => setNewCall({...newCall, caller_phone: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Select value={newCall.direction} onValueChange={v => setNewCall({...newCall, direction: v})}>
                <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Duration (seconds)" type="number" value={newCall.duration_seconds} onChange={e => setNewCall({...newCall, duration_seconds: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Language" value={newCall.language} onChange={e => setNewCall({...newCall, language: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
            </div>
            <Textarea placeholder="Paste call transcript here..." value={newCall.transcript} onChange={e => setNewCall({...newCall, transcript: e.target.value})} rows={6} className="bg-[hsl(var(--surface-2))] border-border" data-testid="call-transcript-input" />
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground" data-testid="create-call-submit">
              Save Call Log
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
