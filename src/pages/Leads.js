import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProspectTimeline from '@/components/ops/ProspectTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Search, Sparkles, X, ChevronRight, ChevronLeft, Users, Download, UserCog, ArrowRight, HelpCircle } from 'lucide-react';
import {
  getProspect, getProspects, createProspect,
  bulkQualifyLeads, bulkAssignLeads, bulkUpdateStage,
  exportLeadsCSV, downloadBlob
} from '@/lib/api';
import { formatCurrency, STAGE_OPTIONS } from '@/lib/utils';
import { toLeadRow } from '@/lib/prospects';
import { StageBadge, PriorityBadge, StatusBadge } from '@/components/shared/StatusBadges';
import { ScoreGauge } from '@/components/shared/ScoreGauge';

const ScoreFactorsPanel = ({ factors, whyScore }) => {
  if (!factors || factors.length === 0) return null;
  return (
    <div className="p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <HelpCircle className="w-3 h-3" /> Why This Score
      </p>
      {whyScore && <p className="text-sm mb-3 text-foreground/90">{whyScore}</p>}
      <div className="space-y-2">
        {factors.map((f, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{f.factor}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">w:{f.weight}%</span>
                <span className="text-xs tabular-nums font-medium" style={{
                  color: f.score >= 70 ? 'hsl(173,80%,36%)' : f.score >= 40 ? 'hsl(38,55%,62%)' : 'hsl(0,72%,52%)'
                }}>{f.score}/100</span>
              </div>
            </div>
            <Progress value={f.score} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-0.5">{f.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [bulkStage, setBulkStage] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', source: 'website', project: '', category: '', sub_category: '', budget_min: '', budget_max: '', location_preference: '', timeline: '', employment: '' });
  const [countryCode, setCountryCode] = useState('+91');

  const fetchLeads = useCallback(async () => {
    try {
      // Leads are prospects with a lead mapping or at QUALIFIED/CONVERTED.
      const params = { leads_only: true, limit: 500 };
      if (search) params.search = search;
      if (stageFilter && stageFilter !== 'all') params.stage = stageFilter;
      const r = await getProspects(params);
      setLeads(r.data.prospects.map(toLeadRow));
      setTotal(r.data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, stageFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // /leads?prospect=<id> (links from the Operations tabs) opens that prospect.
  const [searchParams] = useSearchParams();
  const linkedProspect = searchParams.get('prospect');
  // Opened from another screen in the app (not typed or reloaded): offer the way back to it.
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = Boolean(linkedProspect) && location.key !== 'default';
  useEffect(() => {
    if (!linkedProspect) return;
    getProspect(linkedProspect).then((r) => setSelectedLead(toLeadRow(r.data))).catch(() => toast.error('That lead is not available to you.'));
  }, [linkedProspect]);

  const selectLead = (lead) => setSelectedLead(lead);

  const handleCreate = async () => {
    try {
      const { name, email, phone, source, budget_min, budget_max, ...rest } = newLead;
      const trimmed = (phone || '').trim();
      // Details with no prospect column are kept in custom_fields.
      const custom_fields = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== ''));
      if (budget_min) custom_fields.budget_min = parseFloat(budget_min);
      if (budget_max) custom_fields.budget_max = parseFloat(budget_max);
      await createProspect({
        full_name: name.trim(),
        email: email || null,
        phone: trimmed ? (trimmed.startsWith('+') ? trimmed : `${countryCode}${trimmed}`) : null,
        source: source || 'manual',
        custom_fields,
      });
      toast.success('Lead created');
      setShowCreate(false);
      setNewLead({ name: '', email: '', phone: '', source: 'website', project: '', category: '', sub_category: '', budget_min: '', budget_max: '', location_preference: '', timeline: '', employment: '' });
      fetchLeads();
    } catch (e) {
      toast.error('Failed to create lead');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id)));
  };

  const handleBulkAction = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error('Select leads first'); return; }
    setBulkRunning(true);
    try {
      if (bulkAction === 'qualify') {
        const r = await bulkQualifyLeads(ids);
        toast.success(`Qualified ${r.data.success}/${r.data.total} leads`);
      } else if (bulkAction === 'assign' && bulkAssignTo) {
        const r = await bulkAssignLeads(ids, bulkAssignTo);
        toast.success(r.data.message);
      } else if (bulkAction === 'stage' && bulkStage) {
        const r = await bulkUpdateStage(ids, bulkStage);
        toast.success(r.data.message);
      }
      setShowBulkDialog(false);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (e) {
      toast.error('Bulk action failed: ' + (e.response?.data?.detail || e.message));
    }
    setBulkRunning(false);
  };

  const handleExport = async () => {
    try {
      const r = await exportLeadsCSV();
      downloadBlob(r.data, 'leads_export.csv');
      toast.success('Leads exported to CSV');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left: Lead List */}
      <div className={`${selectedLead ? 'hidden xl:flex' : 'flex'} flex-col w-full xl:w-[55%] min-w-0`}>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[hsl(var(--surface-2))] border-border"
              data-testid="leads-search"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[140px] bg-[hsl(var(--surface-2))] border-border" data-testid="leads-filter-stage-select">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGE_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedIds.size > 0 && (
            <Button size="sm" variant="secondary" onClick={() => {
              setBulkAction('');
              setShowBulkDialog(true);
            }} className="bg-[hsl(var(--surface-2))]" data-testid="bulk-actions-button">
              <UserCog className="w-4 h-4 mr-1" /> Bulk ({selectedIds.size})
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={handleExport} className="border-border" data-testid="export-leads-csv">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)]" data-testid="add-lead-button">
                <Plus className="w-4 h-4 mr-1" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Name *" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" data-testid="lead-name-input" />
                <Input placeholder="Email" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <div className="flex items-center gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[110px] bg-[hsl(var(--surface-2))] border-border" aria-label="Country code">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+1">+1</SelectItem>
                      <SelectItem value="+44">+44</SelectItem>
                      <SelectItem value="+61">+61</SelectItem>
                      <SelectItem value="+65">+65</SelectItem>
                      <SelectItem value="+91">+91</SelectItem>
                      <SelectItem value="+971">+971</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Phone"
                    value={newLead.phone}
                    onChange={e => setNewLead({...newLead, phone: e.target.value})}
                    className="bg-[hsl(var(--surface-2))] border-border flex-1"
                  />
                </div>
                <Input placeholder="Source" value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Project" value={newLead.project} onChange={e => setNewLead({...newLead, project: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border col-span-2" />
                <Input placeholder="Category" value={newLead.category} onChange={e => setNewLead({...newLead, category: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Sub Category" value={newLead.sub_category} onChange={e => setNewLead({...newLead, sub_category: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Budget Min" type="number" value={newLead.budget_min} onChange={e => setNewLead({...newLead, budget_min: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Budget Max" type="number" value={newLead.budget_max} onChange={e => setNewLead({...newLead, budget_max: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Location" value={newLead.location_preference} onChange={e => setNewLead({...newLead, location_preference: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Timeline" value={newLead.timeline} onChange={e => setNewLead({...newLead, timeline: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
                <Input placeholder="Employment" value={newLead.employment} onChange={e => setNewLead({...newLead, employment: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border col-span-2" />
              </div>
              <Button onClick={handleCreate} disabled={!newLead.name} className="mt-2 bg-primary text-primary-foreground" data-testid="create-lead-submit">
                Create Lead
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lead Table with Checkboxes */}
        <Card className="card-base flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table data-testid="leads-table">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === leads.length && leads.length > 0} onCheckedChange={toggleSelectAll} data-testid="select-all-leads" />
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Stage</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Score</TableHead>
                  <TableHead className="text-xs font-semibold">Budget</TableHead>
                  <TableHead className="text-xs font-semibold">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(lead => (
                  <TableRow
                    key={lead.id}
                    className={`table-row-hover ${selectedLead?.id === lead.id ? 'bg-[hsl(var(--surface-2))]' : ''}`}
                    data-testid={`lead-row-${lead.id}`}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </TableCell>
                    <TableCell onClick={() => selectLead(lead)}>
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.email || lead.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => selectLead(lead)}><StageBadge stage={lead.stage} /></TableCell>
                    <TableCell onClick={() => selectLead(lead)}>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={lead.status} />
                        {lead.retry_count > 0 && (
                          <span className="text-[10px] text-muted-foreground border border-border px-1 rounded-sm">
                            R:{lead.retry_count}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums" onClick={() => selectLead(lead)}>
                      {lead.ai_score !== null && lead.ai_score !== undefined ? (
                        <span className="text-sm font-medium" style={{ color: lead.ai_score >= 70 ? 'hsl(173,80%,36%)' : lead.ai_score >= 40 ? 'hsl(38,55%,62%)' : 'hsl(0,72%,52%)' }}>
                          {lead.ai_score}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => selectLead(lead)}>
                      {lead.budget_max ? formatCurrency(lead.budget_max) : '--'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" onClick={() => selectLead(lead)}>{lead.assigned_to || '--'}</TableCell>
                  </TableRow>
                ))}
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                          <Users className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">{loading ? 'Loading leads...' : 'No leads found'}</p>
                        <p className="text-xs text-muted-foreground mt-1">{loading ? 'Fetching your data' : 'Try adjusting your filters or add a new lead.'}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
        <p className="text-xs text-muted-foreground mt-2">{total} leads total</p>
      </div>

      {/* Right: Lead Detail */}
      <div className={`${selectedLead ? 'flex' : 'hidden xl:flex'} flex-col w-full xl:w-[45%] min-w-0`}>
        {selectedLead ? (
          <Card className="bg-card border-border flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-5">
                {canGoBack && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-2 gap-1 text-muted-foreground">
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                  </Button>
                )}
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{selectedLead.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedLead.email} | {selectedLead.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StageBadge stage={selectedLead.stage} />
                      {selectedLead.ai_priority && <PriorityBadge priority={selectedLead.ai_priority} />}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Close the lead" onClick={() => setSelectedLead(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Score + Quick Info */}
                <div className="flex items-center gap-6 mb-5 p-4 rounded-xl border border-border bg-[hsl(var(--surface-2))]">
                  <ScoreGauge score={selectedLead.ai_score} size={100} />
                  <div className="flex-1 space-y-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Budget:</span> <span>{formatCurrency(selectedLead.budget_min)} - {formatCurrency(selectedLead.budget_max)}</span></div>
                      <div><span className="text-muted-foreground">Timeline:</span> <span>{selectedLead.timeline || 'N/A'}</span></div>
                      <div><span className="text-muted-foreground">Project:</span> <span>{selectedLead.project || 'N/A'}</span></div>
                      <div><span className="text-muted-foreground">Category:</span> <span>{selectedLead.category || 'N/A'} ({selectedLead.sub_category || 'N/A'})</span></div>
                      <div><span className="text-muted-foreground">Source:</span> <span>{selectedLead.source}</span></div>
                    </div>
                  </div>
                </div>

                {/* AI Explainability - Score Factors */}
                {selectedLead.ai_score_factors?.length > 0 && (
                  <div className="mb-4">
                    <ScoreFactorsPanel factors={selectedLead.ai_score_factors} whyScore={selectedLead.ai_why_score} />
                  </div>
                )}

                {/* AI Summary */}
                {selectedLead.ai_summary && (
                  <div className="mb-4 p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Summary</p>
                    <p className="text-sm">{selectedLead.ai_summary}</p>
                    {selectedLead.ai_next_actions?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">Recommended Actions:</p>
                        <ul className="text-xs mt-1 space-y-1">
                          {selectedLead.ai_next_actions.map((a, i) => (
                            <li key={i} className="flex items-start gap-1"><ChevronRight className="w-3 h-3 mt-0.5 text-primary shrink-0" /> {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedLead.ai_risks?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">Risks:</p>
                        <ul className="text-xs mt-1 space-y-1">
                          {selectedLead.ai_risks.map((r, i) => (
                            <li key={i} className="text-[hsl(38,92%,65%)]">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* AI qualification and site visits used endpoints the backend no longer has. */}
                <p className="mb-5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                  AI qualification is not available yet.
                </p>

                {/* Calls, stage changes, appointment and do-not-call events in one list. */}
                <section aria-labelledby="prospect-timeline">
                  <h4 id="prospect-timeline" className="text-sm font-semibold mb-3">Timeline</h4>
                  <ProspectTimeline prospectId={selectedLead.id} />
                </section>
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <Card className="bg-card border-border flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a lead to view details</p>
            </div>
          </Card>
        )}
      </div>

      {/* Bulk Action Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Bulk Actions ({selectedIds.size} leads)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border" data-testid="bulk-action-select">
                <SelectValue placeholder="Choose Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qualify">AI Qualify All</SelectItem>
                <SelectItem value="assign">Assign To</SelectItem>
                <SelectItem value="stage">Update Stage</SelectItem>
              </SelectContent>
            </Select>

            {bulkAction === 'assign' && (
              <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
                <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Priya Sharma">Priya Sharma</SelectItem>
                  <SelectItem value="Amit Patel">Amit Patel</SelectItem>
                  <SelectItem value="Neha Gupta">Neha Gupta</SelectItem>
                  <SelectItem value="Rahul Verma">Rahul Verma</SelectItem>
                </SelectContent>
              </Select>
            )}

            {bulkAction === 'stage' && (
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                  <SelectValue placeholder="New Stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {bulkAction === 'qualify' && (
              <p className="text-xs text-muted-foreground">
                This will run AI qualification on {selectedIds.size} leads sequentially. This may take a few minutes.
              </p>
            )}

            <Button
              onClick={handleBulkAction}
              disabled={!bulkAction || bulkRunning || (bulkAction === 'assign' && !bulkAssignTo) || (bulkAction === 'stage' && !bulkStage)}
              className="w-full bg-primary text-primary-foreground"
              data-testid="bulk-action-execute"
            >
              {bulkRunning ? 'Processing...' : `Execute on ${selectedIds.size} leads`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
