import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Download, Rocket, Trash2, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LeadTimelineDialog from '@/components/shared/LeadTimelineDialog';
import { searchProspects, importProspects, getMyLeads, deleteMyLead } from '@/lib/api';

function ScoreBadge({ score }) {
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-500/10' : score >= 55 ? 'text-amber-600 bg-amber-500/10' : 'text-muted-foreground bg-secondary';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{score ?? '--'}</span>;
}

function LeadStatusBadge({ status }) {
  const map = {
    hot: { label: '🔥 Hot Lead', color: 'text-rose-400 bg-rose-500/15' },
    warm: { label: '🌤️ Warm Lead', color: 'text-amber-500 bg-amber-500/15' },
  };
  const cfg = map[status] || null;
  if (!cfg) return null;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>;
}

function ProspectRow({ p, selected, onToggle, onViewTimeline }) {
  const isSimulated = p.simulated || p.is_simulated;
  const isVoiceLead = p.source === 'voice_lead';
  return (
    <div className="flex items-start gap-3 border border-border rounded-lg p-3 bg-card">
      <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-sm font-medium truncate">{p.name}</div>
            {isSimulated && <Badge variant="outline" className="shrink-0 text-[10px]">Simulated</Badge>}
            {isVoiceLead && <Badge variant="outline" className="shrink-0 text-[10px]">From Voice Agent</Badge>}
          </div>
          {isVoiceLead ? <LeadStatusBadge status={p.lead_status} /> : <ScoreBadge score={p.score} />}
        </div>
        <div className="text-xs text-muted-foreground">{p.title}{p.company ? ` · ${p.company}` : ''}</div>
        <div className="text-xs text-muted-foreground">{[p.industry, p.city, p.country].filter(Boolean).join(' · ')}</div>
        {p.phone && <div className="text-xs mt-1">{p.phone}</div>}
        {p.email && <div className="text-xs mt-1">{p.email} {p.verified_email && <Badge variant="secondary" className="ml-1">verified</Badge>}</div>}
        {p.match_reasons?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {p.match_reasons.map((r, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--surface-2))] text-muted-foreground">{r}</span>)}
          </div>
        )}
        {isVoiceLead && onViewTimeline && (
          <button onClick={onViewTimeline} className="flex items-center gap-1 text-[10px] text-primary underline mt-2">
            <History className="w-3 h-3" /> View journey
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProspectingPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [resultsSimulated, setResultsSimulated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const [myLeads, setMyLeads] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [selectedMine, setSelectedMine] = useState(new Set());
  const [timelineLead, setTimelineLead] = useState(null);
  const navigate = useNavigate();

  const loadMyLeads = () => getMyLeads().then((r) => setMyLeads(r.data)).catch((e) => {
    console.error('Failed to load My Leads:', e);
    toast.error(e.response?.data?.detail || e.message || 'Failed to load your leads');
    setMyLeads([]);
  }).finally(() => setLoadingMine(false));
  useEffect(() => { loadMyLeads(); }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelectedSearch(new Set());
    try {
      const { data } = await searchProspects(query);
      // Apollo ids are unique, but simulated rows all have apollo_id=null — give every
      // row a stable client-side selection key so simulated rows don't collide.
      const withKeys = data.results.map((r, i) => ({ ...r, _key: r.apollo_id || `sim-${i}` }));
      setResults(withKeys);
      setResultsSimulated(data.simulated);
      if (data.simulated) toast.warning('Apollo is unavailable — showing simulated results for this query instead.');
      else if (data.results.length === 0) toast.info('No matches from Apollo for that description');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Search failed');
    }
    setSearching(false);
  };

  const toggleSearch = (key) => setSelectedSearch((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleMine = (id) => setSelectedMine((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const importSelected = async () => {
    const toImport = results.filter((r) => selectedSearch.has(r._key));
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const { data } = await importProspects(toImport);
      toast.success(`Imported ${data.imported} prospects into My Leads`);
      setSelectedSearch(new Set());
      loadMyLeads();
    } catch (e) {
      toast.error('Import failed');
    }
    setImporting(false);
  };

  const removeMine = async (id) => {
    try { await deleteMyLead(id); loadMyLeads(); } catch (e) { toast.error('Failed to remove'); }
  };

  const runCampaign = () => {
    const ids = Array.from(selectedMine);
    if (ids.length === 0) return;
    navigate('/strategist', { state: { prospectIds: ids, prospectCount: ids.length } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" /> Prospecting
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Describe your buyer in plain English. Get a scored, explainable list — sourced live from Apollo.</p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="search">Search leads</TabsTrigger>
          <TabsTrigger value="mine">My leads {myLeads.length > 0 && `(${myLeads.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="e.g. VP of Sales at 50-200 person SaaS companies in Austin" className="flex-1" />
            <Button onClick={runSearch} disabled={searching} className="bg-primary text-primary-foreground">
              <Sparkles className="w-4 h-4 mr-1" /> {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>

          {resultsSimulated && results.length > 0 && (
            <Card className="card-base p-3 flex items-center gap-2 border-amber-500/40 bg-amber-500/5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">Apollo access is unavailable on your plan — these results are AI-simulated, not real Apollo contacts. Upgrade Apollo to get live data.</p>
            </Card>
          )}

          {selectedSearch.size > 0 && (
            <Button size="sm" variant="outline" onClick={importSelected} disabled={importing}>
              <Download className="w-3.5 h-3.5 mr-1" /> {importing ? 'Importing…' : `Import ${selectedSearch.size} selected`}
            </Button>
          )}

          <div className="space-y-2">
            {results.map((p) => (
              <ProspectRow key={p._key} p={p} selected={selectedSearch.has(p._key)} onToggle={() => toggleSearch(p._key)} />
            ))}
            {!searching && results.length === 0 && (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                Search above to find prospects.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          {selectedMine.size > 0 && (
            <Button size="sm" onClick={runCampaign} className="bg-primary text-primary-foreground">
              <Rocket className="w-3.5 h-3.5 mr-1" /> Run campaign on {selectedMine.size} selected →
            </Button>
          )}
          <div className="space-y-2">
            {myLeads.map((p) => (
              <div key={p.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <ProspectRow
                    p={p}
                    selected={selectedMine.has(p.id)}
                    onToggle={() => toggleMine(p.id)}
                    onViewTimeline={p.source === 'voice_lead' ? () => setTimelineLead(p) : null}
                  />
                </div>
                {p.source !== 'voice_lead' && (
                  <Button size="icon" variant="ghost" onClick={() => removeMine(p.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                )}
              </div>
            ))}
            {!loadingMine && myLeads.length === 0 && (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                No saved prospects yet — import some from Search leads.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <LeadTimelineDialog
        leadId={timelineLead?.id}
        leadName={timelineLead?.name}
        open={!!timelineLead}
        onOpenChange={(v) => !v && setTimelineLead(null)}
      />
    </div>
  );
}
