import { useState, useMemo } from 'react';
import { ChevronDown, Download, Mail, GitCompare, Loader2, Trophy, Phone, Search } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { emailExecutiveComparison, downloadBlob } from '@/lib/api';
import { toast } from 'sonner';

const COMPARE_COLORS = ['#F87217', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488'];

function MultiEmailInput({ emails, onChange }) {
  const [val, setVal] = useState('');
  const add = () => {
    const parts = val.trim().replace(/,+$/, '').split(/[,;\s]+/).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...emails, ...parts])]);
    setVal('');
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !val && emails.length) onChange(emails.slice(0, -1));
  };
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5 flex flex-wrap gap-1.5 focus-within:ring-1 focus-within:ring-[#F87217]/40">
      {emails.map((em) => (
        <span key={em} className="inline-flex items-center gap-1 bg-[#F87217]/10 text-[#F87217] text-xs px-2 py-0.5 rounded-full">
          {em}
          <button type="button" onClick={() => onChange(emails.filter((e) => e !== em))} className="hover:text-red-500 leading-none">&times;</button>
        </span>
      ))}
      <input
        type="email"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={emails.length ? '' : 'recipient@example.com, …'}
        className="flex-1 min-w-[160px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

const scoreHex = (s) => (s == null ? '#9ca3af' : s >= 75 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626');
const initials = (name = '') => name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

function CompareDialog({ open, onOpenChange, cards, onDownload, onSendMail }) {
  const [emailMode, setEmailMode] = useState(false);
  const [emailsTo, setEmailsTo] = useState([]);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!emailsTo.length) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      await onSendMail(emailsTo);
      setEmailMode(false);
      setEmailsTo([]);
    } catch {
      /* onSendMail surfaces its own error toast */
    } finally {
      setSending(false);
    }
  };

  const dimLabels = [];
  cards.forEach((c) => Object.keys(c.dimension_avgs || {}).forEach((l) => {
    if (!dimLabels.includes(l)) dimLabels.push(l);
  }));

  const cellCls = (s) =>
    s == null ? 'text-muted-foreground'
    : s >= 75 ? 'text-emerald-600 font-semibold'
    : s >= 50 ? 'text-amber-600 font-semibold'
    : 'text-red-600 font-semibold';

  const bestInRow = (vals) => {
    const nums = vals.filter((v) => v != null);
    return nums.length ? Math.max(...nums) : null;
  };

  // Radar data: one row per dimension, a key per executive
  const radarData = dimLabels.map((label) => {
    const row = { dimension: label };
    cards.forEach((c) => { row[c.username] = c.dimension_avgs?.[label] ?? 0; });
    return row;
  });

  // Bar data: overall avg per executive
  const overallData = cards.map((c) => ({ name: c.username, score: c.avg_score ?? 0 }));

  const topExec = cards.reduce((a, b) => ((b.avg_score ?? 0) > (a.avg_score ?? 0) ? b : a), cards[0] || {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Sticky header */}
        <div className="shrink-0 border-b border-border pb-3 space-y-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#F87217]" />
              Comparing {cards.length} Executives
            </DialogTitle>
          </DialogHeader>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onDownload}>
              <Download className="w-4 h-4 text-[#F87217]" /> Download Report
            </Button>
            {!emailMode ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEmailMode(true)}>
                <Mail className="w-4 h-4 text-[#F87217]" /> Send via Mail
              </Button>
            ) : (
              <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <MultiEmailInput emails={emailsTo} onChange={setEmailsTo} />
                    <p className="text-[11px] text-muted-foreground mt-1">Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">,</kbd> to add multiple addresses.</p>
                  </div>
                  <Button size="sm" onClick={handleSend} disabled={sending || !emailsTo.length}>
                    {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
                    Send{emailsTo.length > 1 ? ` (${emailsTo.length})` : ''}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEmailMode(false); setEmailsTo([]); }}>Cancel</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Type an address and press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">,</kbd> to add multiple recipients.</p>
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, minmax(0, 1fr))` }}>
            {cards.map((c, i) => (
              <div key={c.username} className="rounded-xl border border-border p-4 bg-card relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                  >
                    {initials(c.username)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {c.username}
                      {c.username === topExec.username && cards.length > 1 && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" /> {c.call_count} call{c.call_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-bold tabular-nums" style={{ color: scoreHex(c.avg_score) }}>
                    {c.avg_score ?? '—'}
                  </span>
                  <span className="text-[11px] text-muted-foreground mb-1">/100 avg</span>
                </div>
                {c.best_dimension && (
                  <p className="text-[11px] text-emerald-600 mt-1.5 truncate">💪 {c.best_dimension}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable charts + table */}
        <div className="overflow-y-auto flex-1 pt-4 space-y-6">

          {/* Overall score bar chart */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Overall Score</p>
            <ResponsiveContainer width="100%" height={Math.max(140, cards.length * 46)}>
              <BarChart data={overallData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <RTooltip cursor={{ fill: 'rgba(49,63,128,0.05)' }} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={22} label={{ position: 'right', fontSize: 11 }} fill="#F87217"
                  shape={(props) => {
                    const { x, y, width, height, value } = props;
                    return <rect x={x} y={y} width={width} height={height} fill={scoreHex(value)} rx={6} ry={6} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar — dimension comparison */}
          {dimLabels.length >= 3 && (
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dimension Profile</p>
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} angle={90} />
                  {cards.map((c, i) => (
                    <Radar
                      key={c.username}
                      name={c.username}
                      dataKey={c.username}
                      stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      fill={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <RTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3 border-b border-border">
              Detailed Breakdown
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground sticky left-0 bg-background">Metric</th>
                    {cards.map((c, i) => (
                      <th key={c.username} className="px-3 py-2 border-b border-border text-left">
                        <span className="font-semibold inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
                          {c.username}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimLabels.map((label) => {
                    const vals = cards.map((c) => c.dimension_avgs?.[label] ?? null);
                    const best = bestInRow(vals);
                    return (
                      <tr key={label} className="border-t border-border/60">
                        <td className="px-3 py-2.5 text-muted-foreground sticky left-0 bg-background">{label}</td>
                        {vals.map((v, i) => (
                          <td key={i} className={`px-3 py-2.5 tabular-nums ${cellCls(v)}`}>
                            {v ?? '—'}{v === best && best != null && <span className="ml-1 text-[10px]">🏆</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Multi-select executives → action popup (Download / Email / Compare).
 * Renders a "Select executives" button plus all the dialogs it manages.
 * @param {Array} scorecards - per-executive aggregates with { username, avg_score, call_count, dimension_avgs }
 */
export default function ExecutiveCompareControl({ scorecards = [], align = 'end' }) {
  const [compareSel, setCompareSel] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCards = useMemo(
    () => scorecards.filter((c) => compareSel.includes(c.username)),
    [scorecards, compareSel],
  );

  const toggleCompare = (username) =>
    setCompareSel((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );

  const openCompare = () => {
    setPickerOpen(false);
    setCompareOpen(true);
  };

  const downloadComparisonCsv = () => {
    const dimLabels = [];
    selectedCards.forEach((c) => Object.keys(c.dimension_avgs || {}).forEach((l) => {
      if (!dimLabels.includes(l)) dimLabels.push(l);
    }));
    const header = ['Metric', ...selectedCards.map((c) => c.username)];
    const rows = [
      ['Overall Avg', ...selectedCards.map((c) => c.avg_score ?? '')],
      ['Calls Analysed', ...selectedCards.map((c) => c.call_count ?? '')],
      ...dimLabels.map((label) => [label, ...selectedCards.map((c) => c.dimension_avgs?.[label] ?? '')]),
    ];
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `executive_comparison_${Date.now()}.csv`);
    toast.success('Comparison downloaded');
  };

  const sendMailTo = async (emailList) => {
    try {
      await Promise.all(
        emailList.map((to) =>
          emailExecutiveComparison({ usernames: compareSel, to_email: to, cards: selectedCards })
        )
      );
      toast.success(`Comparison emailed to ${emailList.length} recipient${emailList.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send email');
      throw err;
    }
  };

  return (
    <>
      <Popover open={pickerOpen} onOpenChange={(v) => { setPickerOpen(v); if (!v) { setCompareSel([]); setSearch(''); } }}>
        <PopoverTrigger asChild>
          <Button size="sm" className="h-9 gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm">
            <GitCompare className="w-4 h-4" />
            Compare
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} side="bottom" avoidCollisions={false} className="w-64 p-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">Select executives</span>
            {compareSel.length > 0 && (
              <button onClick={() => setCompareSel([])} className="text-[11px] text-[#F87217] hover:underline">
                Clear
              </button>
            )}
          </div>
          <div className="px-2 pt-2 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-[hsl(var(--surface-2))] outline-none focus:ring-1 focus:ring-[#F87217]/40"
              />
            </div>
          </div>
          <ScrollArea className="max-h-52">
            <div className="p-1">
              {scorecards.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">No executives yet.</p>
              ) : scorecards.filter((c) => c.username.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">No match found.</p>
              ) : scorecards.filter((c) => c.username.toLowerCase().includes(search.toLowerCase())).map((c) => (
                <label
                  key={c.username}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--surface-2))] cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={compareSel.includes(c.username)}
                    onCheckedChange={() => toggleCompare(c.username)}
                  />
                  <span className="flex-1 truncate">{c.username}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{c.avg_score}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="p-2 border-t border-border space-y-1.5">
            {compareSel.length < 2 && (
              <p className="text-[11px] text-muted-foreground text-center">Pick at least 2 executives</p>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={compareSel.length < 2}
              onClick={openCompare}
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5" />
              Compare {compareSel.length >= 2 && `(${compareSel.length})`}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <CompareDialog
        open={compareOpen}
        onOpenChange={(v) => { setCompareOpen(v); if (!v) setCompareSel([]); }}
        cards={selectedCards}
        onDownload={downloadComparisonCsv}
        onSendMail={sendMailTo}
      />
    </>
  );
}
