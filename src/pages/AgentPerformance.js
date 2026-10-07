import { useEffect, useState } from 'react';
import { Users, Upload, Star, RefreshCw, FileText, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listExecutives, listPrerequisiteDocs, uploadPrerequisiteDoc, matchExecutives } from '@/lib/api';
import { toast } from 'sonner';

const DIMS = [
  { key: 'avg_introduction', label: 'Introduction/Hook' },
  { key: 'avg_adherence', label: 'Adherence to script/Product Knowledge' },
  { key: 'avg_listening', label: 'Actively listening/ Responding Appropriately' },
  { key: 'avg_fumble', label: 'Fumble' },
  { key: 'avg_probing', label: 'Probing' },
  { key: 'avg_closing', label: 'Closing' },
  { key: 'avg_objection', label: 'Objection Handling' },
  { key: 'avg_value_proposition', label: 'Site Visit Persuasion' },
];

const rankColors = ['text-amber-500', 'text-[#F87217]', 'text-[#4a5aa0]'];
const rankBg = ['bg-amber-500/10', 'bg-[#F87217]/10', 'bg-[#F87217]/8'];

function ScoreBar({ value }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs w-6 text-right text-muted-foreground">{Math.round(value)}</span>
    </div>
  );
}

function ExecutiveRow({ rank, exec, matchResult, expanded, onToggle }) {
  const hasRank = rank <= 3;
  return (
    <Card className={`transition-all ${hasRank ? rankBg[rank - 1] : ''}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4 cursor-pointer" onClick={onToggle}>
          {/* Rank badge */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
            ${hasRank ? `${rankColors[rank - 1]} border border-current` : 'text-muted-foreground border border-border'}`}>
            {rank <= 3 ? <Trophy className="w-4 h-4" /> : rank}
          </div>

          {/* Name & calls */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{exec.username}</p>
            <p className="text-xs text-muted-foreground">{exec.total_calls} call{exec.total_calls !== 1 ? 's' : ''} analysed</p>
          </div>

          {/* Similarity score (shown after matching) */}
          {matchResult && (
            <div className="text-center flex-shrink-0">
              <p className={`font-bold text-lg ${matchResult.similarity_score >= 70 ? 'text-[#F87217]' : matchResult.similarity_score >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                {matchResult.similarity_score}
              </p>
              <p className="text-[10px] text-muted-foreground">match %</p>
            </div>
          )}

          {/* Overall score */}
          <div className="text-center flex-shrink-0">
            <p className="font-display text-xl font-bold">
              {exec.avg_overall_score != null ? Math.round(exec.avg_overall_score) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">overall</p>
          </div>

          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Score breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {DIMS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
                  <div className="flex-1"><ScoreBar value={exec[key]} /></div>
                </div>
              ))}
            </div>

            {/* Match reasoning */}
            {matchResult && (
              <div className="bg-[hsl(var(--surface-2))] rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" /> Match Analysis
                </p>
                <p className="text-xs text-muted-foreground">{matchResult.match_reasoning}</p>
                {matchResult.strengths?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {matchResult.strengths.map((s, i) => (
                      <span key={i} className="text-[10px] bg-[#F87217]/10 text-[#F87217] px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                )}
                {matchResult.gaps?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {matchResult.gaps.map((g, i) => (
                      <span key={i} className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">{g}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentPerformancePage() {
  const [executives, setExecutives] = useState([]);
  const [docs, setDocs] = useState([]);
  const [matchMap, setMatchMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [matched, setMatched] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [exRes, docRes] = await Promise.all([listExecutives(), listPrerequisiteDocs()]);
      setExecutives(exRes.data || []);
      setDocs(docRes.data || []);
    } catch {
      toast.error('Failed to load executive data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDocUpload = async (file) => {
    if (!file) return;
    const toastId = toast.loading('Uploading document…');
    try {
      const { data } = await uploadPrerequisiteDoc(file, '');
      const { data: docs } = await listPrerequisiteDocs();
      setDocs(docs || []);
      setSelectedDoc(data?.id || null);
      toast.success('Document uploaded', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: toastId });
    }
  };

  const handleMatch = async () => {
    if (!selectedDoc) { toast.error('Select a prerequisite document first'); return; }
    setMatching(true);
    try {
      const { data } = await matchExecutives(selectedDoc);
      const map = {};
      (data || []).forEach((r) => { map[r.username] = r; });
      setMatchMap(map);
      const sorted = [...executives].sort(
        (a, b) => (map[b.username]?.similarity_score ?? 0) - (map[a.username]?.similarity_score ?? 0)
      );
      setExecutives(sorted);
      setMatched(true);
      toast.success('Executives ranked by document match');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Matching failed');
    } finally {
      setMatching(false);
    }
  };

  const toggleExpand = (username) =>
    setExpanded((prev) => ({ ...prev, [username]: !prev[username] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Agent Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select the best-fit executive by matching their call history against your requirements document.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Document selection panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Match Executives to Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a document describing your call requirements (e.g. product knowledge, objection handling style).
            Groq will score each executive by how well their call history matches.
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Document selector */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Saved requirements documents</label>
              <select
                className="bg-[hsl(var(--surface-2))] border border-border rounded-md px-3 py-2 text-sm min-w-[200px]"
                value={selectedDoc || ''}
                onChange={(e) => { setSelectedDoc(e.target.value ? Number(e.target.value) : null); setMatched(false); }}
              >
                <option value="">— select document —</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
              </select>
            </div>

            {/* Upload new */}
            <label className="cursor-pointer">
              <input type="file" accept=".txt,.pdf" className="hidden"
                onChange={(e) => handleDocUpload(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="w-4 h-4 mr-2" /> Upload New (.txt / .pdf)</span>
              </Button>
            </label>

            {/* Run match */}
            <Button onClick={handleMatch} disabled={matching || !selectedDoc} size="sm">
              <Star className={`w-4 h-4 mr-2 ${matching ? 'animate-spin' : ''}`} />
              {matching ? 'Analysing…' : 'Rank Executives'}
            </Button>
          </div>

          {matched && (
            <p className="text-xs text-[#F87217] flex items-center gap-1">
              <Star className="w-3 h-3" /> Executives ranked by similarity to selected document. Expand a row to see details.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Executive list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading executives…</div>
      ) : executives.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No executive data yet. Analyse some calls first.
        </div>
      ) : (
        <div className="space-y-3">
          {matched && executives.map((exec, i) => (
            <ExecutiveRow
              key={exec.username}
              rank={i + 1}
              exec={exec}
              matchResult={matchMap[exec.username]}
              expanded={!!expanded[exec.username]}
              onToggle={() => toggleExpand(exec.username)}
            />
          ))}
        </div>
      )}
    </div>
  );
}