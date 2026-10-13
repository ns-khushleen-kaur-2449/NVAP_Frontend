import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Rocket, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LeadTimelineDialog from '@/components/shared/LeadTimelineDialog';
import AiFilterSearch from '@/components/prospecting/AiFilterSearch';
import ApolloPreview from '@/components/prospecting/ApolloPreview';
import { getMyLeads, deleteMyLead } from '@/lib/api';

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
  const [myLeads, setMyLeads] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [selectedMine, setSelectedMine] = useState(new Set());
  const [timelineLead, setTimelineLead] = useState(null);
  const navigate = useNavigate();

  // My leads load the first time that tab is opened, not on page load.
  const mineLoaded = useRef(false);
  const mineLoading = useRef(false);

  const loadMyLeads = () => {
    mineLoading.current = true;
    return getMyLeads().then((r) => { setMyLeads(r.data); mineLoaded.current = true; }).catch((e) => {
      console.error('Failed to load My Leads:', e);
      toast.error(e.response?.data?.detail || e.message || 'Failed to load your leads');
      setMyLeads([]);
    }).finally(() => { mineLoading.current = false; setLoadingMine(false); });
  };

  // Apollo Preview is first rendered when its tab is opened, then kept so its filter survives tab changes.
  const [apolloOpened, setApolloOpened] = useState(false);

  // A failed load leaves mineLoaded false, so opening the tab again retries.
  const onTabChange = (tab) => {
    if (tab === 'apollo') setApolloOpened(true);
    if (tab !== 'mine' || mineLoaded.current || mineLoading.current) return;
    setLoadingMine(true);
    loadMyLeads();
  };

  const toggleMine = (id) => setSelectedMine((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
        <p className="text-sm text-muted-foreground mt-1">Search and filter the prospects you already have. Describe who you are looking for in plain English, or review your saved leads.</p>
      </div>

      <Tabs defaultValue="search" onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="search">Search leads</TabsTrigger>
          <TabsTrigger value="mine">My leads {myLeads.length > 0 && `(${myLeads.length})`}</TabsTrigger>
          <TabsTrigger value="apollo">Apollo Preview</TabsTrigger>
        </TabsList>

        {/* Search leads and Apollo Preview stay mounted while hidden, so each keeps its own filter and results. */}
        <TabsContent value="search" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <AiFilterSearch />
        </TabsContent>

        {apolloOpened && (
          <TabsContent value="apollo" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <ApolloPreview />
          </TabsContent>
        )}

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
