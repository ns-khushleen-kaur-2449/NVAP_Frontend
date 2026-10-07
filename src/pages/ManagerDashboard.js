import { useEffect, useState, useMemo } from 'react';

function AnimatedCount({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const end = parseFloat(value);
    if (isNaN(end)) { setDisplay(value); return; }
    if (end === 0) { setDisplay(0); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      const eased = p * (2 - p);
      setDisplay(Math.floor(eased * end));
      if (p < 1) requestAnimationFrame(step);
      else setDisplay(end);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span>{display}{suffix}</span>;
}
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Phone,
  AlertTriangle, Flame, X, BarChart3, Trophy, Search, CalendarDays,
  Download, Mail, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExecutiveCompareControl from '@/components/shared/ExecutiveCompareControl';
import { getManagerDashboard, getAnalysisReports, downloadExecutiveReport, sendExecutiveReportEmail, emailExecutiveComparison, downloadBlob } from '@/lib/api';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────────────
// Score tiers: 80+ green · 60-79 teal · 40-59 amber · <40 coral
const scoreColor = (s) => s >= 80 ? 'text-[#639922]' : s >= 60 ? 'text-[#1D9E75]' : s >= 40 ? 'text-[#BA7517]' : 'text-[#D85A30]';
const scoreBg    = (s) => s >= 80 ? 'bg-[#639922]'   : s >= 60 ? 'bg-[#1D9E75]'   : s >= 40 ? 'bg-[#BA7517]'   : 'bg-[#D85A30]';

const AVATAR_TINTS = [
  { bg: 'bg-[#1D9E75]/12', text: 'text-[#1D9E75]' },
  { bg: 'bg-[#F5A623]/12', text: 'text-[#F5A623]' },
  { bg: 'bg-[#D85A30]/12', text: 'text-[#D85A30]' },
];

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// Tiny inline sparkline
function Sparkline({ values = [], color = '#F87217' }) {
  if (values.length < 2) return null;
  const W = 80, H = 28, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = pad + ((max - v) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// ── Executive card ────────────────────────────────────────────────────────────
function ExecCard({ exec, index = 0, onClick }) {
  const { username, avg_score, call_count, trend_delta, trend_scores,
          best_dimension, worst_dimension } = exec;
  const TrendIcon = trend_delta > 0 ? TrendingUp : trend_delta < 0 ? TrendingDown : Minus;
  const trendCls  = trend_delta > 0 ? 'text-[#1D9E75]' : trend_delta < 0 ? 'text-[#D85A30]' : 'text-muted-foreground';
  const sparkCol  = trend_delta >= 0 ? '#1D9E75' : '#D85A30';
  const needsCoach = avg_score < 40;
  const tint = AVATAR_TINTS[index % AVATAR_TINTS.length];

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-4 bg-card rounded-lg border-[0.5px] px-4 py-2.5 hover:shadow-md transition-all duration-150 cursor-pointer
        ${needsCoach ? 'border-l-4 border-l-[#D85A30] border-[#E5E5E3] hover:border-[#D85A30]/60' : 'border-[#E5E5E3] hover:border-[#1D9E75]/40'}`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0
        ${needsCoach ? 'bg-[#D85A30]/12 text-[#D85A30]' : `${tint.bg} ${tint.text}`}`}>
        {initials(username)}
      </div>

      {/* Name + calls */}
      <div className="w-36 shrink-0 min-w-0">
        <p className="font-medium text-sm text-[#1A1A1A] leading-tight truncate">{username}</p>
        <p className="text-[11px] text-[#6B6B67] flex items-center gap-1">
          <Phone className="w-2.5 h-2.5" /> {call_count} call{call_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Trend */}
      <span className={`w-10 shrink-0 font-bold text-xs flex items-center gap-0.5 ${trendCls}`}>
        <TrendIcon className="w-3.5 h-3.5" />
        {trend_delta !== 0 && Math.abs(trend_delta)}
      </span>

      {/* Score + bar */}
      <div className="flex-1 min-w-[110px] max-w-[220px]">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-[#6B6B67]">Avg Score</span>
          <span className={`font-bold text-sm ${scoreColor(avg_score)}`}>{avg_score}</span>
        </div>
        <div className="w-full bg-[#F5F5F3] rounded-full h-1.5 overflow-hidden">
          <div className={`h-1.5 rounded-full ${scoreBg(avg_score)}`} style={{ width: `${avg_score}%` }} />
        </div>
      </div>

      {/* Tags */}
      <div className="hidden md:flex gap-1.5 flex-wrap shrink-0 max-w-[240px]">
        {best_dimension && (
          <span className="text-[10px] bg-[#1D9E75]/10 text-[#1D9E75] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">💪 {best_dimension}</span>
        )}
        {worst_dimension && worst_dimension !== best_dimension && (
          <span className="text-[10px] bg-[#D85A30]/10 text-[#D85A30] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">⚠ {worst_dimension}</span>
        )}
      </div>

      {/* Sparkline */}
      <div className="hidden lg:block shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
        <Sparkline values={trend_scores} color={sparkCol} />
      </div>
    </div>
  );
}

// ── Shared email input ────────────────────────────────────────────────────────
function MultiEmailInput({ emails, onChange }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft.split(/[,;\s]+/).filter(Boolean);
    if (parts.length) onChange([...emails, ...parts.filter(e => !emails.includes(e))]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 border border-border rounded-md p-2 min-h-[40px] bg-background focus-within:ring-1 focus-within:ring-ring">
      {emails.map(e => (
        <span key={e} className="flex items-center gap-1 bg-[#F87217]/10 text-[#F87217] text-xs px-2 py-0.5 rounded-full">
          {e}
          <button onClick={() => onChange(emails.filter(x => x !== e))} className="hover:text-red-500 leading-none">&times;</button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[140px] text-xs outline-none bg-transparent"
        placeholder={emails.length ? '' : 'recipient@example.com — press , or Enter for multiple'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        onBlur={commit}
      />
    </div>
  );
}

// ── Drill-down dialog ────────────────────────────────────────────────────────
function DrillDown({ exec, onClose }) {
  const open = !!exec;
  const [mounted, setMounted] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Key the reset on WHICH exec is drilled into, not on the object reference: the
  // parent rebuilds scorecards on every poll, so depending on `exec` itself would
  // replay the fade-in on each refresh. hasExec is a separate dep so open/close is
  // still detected even if two states share a username key.
  const execKey = exec?.username;
  const hasExec = !!exec;

  useEffect(() => {
    setMounted(false);
    setEmailOpen(false);
    setEmails([]);
    if (hasExec) {
      const t = setTimeout(() => setMounted(true), 80);
      return () => clearTimeout(t);
    }
  }, [execKey, hasExec]);

  if (!exec) return <Dialog open={false} onOpenChange={onClose}><DialogContent /></Dialog>;

  const { username, avg_score, call_count, trend_delta, trend_scores,
          best_dimension, worst_dimension, dimension_avgs } = exec;

  const TrendIcon = trend_delta > 0 ? TrendingUp : trend_delta < 0 ? TrendingDown : Minus;
  const trendCls  = trend_delta > 0 ? 'text-emerald-500' : trend_delta < 0 ? 'text-red-500' : 'text-muted-foreground';
  const chartData = trend_scores.map((v, i) => ({ call: `#${i + 1}`, score: v }));
  const dimEntries = Object.entries(dimension_avgs || {}).sort((a, b) => b[1] - a[1]);

  const coachingTip = (dim) => {
    if (!dim) return '';
    const tips = {
      'Site Visit Persuasion': 'Consistently missing the site visit invitation. End each call with: "Aap ek baar site dekhein — decision lena aasaan hoga."',
      'Probing': 'Jumping to product details too early. Ask about budget and timeline before pitching: "Aapka rough investment range kya hai?"',
      'Closing': 'Calls end without a clear next step. Always close with a specific action: a callback time, site visit date, or follow-up.',
      'Objection Handling': 'Prospect concerns are not being addressed effectively. Acknowledge, then reframe: "Main samajh sakta hoon — lekin yeh consider karein..."',
      'Introduction/Hook': 'Company name not stated clearly at the start. Open with name + company + reason for calling within the first 15 seconds.',
      'Fumble': 'Filler words and hesitations detected. Practice key responses for common questions to build fluency and confidence.',
      'Adherence to script/Product Knowledge': 'Key script elements are being missed. Review the standard pitch structure before each call.',
      'Actively listening/ Responding Appropriately': 'Responses are not always tailored to what the prospect said. Pause before responding and acknowledge their point first.',
    };
    return tips[dim] || `Focus on improving ${dim} in upcoming calls.`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F87217]/10 text-[#F87217] flex items-center justify-center font-bold shrink-0">
              {initials(username)}
            </div>
            <div>
              <p className="font-bold text-foreground leading-tight">{username}</p>
              <p className="text-xs text-muted-foreground font-normal">{call_count} calls analysed · Avg {avg_score}/100</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── Action bar ── */}
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => {
            const dimLabels = Object.keys(dimension_avgs || {});
            const header = ['Executive', 'Avg Score', 'Calls Analysed', ...dimLabels];
            const row = [username, avg_score ?? '', call_count ?? '', ...dimLabels.map(l => dimension_avgs[l] ?? '')];
            const csv = [header, row].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${username}_report_${Date.now()}.csv`);
            toast.success('Report downloaded');
          }}>
            <Download className="w-4 h-4" /> Download
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setEmailOpen(v => !v)}>
            <Mail className="w-4 h-4" /> Send via Email
          </Button>
        </div>
        {emailOpen && (
          <div className="space-y-2 pb-3 border-b border-border">
            <MultiEmailInput emails={emails} onChange={setEmails} />
            <p className="text-[11px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">,</kbd> to add multiple addresses.</p>
            <Button size="sm" className="w-full bg-[#F87217] hover:bg-[#C2560E] text-white"
              disabled={sending || !emails.length}
              onClick={async () => {
                setSending(true);
                try {
                  await Promise.all(emails.map(to => emailExecutiveComparison({ usernames: [username], to_email: to, cards: [exec] })));
                  toast.success(`Sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`);
                  setEmailOpen(false); setEmails([]);
                } catch { toast.error('Failed to send'); }
                finally { setSending(false); }
              }}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send{emails.length > 1 ? ` (${emails.length})` : ''}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">

          {/* Left: Trend chart + dimension breakdown */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Score Trend</p>
              {chartData.length >= 2 ? (
                <div className="h-44 bg-[hsl(var(--surface-2))] rounded-lg p-2 border border-border">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart key={username} data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="call" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#d1d5db" width={28} />
                      <RechartTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(v) => [`${v}`, 'Score']}
                      />
                      <Line type="monotone" dataKey="score" stroke="#F87217" strokeWidth={2.5}
                        dot={{ r: 3, fill: '#F87217' }} activeDot={{ r: 5 }}
                        isAnimationActive={true} animationDuration={1400} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 bg-[hsl(var(--surface-2))] rounded-lg flex items-center justify-center text-sm text-muted-foreground border border-border">
                  Need at least 2 calls for a trend
                </div>
              )}
              <div className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${trendCls}`}>
                <TrendIcon className="w-4 h-4" />
                {trend_delta > 0 ? `Improving (+${trend_delta} pts)` :
                 trend_delta < 0 ? `Declining (${trend_delta} pts)` : 'Stable'}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Dimension Breakdown</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {dimEntries.map(([label, score], idx) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-semibold ${scoreColor(score)}`}>{score}</span>
                    </div>
                    <div className="w-full bg-[hsl(var(--surface-2))] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${scoreBg(score)}`}
                        style={{
                          width: mounted ? `${score}%` : '0%',
                          transition: `width 600ms cubic-bezier(0.34,1.2,0.64,1) ${idx * 70}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Coaching tips */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">🤖 Coaching Tips</p>
            <div className="space-y-3">
              {worst_dimension && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    Needs Work — {worst_dimension} ({dimension_avgs?.[worst_dimension] ?? '?'})
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{coachingTip(worst_dimension)}</p>
                </div>
              )}
              {best_dimension && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    Strength 💪 — {best_dimension} ({dimension_avgs?.[best_dimension] ?? '?'})
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Consistently strong here. Use this as an anchor to build confidence in weaker areas.
                  </p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Overall — {avg_score}/100</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {avg_score >= 75 ? 'Strong performer. Focus on consistency across all calls.' :
                   avg_score >= 50 ? 'Good foundation. Address weak dimensions to push past 75.' :
                   'Needs structured coaching. Recommend a 1-on-1 session focusing on the weakest areas.'}
                </p>
              </div>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ── Review Call Dialog ────────────────────────────────────────────────────────
const REVIEW_DIMS = [
  { key: 'introduction_score',                       label: 'Introduction' },
  { key: 'probing_effectiveness',                    label: 'Probing' },
  { key: 'adherence_script_product_knowledge_score', label: 'Script Adherence' },
  { key: 'actively_listening_responding_score',      label: 'Active Listening' },
  { key: 'fumble_score',                             label: 'Fumble' },
  { key: 'call_closing_quality',                     label: 'Call Closing' },
  { key: 'objection_handling_score',                 label: 'Objection Handling' },
  { key: 'value_proposition_score',                  label: 'Site Visit Persuasion' },
];

function ReviewCallDialog({ call, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // As in DrillDown: key on which call is open, not the object reference. audio_id
  // can legitimately be absent (it is guarded at render time), so hasCall carries
  // open/close on its own rather than relying on the key changing.
  const callKey = call?.audio_id;
  const hasCall = !!call;

  useEffect(() => {
    setMounted(false);
    setEmailOpen(false);
    setEmails([]);
    if (hasCall) { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }
  }, [callKey, hasCall]);

  if (!call) return <Dialog open={false} onOpenChange={onClose}><DialogContent /></Dialog>;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadExecutiveReport(call.audio_id);
      downloadBlob(res.data, `${call.username || 'call'}_${call.audio_id}_report.xlsx`);
      toast.success('Report downloaded');
    } catch { toast.error('Download failed'); }
    finally { setDownloading(false); }
  };

  const handleSend = async () => {
    if (!emails.length) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      await Promise.all(emails.map(to => sendExecutiveReportEmail(call.audio_id, { to_email: to })));
      toast.success(`Sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`);
      setEmailOpen(false); setEmails([]);
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const dims = REVIEW_DIMS.map(({ key, label }) => ({ label, score: Math.round(call[key] ?? 0) }));

  return (
    <Dialog open={!!call} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
              {initials(call.username)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground leading-tight">{call.username || '—'}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {call.phone_number && call.phone_number !== 'Unknown' && (
                  <span className="font-mono mr-2">{call.phone_number}</span>
                )}
                {fmt(call.start_time || call.created_at)}
              </p>
              {call.audio_id && (
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  Recording ID: <span className="text-foreground">{call.audio_id}</span>
                </p>
              )}
            </div>
            <span className={`text-2xl font-extrabold tabular-nums ${scoreColor(call.overall_score)}`}>
              {call.overall_score != null ? Math.round(call.overall_score) : '—'}<span className="text-sm font-normal text-muted-foreground">/100</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Action bar ── */}
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Button size="sm" variant="outline" className="gap-2" disabled={downloading} onClick={handleDownload}>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setEmailOpen(v => !v)}>
            <Mail className="w-4 h-4" /> Send via Email
          </Button>
        </div>
        {emailOpen && (
          <div className="space-y-2 pb-3 border-b border-border">
            <MultiEmailInput emails={emails} onChange={setEmails} />
            <p className="text-[11px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">,</kbd> to add multiple addresses.</p>
            <Button size="sm" className="w-full bg-[#F87217] hover:bg-[#C2560E] text-white"
              disabled={sending || !emails.length} onClick={handleSend}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send{emails.length > 1 ? ` (${emails.length})` : ''}
            </Button>
          </div>
        )}

        <div className="space-y-5 pt-2">
          {/* Overall bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div className={`h-2 rounded-full ${scoreBg(call.overall_score)} transition-all duration-700`}
              style={{ width: mounted ? `${call.overall_score ?? 0}%` : '0%' }} />
          </div>

          {/* Outcome */}
          {call.outcome_category && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Outcome:</span>
              <span className="bg-[#F87217]/10 text-[#F87217] px-2 py-0.5 rounded-full font-medium">{call.outcome_category}</span>
            </div>
          )}

          {/* Dimension breakdown */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Dimension Breakdown</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {dims.map(({ label, score }, idx) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-semibold ${scoreColor(score)}`}>{score}</span>
                  </div>
                  <div className="w-full bg-[hsl(var(--surface-2))] rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${scoreBg(score)}`}
                      style={{ width: mounted ? `${score}%` : '0%', transition: `width 600ms cubic-bezier(0.34,1.2,0.64,1) ${idx * 60}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {call.summary && (
            <div className="bg-[hsl(var(--surface-2))] rounded-lg p-3 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">AI Summary</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{call.summary}</p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0];

const callDate = (c) => {
  const raw = c.start_time || c.created_at;
  if (!raw) return null;
  return new Date(raw).toLocaleDateString('en-CA');
};

export default function ManagerDashboard() {
  const [data, setData]         = useState(null);
  const [calls, setCalls]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [reviewCall, setReviewCall] = useState(null);
  const [execSearch, setExecSearch] = useState('');
  const [summaryDate, setSummaryDate] = useState(todayISO());

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: d }, { data: callData }] = await Promise.all([
        getManagerDashboard(),
        getAnalysisReports(),
      ]);
      setData(d);
      setCalls(Array.isArray(callData) ? callData : callData?.analyses || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDateChange = (e) => {
    setSummaryDate(e.target.value);
  };

  const isAllTime = summaryDate === 'ALL';
  const total = data?.total_summary || {};

  const summary = useMemo(() => {
    if (isAllTime) {
      return {
        calls_processed: total.calls_processed ?? 0,
        avg_score: total.avg_score ?? null,
        hot_leads: total.hot_leads ?? 0,
        needs_review: total.needs_review ?? 0,
      };
    }
    const day = calls.filter((c) => callDate(c) === summaryDate);
    const scores = day.map((c) => c.overall_score).filter((s) => s != null);
    return {
      calls_processed: day.length,
      avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null,
      hot_leads: day.filter((c) => c.outcome_category === 'Prospect agreed for the meeting').length,
      needs_review: day.filter((c) => c.overall_score != null && c.overall_score < 50).length,
    };
  }, [calls, summaryDate, isAllTime, total.calls_processed, total.avg_score, total.hot_leads, total.needs_review]);
  const scorecards = useMemo(() => data?.executive_scorecards || [], [data]);
  const hotLeads = useMemo(() => data?.hot_leads || [], [data]);
  const review = useMemo(() => (data?.review_calls || []).slice().sort((a, b) => new Date(b.call_time) - new Date(a.call_time)), [data]);
  const outcomes = useMemo(() => data?.outcome_distribution || {}, [data]);

  const outcomeSorted = useMemo(() =>
    Object.entries(outcomes).sort((a, b) => b[1] - a[1]),
  [outcomes]);
  const maxOutcome = outcomeSorted[0]?.[1] || 1;

  const selectedExec = useMemo(() =>
    scorecards.find(e => e.username === selected),
  [scorecards, selected]);

  const filteredScorecards = useMemo(() => {
    const q = execSearch.trim().toLowerCase();
    return q ? scorecards.filter(e => e.username.toLowerCase().includes(q)) : scorecards;
  }, [scorecards, execSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!data || total.calls_processed === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Team Overview</h1>
        <div className="py-20 text-center text-muted-foreground text-sm">
          No analysed calls yet. Upload and analyse recordings to see data here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Team Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Team performance intelligence across all analysed calls.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* ── Today's Summary ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isAllTime ? 'All-Time Summary' :
             summaryDate === todayISO() ? "Today's Summary" : `Summary — ${new Date(summaryDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSummaryDate(isAllTime ? todayISO() : 'ALL')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors
                ${isAllTime ? 'bg-[#F87217] text-white border-[#F87217]' : 'border-border bg-[hsl(var(--surface-2))] text-muted-foreground hover:text-foreground'}`}
            >
              All Time
            </button>
            <div className={`flex items-center gap-1.5 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2.5 py-1.5 ${isAllTime ? 'opacity-50' : ''}`}>
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={isAllTime ? '' : summaryDate}
                max={todayISO()}
                onChange={handleDateChange}
                className="text-xs bg-transparent border-none outline-none text-foreground cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: isAllTime ? 'Calls Processed' : 'Calls Processed', raw: summary.calls_processed ?? 0,        icon: BarChart3,     color: '#F5A623', bg: '#F5A6231A', sub: isAllTime ? 'all time' : `${total.calls_processed} total`, desc: isAllTime ? 'Recordings uploaded and fully analysed by AI, all time.' : 'Recordings uploaded and fully analysed by AI today.' },
            { label: isAllTime ? 'Avg Score' : 'Avg Score Today', raw: summary.avg_score,                    icon: Trophy,        color: '#BA7517', bg: '#BA75171A', sub: isAllTime ? 'all time' : `${total.avg_score ?? '—'}/100 all-time`, desc: isAllTime ? 'Average quality score across all analysed calls.' : 'Average quality score across all calls on this date.' },
            { label: 'Hot Leads',       raw: summary.hot_leads ?? 0,              icon: Flame,         color: '#1D9E75', bg: '#1D9E751A', sub: isAllTime ? 'all time' : `${total.hot_leads} total`,        desc: isAllTime ? 'Prospects who agreed to a meeting or site visit, all time.' : 'Prospects who agreed to a meeting or site visit today.' },
            { label: 'Needs Review',    raw: summary.needs_review ?? 0,           icon: AlertTriangle, color: '#D85A30', bg: '#D85A301A', sub: isAllTime ? 'all time' : `${total.needs_review} total`,     desc: 'Calls scoring below 50 — flagged for manager coaching.' },
          ].map(({ label, raw, icon: Icon, color, bg, sub, desc }) => (
            <div key={label}
              style={{ borderLeftColor: color }}
              className="bg-card border-l-4 border-y-[0.5px] border-r-[0.5px] border-[#E5E5E3] rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5F5E5A] uppercase tracking-wider">{label}</span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: bg, color }}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-[32px] leading-tight font-medium text-[#1A1A1A] tabular-nums">
                  {raw != null ? <AnimatedCount value={raw} suffix={label.startsWith('Avg Score') ? '/100' : ''} /> : '—'}
                </h3>
                <span className="mt-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: bg, color }}>{sub}</span>
              </div>
              <p className="text-[11px] text-[#6B6B67] mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive Scorecards ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Executive Scorecards
          </p>
          <p className="text-xs text-muted-foreground">
            {filteredScorecards.length}{execSearch ? ` of ${scorecards.length}` : ''} executive{scorecards.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Search + multi-select */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative w-full max-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={execSearch}
              onChange={(e) => setExecSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-[hsl(var(--surface-2))] border-border"
            />
            {execSearch && (
              <button
                onClick={() => setExecSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="ml-auto">
            <ExecutiveCompareControl scorecards={scorecards} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {filteredScorecards.map((exec, i) => (
            <ExecCard
              key={exec.username}
              exec={exec}
              index={i}
              isSelected={selected === exec.username}
              onClick={() => setSelected(selected === exec.username ? null : exec.username)}
            />
          ))}
        </div>

      </div>

      <DrillDown exec={selectedExec} onClose={() => setSelected(null)} />
      <ReviewCallDialog call={reviewCall} onClose={() => setReviewCall(null)} />

      {/* ── Outcome Distribution + Calls Needing Review ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#F87217]" /> Call Outcome Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outcomeSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outcome data yet.</p>
            ) : outcomeSorted.map(([label, count]) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground/80 font-medium truncate pr-2">{label}</span>
                  <span className="text-muted-foreground shrink-0">{count}</span>
                </div>
                <div className="w-full bg-[hsl(var(--surface-2))] rounded-full h-2.5">
                  <div
                    className="bg-[#F87217] h-2.5 rounded-full transition-all"
                    style={{ width: `${(count / maxOutcome) * 100}%`, opacity: 0.5 + (count / maxOutcome) * 0.5 }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D85A30]" /> Calls Needing Review
              {review.length > 0 && (
                <span className="ml-auto text-[11px] bg-[#D85A30]/12 text-[#D85A30] px-2.5 py-1 rounded-full font-medium">
                  {review.length} flagged
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {review.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No calls below 50 — great job! 🎉</p>
            ) : (
              <div className="space-y-2">
                {review.slice(0, 6).map((c) => {
                  const fullCall = calls.find(x => x.audio_id === c.audio_id);
                  return (
                    <div
                      key={c.audio_id}
                      onClick={() => setReviewCall(fullCall || c)}
                      className="group relative flex items-center justify-between p-3 rounded-lg bg-[#D85A30]/6 border-[0.5px] border-[#D85A30]/25 cursor-pointer hover:border-[#D85A30]/60 hover:bg-[#D85A30]/10 transition-all overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#D85A30]/15 text-[#D85A30] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials(c.username)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1A1A1A]">{c.username}</p>
                          <p className="text-[10px] text-[#6B6B67]">{fmt(c.call_time)}</p>
                          {c.weak_dimensions?.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              {c.weak_dimensions.slice(0, 2).map((dim) => (
                                <span key={dim} className="text-[9px] font-medium bg-[#D85A30]/12 text-[#D85A30] px-1.5 py-0.5 rounded-full">{dim}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#D85A30]">
                        {Math.round(c.overall_score)}
                      </span>

                      {/* Hover strip — slides up from bottom, does not cover content */}
                      <div className="absolute bottom-0 left-0 right-0 h-[22px] bg-[#F87217]/10 border-t border-[#F87217]/15 flex items-center justify-between px-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200 pointer-events-none">
                        <span className="text-[10px] text-[#F87217] font-mono">{c.phone_number && c.phone_number !== 'Unknown' ? c.phone_number : '—'}</span>
                        <span className="text-[10px] font-semibold text-[#F87217]">View call report →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Hot Leads ─────────────────────────────────────────────────── */}
      {hotLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-500" /> Hot Leads — Agreed for Meeting
              <span className="ml-auto text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {hotLeads.length} lead{hotLeads.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">Prospect</th>
                    <th className="px-4 py-2.5 text-left">Executive</th>
                    <th className="px-4 py-2.5 text-left">Call Time</th>
                    <th className="px-4 py-2.5 text-left">Score</th>
                    <th className="px-4 py-2.5 text-left">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hotLeads.map((lead) => (
                    <tr key={lead.audio_id} className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {lead.phone_number !== 'Unknown' ? lead.phone_number : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#F87217]/10 text-[#F87217] flex items-center justify-center text-[10px] font-bold">
                            {initials(lead.username)}
                          </div>
                          <span className="text-xs">{lead.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmt(lead.call_time)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-bold ${scoreColor(lead.overall_score ?? 0)}`}>
                          {lead.overall_score != null ? Math.round(lead.overall_score) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[240px] truncate">
                        {lead.outcome_phrases?.[0] || lead.summary || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
