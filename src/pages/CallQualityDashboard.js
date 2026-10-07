import {
  BarChart3,
  RefreshCw,
  Trash2,
  Search,
  X,
  SlidersHorizontal,
  Trophy,
  Phone,
  TrendingUp,
  Download,
  Mail,
  PencilLine,
  Save,
  Music2,
  Loader2,
  CalendarDays,
  MousePointerClick,
  Languages,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileType2,
} from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import MultiEmailInput from '@/components/shared/MultiEmailInput';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import {
  getAnalysisReports,
  clearAllCallAnalysis,
  deleteCallAnalysis,
  getCallAudio,
  downloadExecutiveReport,
  sendExecutiveReportEmail,
  saveManualScoreOverride,
  getWeightConfig,
  getManagerDashboard,
  emailExecutiveComparison,
  downloadBlob,
  getSheetsUrl,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import ExecutiveCompareControl from '@/components/shared/ExecutiveCompareControl';
import ExecReportAnalytics from '@/components/shared/ExecReportAnalytics';
import ScheduleDrawer from '@/components/voice/ScheduleDrawer';
import { toast } from 'sonner';



// Compact chip labels for the score-filter drawer (Low/Medium/High/Any)
const SCORE_CHIP_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: 'Low 25+', value: 25 },
  { label: 'Med 50+', value: 50 },
  { label: 'High 75+', value: 75 },
];

const SCORE_DIMENSION_FILTERS = [
  { dim: 'overall',           label: 'Overall Score' },
  { dim: 'introduction',      label: 'Introduction' },
  { dim: 'probing',           label: 'Probing' },
  { dim: 'adherence',         label: 'Script Adherence' },
  { dim: 'listening',         label: 'Active Listening' },
  { dim: 'fumble',            label: 'Fumble' },
  { dim: 'closing',           label: 'Call Closing' },
  { dim: 'objection',         label: 'Objection Handling' },
  { dim: 'value_proposition', label: 'Site Visit Persuasion' },
];

const OUTCOME_OPTIONS = [
  'Prospect agreed for the meeting',
  'Call back requested',
  'Prospect disconnected the call',
  'Prospect not interested',
  'Out of scope',
  'Prospect will reach out in future if required',
];


const DEFAULT_SCORE_FILTERS = {
  overall: 0,
  introduction: 0,
  probing: 0,
  adherence: 0,
  listening: 0,
  fumble: 0,
  closing: 0,
  objection: 0,
  value_proposition: 0,
};

const DIMENSIONS = [
  { key: 'introduction_score',                      label: 'Introduction/Hook',       expl: 'introduction_explanation' },
  { key: 'adherence_script_product_knowledge_score', label: 'Adherence to script/Product Knowledge',  expl: 'adherence_script_product_knowledge_explanation' },
  { key: 'actively_listening_responding_score',      label: 'Actively listening/ Responding Appropriately',  expl: 'actively_listening_responding_explanation' },
  { key: 'fumble_score',                             label: 'Fumble',            expl: 'fumble_explanation' },
  { key: 'probing_effectiveness',                    label: 'Probing',           expl: 'probing_explanation' },
  { key: 'call_closing_quality',                     label: 'Closing',           expl: 'call_closing_explanation' },
  { key: 'objection_handling_score',                 label: 'Objection Handling',expl: 'objection_handling_explanation' },
  { key: 'value_proposition_score',                  label: 'Site Visit Persuasion', expl: 'value_proposition_explanation' },
];

const MANUAL_SCORE_FIELDS = [
  { key: 'introduction_score', label: 'Introduction/Hook', weightKey: 'introduction_weight', explKey: 'introduction_explanation' },
  { key: 'adherence_script_product_knowledge_score', label: 'Adherence to script/Product Knowledge', weightKey: 'adherence_weight', explKey: 'adherence_script_product_knowledge_explanation' },
  { key: 'actively_listening_responding_score', label: 'Actively listening/ Responding Appropriately', weightKey: 'listening_weight', explKey: 'actively_listening_responding_explanation' },
  { key: 'fumble_score', label: 'Fumble', weightKey: 'fumble_weight', explKey: 'fumble_explanation' },
  { key: 'probing_effectiveness', label: 'Probing', weightKey: 'probing_weight', explKey: 'probing_explanation' },
  { key: 'call_closing_quality', label: 'Closing', weightKey: 'closing_weight', explKey: 'call_closing_explanation' },
  { key: 'objection_handling_score', label: 'Objection Handling', weightKey: 'objection_weight', explKey: 'objection_handling_explanation' },
  { key: 'value_proposition_score', label: 'Site Visit Persuasion', weightKey: 'value_proposition_weight', explKey: 'value_proposition_explanation' },
];

// Equal-weight fallback when no weight config is loaded (8 dimensions = 12.5% each)
const computeWeightedOverall = (draft, weights) => {
  let total = 0;
  let weightSum = 0;
  MANUAL_SCORE_FIELDS.forEach(({ key, weightKey }) => {
    const score = Number(draft[key]);
    if (Number.isNaN(score)) return;
    const w = weights ? Number(weights[weightKey] ?? 0) : 12.5;
    total += score * (w / 100);
    weightSum += w;
  });
  // If weights don't sum to ~100 (or missing), normalise by the weight we actually used
  if (weightSum > 0 && Math.abs(weightSum - 100) > 0.5) {
    return Math.round((total / (weightSum / 100)) * 10) / 10;
  }
  return Math.round(total * 10) / 10;
};

const buildManualDraft = (call) => ({
  introduction_score: call.introduction_score ?? '',
  introduction_explanation: call.introduction_explanation ?? '',
  adherence_script_product_knowledge_score: call.adherence_script_product_knowledge_score ?? '',
  adherence_script_product_knowledge_explanation: call.adherence_script_product_knowledge_explanation ?? '',
  actively_listening_responding_score: call.actively_listening_responding_score ?? '',
  actively_listening_responding_explanation: call.actively_listening_responding_explanation ?? '',
  fumble_score: call.fumble_score ?? '',
  fumble_explanation: call.fumble_explanation ?? '',
  probing_effectiveness: call.probing_effectiveness ?? '',
  probing_explanation: call.probing_explanation ?? '',
  call_closing_quality: call.call_closing_quality ?? '',
  call_closing_explanation: call.call_closing_explanation ?? '',
  objection_handling_score: call.objection_handling_score ?? '',
  objection_handling_explanation: call.objection_handling_explanation ?? '',
  value_proposition_score: call.value_proposition_score ?? '',
  value_proposition_explanation: call.value_proposition_explanation ?? '',
  notes: '',
});

const getLeadType = (outcomeCategory) => {
  if (!outcomeCategory) return null;
  if (outcomeCategory === 'Prospect agreed for the meeting') return 'hot';
  if (outcomeCategory === 'Call back requested' || outcomeCategory === 'Prospect will reach out in future if required') return 'warm';
  return 'cold';
};

// ── Design system: core palette (real estate / performance dashboard) ──────
// teal  #1D9E75 — primary accent: positive metrics, top performers, dialogue
// blue  #F5A623 — trust/pro: charts, primary data viz
// green #639922 — success: excellent performance (70+)
// amber #BA7517 — warning: attention needed (40-60)
// coral #D85A30 — critical: issues, alerts, monologues
// gray  #5F5E5A — neutral: labels, secondary text

const LEAD_TYPE_STYLE = {
  hot:  { label: 'Hot',  cls: 'bg-[#D85A30]/15 text-[#D85A30]' },
  warm: { label: 'Warm', cls: 'bg-[#BA7517]/15 text-[#BA7517]' },
  cold: { label: 'Cold', cls: 'bg-[#F5A623]/15 text-[#F5A623]' },
};

const safeFileName = (value) =>
  String(value || 'executive_report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Semantic score scale used everywhere on this page:
// 70+ excellent (green) · 60-69 good (teal) · 40-59 needs attention (amber) · <40 critical (coral)
const scoreColor = (s) => {
  if (s == null) return 'bg-muted';
  if (s >= 70) return 'bg-[#639922]';
  if (s >= 60) return 'bg-[#1D9E75]';
  if (s >= 40) return 'bg-[#BA7517]';
  return 'bg-[#D85A30]';
};

const scoreTextColor = (s) => {
  if (s == null) return 'text-muted-foreground';
  if (s >= 70) return 'text-[#639922]';
  if (s >= 60) return 'text-[#1D9E75]';
  if (s >= 40) return 'text-[#BA7517]';
  return 'text-[#D85A30]';
};

const SCORE_STATUS = {
  excellent: { label: 'Excellent',       icon: '✓', cls: 'bg-[#639922]/15 text-[#639922]' },
  good:      { label: 'Good',            icon: '⚠', cls: 'bg-[#1D9E75]/15 text-[#1D9E75]' },
  attention: { label: 'Needs Attention', icon: '⚡', cls: 'bg-[#BA7517]/15 text-[#BA7517]' },
  critical:  { label: 'Critical',        icon: '✗', cls: 'bg-[#D85A30]/15 text-[#D85A30]' },
};

const scoreStatus = (s) => {
  if (s == null) return null;
  if (s >= 70) return SCORE_STATUS.excellent;
  if (s >= 60) return SCORE_STATUS.good;
  if (s >= 40) return SCORE_STATUS.attention;
  return SCORE_STATUS.critical;
};

const RANK_LABELS = ['1st', '2nd', '3rd'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const nameInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

function Leaderboard({ performers, open, onOpenChange }) {
  if (!performers.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="w-4 h-4 text-[#1D9E75]" />
        <span className="font-medium text-base text-[#1A1A1A]">Top Performers</span>
        <span className="text-xs text-[#6B6B67]">— by average overall score</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {performers.map((p, i) => (
          <div
            key={p.name}
            className="relative rounded-xl border-[0.5px] border-[#E5E5E3] bg-card p-5 flex flex-col gap-4 transition-all duration-200"
          >
            {/* Medal — 40px circle, top-right */}
            <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#F5F5F3] flex items-center justify-center text-xl shrink-0">
              {RANK_MEDALS[i]}
            </div>

            {/* Call count */}
            <span className="text-[11px] flex items-center gap-1 text-[#6B6B67] w-fit">
              <Phone className="w-2.5 h-2.5" />
              {p.callCount} call{p.callCount !== 1 ? 's' : ''}
            </span>

            {/* Avatar + name */}
            <div className="flex items-center gap-3 pr-10">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-[#1D9E75]/12 text-[#1D9E75]">
                {nameInitials(p.name)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-base leading-tight truncate text-[#1A1A1A]">{p.name}</p>
                <p className="text-[11px] font-medium text-[#6B6B67]">{RANK_LABELS[i]} Place</p>
              </div>
            </div>

            {/* Best dimension */}
            {p.topDimension && (
              <div className="flex items-center gap-1.5 bg-[#F5F5F3] rounded-lg px-3 py-1.5">
                <TrendingUp className="w-3 h-3 shrink-0 text-[#6B6B67]" />
                <span className="text-[11px] truncate text-[#6B6B67]">Best: {p.topDimension}</span>
              </div>
            )}

            {/* Score bar — 20px height, 4px radius, tier color, bold white value inside */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-widest font-medium text-[#A8A8A3]">Avg Score</span>
                <span className="text-base font-medium tabular-nums text-[#1A1A1A]">
                  {p.avg}<span className="text-xs font-normal text-[#6B6B67]">/100</span>
                </span>
              </div>
              <div className="h-5 rounded bg-[#F5F5F3] overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-700 flex items-center justify-end px-2 ${scoreColor(p.avg)}`}
                  style={{ width: `${p.avg}%` }}
                >
                  <span className="text-[10px] font-bold text-white">{p.avg}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreStatusBadge({ score }) {
  const status = scoreStatus(score);
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${status.cls}`}>
      <span aria-hidden>{status.icon}</span>
      {status.label}
    </span>
  );
}

function TrendChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-[140px] flex items-center justify-center text-xs text-[#5F5E5A]">
        Not enough data yet for a trend chart
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5F5E5A' }} axisLine={false} tickLine={false} width={28} />
        <ChartTooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
          formatter={(value) => [`${value}/100`, 'Avg score']}
        />
        <Line type="monotone" dataKey="avgScore" stroke="#F5A623" strokeWidth={2.5} dot={{ r: 3, fill: '#F5A623' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DimensionScore({ label, score, explanation }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${scoreTextColor(score)}`}>
          {score != null ? Math.round(score) : '—'}
        </span>
      </div>
      <div className="h-2 bg-[hsl(var(--surface-2))] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      {explanation && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{explanation}</p>
      )}
    </div>
  );
}

const UI_HI = {
  'Call details':       'कॉल विवरण',
  'Manual edit':        'मैनुअल संपादन',
  'Monologue':          'एकालाप',
  'Dialogue':           'संवाद',
  'Call Recording':     'कॉल रिकॉर्डिंग',
  'Audio playback':     'ऑडियो प्लेबैक',
  'Loading audio…':     'ऑडियो लोड हो रहा है…',
  'No recording available': 'कोई रिकॉर्डिंग उपलब्ध नहीं',
  'Admin actions':      'एडमिन कार्य',
  'Download Report':    'रिपोर्ट डाउनलोड करें',
  'Send via Email':     'ईमेल से भेजें',
  'Manual Edit':        'मैनुअल संपादन',
  'Overall Score (auto)': 'कुल स्कोर (स्वचालित)',
  'Recalculated from the parameters above on save.': 'सेव करने पर ऊपर के मापदंडों से पुनः गणना होगी।',
  'Notes':              'नोट्स',
  'Add admin notes for this manual change': 'इस बदलाव के लिए नोट्स जोड़ें',
  'Save Changes':       'बदलाव सेव करें',
  'Cancel':             'रद्द करें',
  'Introduction/Hook':                             'परिचय/हुक',
  'Adherence to script/Product Knowledge':         'स्क्रिप्ट अनुपालन/उत्पाद ज्ञान',
  'Actively listening/ Responding Appropriately':  'सक्रिय श्रवण/उचित प्रतिक्रिया',
  'Fumble':                                        'हकलाहट',
  'Probing':                                       'जांच',
  'Closing':                                       'समापन',
  'Objection Handling':                            'आपत्ति निवारण',
  'Site Visit Persuasion':                         'साइट विज़िट अनुनय',
};

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

const translateText = async (text) => {
  if (!text?.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0].map(([t]) => t).join('');
};

function ColFilter({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const active = value !== 'all';
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(p => !p)} className={`flex items-center gap-1 group ${active ? 'text-[#F87217]' : ''}`}>
        {label}
        <span className="flex flex-col ml-1">
          <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${active ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
        </span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#F87217] ml-0.5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
            {options.map(({ label: ol, value: ov }) => (
              <button key={ov} onClick={() => { onChange(ov); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--surface-2))] ${value === ov ? 'text-[#F87217] font-semibold' : 'text-foreground'}`}>
                {ol}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CallRow({ call, isAdmin, onRefresh, onDelete, weights, selectMode, isSelected, onToggle }) {
  const [open, setOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [emails, setEmails] = useState([]);
  const emailsInputRef = useRef(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [draft, setDraft] = useState(() => buildManualDraft(call));
  const [liveCall, setLiveCall] = useState(null); // overrides call prop after manual save
  const [hindiMode, setHindiMode] = useState(false);
  const [translations, setTranslations] = useState(null);
  const [translating, setTranslating] = useState(false);

  const toggleHindi = async () => {
    if (hindiMode) { setHindiMode(false); return; }
    if (translations) { setHindiMode(true); return; }
    setTranslating(true);
    try {
      const fields = {
        summary: call.summary,
        outcome_explanation: call.outcome_explanation,
        outcome_category: call.outcome_category,
        ...Object.fromEntries(DIMENSIONS.map((d) => [d.expl, call[d.expl]])),
      };
      const entries = Object.entries(fields).filter(([, v]) => v);
      const translated = await Promise.all(entries.map(([, text]) => translateText(text)));
      const result = {};
      entries.forEach(([key], i) => { result[key] = translated[i]; });
      setTranslations(result);
      setHindiMode(true);
    } catch {
      toast.error('Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  const effective = liveCall ?? call;
  const t = (field) => (hindiMode && translations?.[field]) ? translations[field] : effective[field];
  const ui = (text) => hindiMode ? (UI_HI[text] ?? text) : text;

  useEffect(() => {
    setDraft(buildManualDraft(call));
  }, [call]);

  useEffect(() => {
    if (!open || audioUrl) return;

    let cancelled = false;
    setAudioLoading(true);

    getCallAudio(call.audio_id)
      .then((res) => {
        if (cancelled) return;
        setAudioUrl(URL.createObjectURL(res.data));
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load audio');
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, call.audio_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this call record from DB and Google Sheets? This cannot be undone.')) return;
    try {
      await deleteCallAnalysis(call.audio_id);
      toast.success('Call record deleted');
      onDelete?.(call.audio_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const saveManualEdits = async () => {
    setSavingEdit(true);
    try {
      const payload = {};
      MANUAL_SCORE_FIELDS.forEach(({ key, explKey }) => {
        const raw = draft[key];
        if (raw !== '' && raw !== null && raw !== undefined) {
          payload[key] = Number(raw);
        }
        const reason = draft[explKey]?.trim();
        if (reason) payload[explKey] = reason;
      });
      if (draft.notes?.trim()) payload.notes = draft.notes.trim();

      const res = await saveManualScoreOverride(call.audio_id, payload);
      if (res.data?.analysis) setLiveCall(res.data.analysis);
      toast.success('Scores updated');
      setEditOpen(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update scores');
    } finally {
      setSavingEdit(false);
    }
  };

  const sendReport = async () => {
    const finalEmails = emailsInputRef.current?.flush() ?? emails;
    if (!finalEmails.length) {
      toast.error('Add at least one email address');
      return;
    }
    setSendingEmail(true);
    try {
      await Promise.all(finalEmails.map((to) => sendExecutiveReportEmail(call.audio_id, { to_email: to })));
      toast.success(`Report sent to ${finalEmails.length} recipient${finalEmails.length > 1 ? 's' : ''}`);
      setEmails([]);
      setEmailOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const downloadReport = async () => {
    if (hindiMode && translations) {
      const row = (label, value) => `"${label}","${String(value ?? '').replace(/"/g, '""')}"`;
      const lines = [
        row('कार्यकारी', call.username),
        row('रिकॉर्डिंग ID', call.recording_id || call.audio_id),
        row('कुल स्कोर', call.overall_score != null ? `${Math.round(call.overall_score)}/100` : '—'),
        row('कॉल प्रकार', call.is_monologue ? 'एकालाप' : 'संवाद'),
        row('परिणाम श्रेणी', translations.outcome_category || call.outcome_category || ''),
        '',
        row('कॉल सारांश', translations.summary || call.summary || ''),
        '',
        row('परिणाम', translations.outcome_explanation || call.outcome_explanation || ''),
        '',
        '"आयाम","स्कोर","विवरण"',
        ...DIMENSIONS.map(({ key, label, expl }) =>
          row(UI_HI[label] || label, call[key] != null ? Math.round(call[key]) : '—') +
          `,"${String(translations[expl] || call[expl] || '').replace(/"/g, '""')}"`
        ),
      ];
      const csv = '﻿' + lines.join('\n'); // BOM for Excel Hindi rendering
      const name = `${safeFileName(call.username || 'executive')}_${call.recording_id || call.audio_id}_hindi.csv`;
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), name);
      return;
    }
    try {
      const res = await downloadExecutiveReport(call.audio_id);
      const name = `${safeFileName(call.username || 'executive')}_${call.recording_id || call.audio_id}_report.xlsx`;
      downloadBlob(res.data, name);
    } catch (err) {
      toast.error('Failed to download report');
    }
  };

  return (
    <>
      <tr
        className={`border-b border-border transition-colors ${
          selectMode
            ? isSelected
              ? 'bg-[#F87217]/8 cursor-pointer'
              : 'hover:bg-[hsl(var(--surface-2))] cursor-pointer'
            : 'hover:bg-[hsl(var(--surface-2))] cursor-pointer'
        }`}
        onClick={() => {
          if (selectMode) { onToggle(call.audio_id); return; }
          setEditOpen(false); setOpen(true);
        }}
      >
        <td className="pl-4 py-3 w-8" onClick={(e) => e.stopPropagation()}>
          {selectMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(call.audio_id)}
            />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span>{call.username || '—'}</span>
            {call.manual_override && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                Manual edit
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {(() => {
            const raw = call.start_time || call.created_at;
            if (!raw) return '—';
            const d = new Date(raw);
            return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
          })()}
        </td>
        <td className="px-4 py-3 text-xs">
          <span className={`inline-flex px-2.5 py-1 rounded-full font-medium ${
            call.is_monologue ? 'bg-[#D85A30]/15 text-[#D85A30]' : 'bg-[#1D9E75]/15 text-[#1D9E75]'
          }`}>
            {call.is_monologue ? 'Monologue' : 'Dialogue'}
          </span>
        </td>
        <td className="px-4 py-3 text-xs">
          {(() => {
            const lt = getLeadType(call.outcome_category);
            if (!lt) return <span className="text-muted-foreground">—</span>;
            const { label, cls } = LEAD_TYPE_STYLE[lt];
            return <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
          })()}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{call.outcome_category || '—'}</td>
        <td className="px-4 py-3">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col gap-1.5 min-w-[160px]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[hsl(var(--surface-2))] rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${scoreColor(call.overall_score)}`}
                        style={{ width: `${call.overall_score ?? 0}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-9 text-right tabular-nums ${scoreTextColor(call.overall_score)}`}>
                      {call.overall_score != null ? Math.round(call.overall_score) : '—'}
                    </span>
                  </div>
                  <ScoreStatusBadge score={call.overall_score} />
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="p-3 space-y-1.5 max-w-[260px] bg-card text-[#1A1A1A] border border-[#E5E5E3] shadow-lg rounded-lg"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A8A8A3] mb-1">Score Breakdown</p>
                {DIMENSIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-[#6B6B67]">{label}</span>
                    <span className={`font-semibold tabular-nums ${scoreTextColor(call[key])}`}>
                      {call[key] != null ? Math.round(call[key]) : '—'}
                    </span>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>
        {isAdmin && (
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="More actions"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-[#F87217] hover:bg-[#F87217]/10 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                <button
                  onClick={downloadReport}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-[hsl(var(--surface-2))] text-left"
                >
                  <Download className="w-4 h-4 text-muted-foreground" /> Download
                </button>
                <button
                  onClick={() => setEmailOpen(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-[hsl(var(--surface-2))] text-left"
                >
                  <Mail className="w-4 h-4 text-muted-foreground" /> Send via Email
                </button>
                <button
                  onClick={() => { setOpen(true); setEditOpen(true); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-[hsl(var(--surface-2))] text-left"
                >
                  <PencilLine className="w-4 h-4 text-muted-foreground" /> Manual Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-red-50 text-red-600 text-left"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </PopoverContent>
            </Popover>
          </td>
        )}
      </tr>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send report via email</DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">
              {call.username || 'Executive'} — {call.recording_id || call.audio_id}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <MultiEmailInput ref={emailsInputRef} emails={emails} onChange={setEmails} />
            <p className="text-[11px] text-muted-foreground">Press Enter or comma to add each address.</p>
            <Button onClick={sendReport} disabled={sendingEmail} className="w-full">
              {sendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Report{emails.length > 1 ? ` (${emails.length})` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setHindiMode(false); setEditOpen(false); } }}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border pb-3">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span>{call.username || 'Call details'}</span>
              {call.manual_override && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-normal">
                  Manual edit
                </span>
              )}
              <span className={`ml-auto text-lg font-bold tabular-nums ${scoreTextColor(call.overall_score)}`}>
                {call.overall_score != null ? `${Math.round(call.overall_score)}/100` : '—'}
              </span>
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-[11px] font-mono text-muted-foreground">
                <span className="uppercase tracking-wide font-sans not-italic text-[9px] text-muted-foreground/70">ID</span>
                {call.recording_id || call.audio_id}
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
                call.is_monologue ? 'bg-[#D85A30]/15 text-[#D85A30]' : 'bg-[#1D9E75]/15 text-[#1D9E75]'
              }`}>
                {call.is_monologue ? 'Monologue' : 'Dialogue'}
              </span>
              {call.outcome_category && (
                <span className="inline-flex items-center rounded-md bg-[#F87217]/10 text-[#F87217] px-2 py-1 text-[11px] font-medium">
                  {call.outcome_category}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-5 pt-4">
            <div className="rounded-2xl border border-[#F87217]/15 bg-gradient-to-br from-[#F87217]/8 via-[#F87217]/4 to-transparent p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F87217]/15 text-[#F87217] shrink-0">
                  <Music2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">Call Recording</p>
                  <p className="text-[11px] text-muted-foreground">
                    {call.duration ? `${Math.floor(call.duration / 60)}m ${Math.round(call.duration % 60)}s` : 'Audio playback'}
                  </p>
                </div>
              </div>
              {audioLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {ui('Loading audio…')}
                </div>
              ) : audioUrl ? (
                <audio
                  controls
                  src={audioUrl}
                  className="w-full h-11 rounded-lg [&::-webkit-media-controls-panel]:bg-card [&::-webkit-media-controls-panel]:rounded-lg"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-1">
                  <Music2 className="w-4 h-4 opacity-50" />
                  No recording available
                </div>
              )}
            </div>

            {call.summary && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {hindiMode ? 'कॉल सारांश' : 'Call Summary'}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{call.summary}</p>
              </div>
            )}

            {call.outcome_explanation && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {hindiMode ? 'परिणाम' : 'Outcome'}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{call.outcome_explanation}</p>
              </div>
            )}

            {isAdmin && (
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Admin actions
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={downloadReport}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Send via Email
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => setEditOpen((p) => !p)}>
                    <PencilLine className="w-4 h-4 mr-2" />
                    Manual Edit
                  </Button>
                </div>

                {editOpen && (
                  <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {MANUAL_SCORE_FIELDS.map(({ key, label, explKey }) => {
                        const original = call[key] ?? '';
                        const changed = draft[key] !== '' && String(draft[key]) !== String(original);
                        return (
                        <div key={key} className={`space-y-1 rounded-lg p-2 transition-colors ${changed ? 'bg-amber-50 border border-amber-200' : ''}`}>
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            {label}
                            {changed && <span className="text-[10px] text-amber-600 font-semibold">edited</span>}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={draft[key]}
                            onChange={(e) => updateDraft(key, Math.round(Number(e.target.value)))}
                          />
                          {changed && (
                            <Textarea
                              value={draft[explKey]}
                              onChange={(e) => updateDraft(explKey, e.target.value)}
                              placeholder={`Reason for changing ${label} score…`}
                              className="text-xs min-h-[60px] mt-1"
                            />
                          )}
                        </div>
                      ); })}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--surface-2))] px-4 py-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">Overall Score (auto)</p>
                        <p className="text-[11px] text-muted-foreground">Recalculated from the parameters above on save.</p>
                      </div>
                      <span className={`text-2xl font-bold tabular-nums ${scoreTextColor(computeWeightedOverall(draft, weights))}`}>
                        {computeWeightedOverall(draft, weights)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Notes</label>
                      <Textarea
                        value={draft.notes}
                        onChange={(e) => updateDraft('notes', e.target.value)}
                        placeholder="Add admin notes for this manual change"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={saveManualEdits} disabled={savingEdit}>
                        {savingEdit ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!editOpen && <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {hindiMode ? 'स्कोर विवरण' : 'Score Breakdown'}
                </p>
                <Button
                  variant={hindiMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 text-xs"
                  onClick={toggleHindi}
                  disabled={translating}
                >
                  {translating
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Languages className="w-3.5 h-3.5" />}
                  {hindiMode ? 'EN' : 'हिंदी'}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {DIMENSIONS.map(({ key, label, expl }) => (
                  <DimensionScore
                    key={key}
                    label={ui(label)}
                    score={effective[key]}
                    explanation={t(expl)}
                  />
                ))}
              </div>
            </div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

export default function CallQualityDashboard() {
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();
  const dashView = searchParams.get('view') === 'analytics' ? 'analytics' : 'calls';

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('callId') || '');
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('callId') ? '' : todayStr());
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [executiveFilter, setExecutiveFilter] = useState('all');
  const [leadFilter, setLeadFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [scoreFilters, setScoreFilters] = useState(DEFAULT_SCORE_FILTERS);
  const [pendingScoreFilters, setPendingScoreFilters] = useState(DEFAULT_SCORE_FILTERS);
  const [weights, setWeights] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [sheetsUrl, setSheetsUrl] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCalls, setSelectedCalls] = useState([]);
  const [selectEmails, setSelectEmails] = useState([]);
  const selectEmailsInputRef = useRef(null);
  const [selectEmailOpen, setSelectEmailOpen] = useState(false);
  const [selectSending, setSelectSending] = useState(false);

  const toggleCall = (audioId) => {
    if (!audioId) return;
    setSelectedCalls((prev) =>
      prev.includes(audioId) ? prev.filter((id) => id !== audioId) : [...prev, audioId],
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredCalls.map((c) => c.audio_id).filter(Boolean);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCalls.includes(id));
    setSelectedCalls(allSelected ? [] : visibleIds);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedCalls([]);
  };

  const downloadSelectedReports = () => {
    const selected = calls.filter((c) => selectedCalls.includes(c.audio_id));
    if (!selected.length) { toast.error('No calls selected'); return; }
    const header = [
      'Call ID', 'Executive', 'Date', 'Overall Score', 'Outcome',
      'Introduction', 'Probing', 'Script Adherence', 'Active Listening',
      'Fumble', 'Call Closing', 'Objection Handling', 'Site Visit Persuasion',
    ];
    const rows = selected.map((c) => [
      c.recording_id || c.audio_id,
      c.username || '',
      c.start_time ? new Date(c.start_time).toLocaleDateString('en-IN') : '',
      c.overall_score ?? '',
      c.outcome_category || '',
      c.introduction_score ?? '',
      c.probing_effectiveness ?? '',
      c.adherence_script_product_knowledge_score ?? '',
      c.actively_listening_responding_score ?? '',
      c.fumble_score ?? '',
      c.call_closing_quality ?? '',
      c.objection_handling_score ?? '',
      c.value_proposition_score ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `call_report_${Date.now()}.csv`);
    toast.success(`${selected.length} call${selected.length !== 1 ? 's' : ''} downloaded`);
    exitSelectMode();
  };

  const sendSelectedReports = async () => {
    const finalEmails = selectEmailsInputRef.current?.flush() ?? selectEmails;
    if (!finalEmails.length) { toast.error('Add at least one recipient'); return; }
    setSelectSending(true);
    try {
      await Promise.all(
        selectedCalls.flatMap((audioId) =>
          finalEmails.map((to) => sendExecutiveReportEmail(audioId, { to_email: to }))
        )
      );
      toast.success(`Report sent to ${finalEmails.length} recipient${finalEmails.length > 1 ? 's' : ''}`);
      setSelectEmailOpen(false);
      setSelectEmails([]);
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send report');
    } finally {
      setSelectSending(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getAnalysisReports();
      setCalls(Array.isArray(data) ? data : data.analyses || []);
    } catch {
      toast.error('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    getWeightConfig()
      .then(({ data }) => setWeights(data))
      .catch(() => setWeights(null));
  }, []);

  useEffect(() => {
    getManagerDashboard()
      .then(({ data }) => setScorecards(data?.executive_scorecards || []))
      .catch(() => setScorecards([]));
  }, []);

  useEffect(() => {
    getSheetsUrl()
      .then(({ data }) => setSheetsUrl(data.url))
      .catch(() => {});
  }, []);

  const spreadsheetId = sheetsUrl?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
  const exportSheetUrl = (fmt) => `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=${fmt}`;


  const filteredCalls = useMemo(() => {
    let list = calls;

    // Date filter — uses start_time when available, falls back to created_at
    if (dateFilter) {
      list = list.filter((c) => {
        const raw = c.start_time || c.created_at;
        if (!raw) return false;
        return new Date(raw).toLocaleDateString('en-CA') === dateFilter;
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        (c.username || '').toLowerCase().includes(q) ||
        (c.recording_id || c.audio_id || '').toLowerCase().includes(q)
      );
    }
    if (executiveFilter !== 'all') list = list.filter((c) => c.username === executiveFilter);
    if (typeFilter !== 'all') {
      list = list.filter((c) => !!c.is_monologue === (typeFilter === 'monologue'));
    }
    if (outcomeFilter !== 'all') list = list.filter((c) => c.outcome_category === outcomeFilter);
    if (leadFilter !== 'all') list = list.filter((c) => getLeadType(c.outcome_category) === leadFilter);
    if (categoryFilter !== 'all') list = list.filter((c) => c.category === categoryFilter);
    if (subCategoryFilter !== 'all') list = list.filter((c) => c.sub_category === subCategoryFilter);
    // Score dimension filters
    const dimMap = {
      overall:          'overall_score',
      introduction:     'introduction_score',
      probing:          'probing_effectiveness',
      adherence:        'adherence_script_product_knowledge_score',
      listening:        'actively_listening_responding_score',
      fumble:           'fumble_score',
      closing:          'call_closing_quality',
      objection:        'objection_handling_score',
      value_proposition:'value_proposition_score',
    };
    Object.entries(scoreFilters).forEach(([dim, min]) => {
      if (min > 0) {
        const field = dimMap[dim];
        list = list.filter((c) => (c[field] ?? 0) >= min);
      }
    });
    const _date = (c) => new Date(c.start_time || c.created_at || 0).getTime();
    if (sort === 'newest') return [...list].sort((a, b) => _date(b) - _date(a));
    if (sort === 'oldest') return [...list].sort((a, b) => _date(a) - _date(b));
    if (sort === 'score_desc') return [...list].sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
    if (sort === 'score_asc') return [...list].sort((a, b) => (a.overall_score ?? 101) - (b.overall_score ?? 101));
    return list;
  }, [calls, dateFilter, search, executiveFilter, typeFilter, outcomeFilter, leadFilter, categoryFilter, subCategoryFilter, scoreFilters, sort]);

  const filteredStats = useMemo(() => {
    const completed = filteredCalls.filter((c) => c.overall_score != null);
    return {
      total: filteredCalls.length,
      avg: completed.length
        ? Math.round(completed.reduce((s, c) => s + c.overall_score, 0) / completed.length)
        : null,
      monologues: filteredCalls.filter((c) => c.is_monologue).length,
    };
  }, [filteredCalls]);

  // ── Leaderboard: top 3 performers by avg overall score ──────────────────
  const topPerformers = useMemo(() => {
    const byUser = {};
    calls.forEach((c) => {
      if (!c.username || c.overall_score == null) return;
      if (!byUser[c.username]) byUser[c.username] = { scores: [], dimTotals: {}, dimCounts: {} };
      byUser[c.username].scores.push(c.overall_score);
      DIMENSIONS.forEach(({ key, label }) => {
        if (c[key] != null) {
          byUser[c.username].dimTotals[label] = (byUser[c.username].dimTotals[label] || 0) + c[key];
          byUser[c.username].dimCounts[label] = (byUser[c.username].dimCounts[label] || 0) + 1;
        }
      });
    });
    return Object.entries(byUser)
      .map(([name, { scores, dimTotals, dimCounts }]) => {
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        const topDimension = Object.entries(dimTotals)
          .map(([label, total]) => ({ label, avg: total / dimCounts[label] }))
          .sort((a, b) => b.avg - a.avg)[0]?.label || null;
        return { name, avg, callCount: scores.length, topDimension };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
  }, [calls]);

  // ── Needs Review: lowest-scoring executive (min 1 call), for the highlights bar ──
  const needsReviewPerformer = useMemo(() => {
    const byUser = {};
    calls.forEach((c) => {
      if (!c.username || c.overall_score == null) return;
      if (!byUser[c.username]) byUser[c.username] = [];
      byUser[c.username].push(c.overall_score);
    });
    const entries = Object.entries(byUser).map(([name, scores]) => ({
      name,
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      callCount: scores.length,
    }));
    if (!entries.length) return null;
    return entries.sort((a, b) => a.avg - b.avg)[0];
  }, [calls]);

  // ── 14-day daily average score trend, independent of active filters ──────
  const trendSeries = useMemo(() => {
    const byDay = {};
    calls.forEach((c) => {
      if (c.overall_score == null) return;
      const raw = c.start_time || c.created_at;
      if (!raw) return;
      const key = new Date(raw).toLocaleDateString('en-CA');
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(c.overall_score);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([day, scores]) => ({
        label: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      }));
  }, [calls]);

  // ── Trend %: this week's avg score vs the prior week ─────────────────────
  const scoreTrend = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    const thisWeek = [];
    const lastWeek = [];
    calls.forEach((c) => {
      if (c.overall_score == null) return;
      const raw = c.start_time || c.created_at;
      if (!raw) return;
      const age = now - new Date(raw).getTime();
      if (age >= 0 && age < 7 * DAY) thisWeek.push(c.overall_score);
      else if (age >= 7 * DAY && age < 14 * DAY) lastWeek.push(c.overall_score);
    });
    if (!thisWeek.length || !lastWeek.length) return null;
    const avgThis = thisWeek.reduce((s, v) => s + v, 0) / thisWeek.length;
    const avgLast = lastWeek.reduce((s, v) => s + v, 0) / lastWeek.length;
    if (avgLast === 0) return null;
    return Math.round(((avgThis - avgLast) / avgLast) * 1000) / 10;
  }, [calls]);

  const categoryList = useMemo(() => {
    const vals = calls.map(c => c.category).filter(Boolean);
    return Array.from(new Set(vals)).sort();
  }, [calls]);

  const subCategoryList = useMemo(() => {
    const vals = calls
      .filter(c => categoryFilter === 'all' || c.category === categoryFilter)
      .map(c => c.sub_category)
      .filter(Boolean);
    return Array.from(new Set(vals)).sort();
  }, [calls, categoryFilter]);

  const activeScoreFilterCount = Object.values(scoreFilters).filter((v) => v > 0).length;
  const today = todayStr();
  const totalActiveFilters =
    (dateFilter && dateFilter !== today ? 1 : 0) +
    (search ? 1 : 0) +
    (executiveFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (outcomeFilter !== 'all' ? 1 : 0) +
    (leadFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (subCategoryFilter !== 'all' ? 1 : 0) +
    (sort !== 'newest' ? 1 : 0) +
    activeScoreFilterCount;
  const hasFilters = totalActiveFilters > 0;

  // Count of filters that live inside the "Filters" drawer specifically (badge on the button)
  const panelFilterCount =
    activeScoreFilterCount +
    (categoryFilter !== 'all' ? 1 : 0) +
    (subCategoryFilter !== 'all' ? 1 : 0);

  // Removable chips shown below the search bar for every currently-applied filter
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (dateFilter && dateFilter !== today) {
      chips.push({ key: 'date', label: `Date: ${new Date(dateFilter).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`, onRemove: () => setDateFilter(today) });
    }
    if (search) chips.push({ key: 'search', label: `Search: "${search}"`, onRemove: () => setSearch('') });
    if (executiveFilter !== 'all') chips.push({ key: 'exec', label: `Executive: ${executiveFilter}`, onRemove: () => setExecutiveFilter('all') });
    if (typeFilter !== 'all') chips.push({ key: 'type', label: `Type: ${typeFilter === 'monologue' ? 'Monologue' : 'Dialogue'}`, onRemove: () => setTypeFilter('all') });
    if (outcomeFilter !== 'all') chips.push({ key: 'outcome', label: `Outcome: ${outcomeFilter}`, onRemove: () => setOutcomeFilter('all') });
    if (leadFilter !== 'all') chips.push({ key: 'lead', label: `Lead: ${leadFilter[0].toUpperCase()}${leadFilter.slice(1)}`, onRemove: () => setLeadFilter('all') });
    if (categoryFilter !== 'all') chips.push({ key: 'category', label: `Category: ${categoryFilter}`, onRemove: () => { setCategoryFilter('all'); setSubCategoryFilter('all'); } });
    if (subCategoryFilter !== 'all') chips.push({ key: 'subcategory', label: `Sub Category: ${subCategoryFilter}`, onRemove: () => setSubCategoryFilter('all') });
    SCORE_DIMENSION_FILTERS.forEach(({ dim, label }) => {
      const min = scoreFilters[dim];
      if (min > 0) {
        chips.push({
          key: `score-${dim}`,
          label: `${label}: ${min}+`,
          onRemove: () => {
            setScoreFilters((p) => ({ ...p, [dim]: 0 }));
            setPendingScoreFilters((p) => ({ ...p, [dim]: 0 }));
          },
        });
      }
    });
    return chips;
  }, [dateFilter, today, search, executiveFilter, typeFilter, outcomeFilter, leadFilter, categoryFilter, subCategoryFilter, scoreFilters]);

  const clearAll = () => {
    setDateFilter(today);
    setSearch(''); setExecutiveFilter('all'); setTypeFilter('all');
    setOutcomeFilter('all'); setLeadFilter('all'); setSort('newest');
    setCategoryFilter('all'); setSubCategoryFilter('all');
    setScoreFilters(DEFAULT_SCORE_FILTERS);
    setPendingScoreFilters(DEFAULT_SCORE_FILTERS);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#F87217]">Executive Analytics</p>
          <h1 className="mt-1 font-['Outfit'] text-[28px] font-semibold leading-tight tracking-tight text-foreground">Call Quality Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {dashView === 'calls' && <>
            <Button size="sm" onClick={load} disabled={loading} className="bg-card text-foreground/80 border border-border hover:bg-muted shadow-sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {topPerformers.length > 0 && (
              <Button
                size="sm"
                className={`gap-2 ${showLeaderboard ? 'bg-[#1a2a6c] hover:bg-[#141f52]' : 'bg-[#F87217] hover:bg-[#C2560E]'} text-white shadow-sm`}
                onClick={() => setShowLeaderboard((p) => !p)}
              >
                <Trophy className="w-4 h-4" />
                {showLeaderboard ? 'Hide Leaderboard' : 'Top Performers'}
              </Button>
            )}
          </>}
{dashView === 'calls' && isAdmin && (
            <Button
              variant="outline" size="sm"
              className="border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400"
              onClick={async () => {
                if (!window.confirm('Delete ALL call analysis records and clear Google Sheets? This cannot be undone.')) return;
                try {
                  await clearAllCallAnalysis();
                  toast.success('All call analysis data cleared');
                  load();
                } catch {
                  toast.error('Failed to clear data');
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      {/* Analytics view */}
      {dashView === 'analytics' && <ExecReportAnalytics />}

      {dashView === 'calls' && <>
      {topPerformers.length > 0 && (
        <Leaderboard performers={topPerformers} open={showLeaderboard} onOpenChange={setShowLeaderboard} />
      )}

      {/* KPI cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[#5F5E5A]">Call Quality Overview</h2>
          <span className="text-xs text-[#5F5E5A]">
            {dateFilter ? new Date(dateFilter).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'All dates'}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border-l-4 border-[#F5A623] rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5F5E5A] uppercase tracking-wider">Calls Analysed</span>
              <div className="w-7 h-7 rounded-full bg-[#F5A623]/10 text-[#F5A623] flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-[32px] leading-tight font-medium text-foreground tabular-nums"><AnimatedCount value={filteredStats.total} /></h3>
              <span className="mt-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F5A623]/10 text-[#F5A623]">Calls evaluated by LLM</span>
            </div>
          </div>

          {/* Quality Score — accent card, highest priority metric */}
          <div className="bg-gradient-to-br from-[#1D9E75] to-[#167A5B] border-l-4 border-white/20 rounded-xl p-4 shadow-[0_4px_16px_rgba(29,158,117,0.25)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/75 uppercase tracking-wider">Quality Score</span>
              <div className="w-7 h-7 rounded-full bg-card/15 text-white flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-[32px] leading-tight font-medium text-white tabular-nums">
                {filteredStats.avg != null ? <><AnimatedCount value={filteredStats.avg} />/100</> : '—'}
              </h3>
              <span className="mt-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-card/15 text-white">
                Target: 75/100
              </span>
            </div>
          </div>

          <div className="bg-card border-l-4 border-[#D85A30] rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5F5E5A] uppercase tracking-wider">Issues Detected</span>
              <div className="w-7 h-7 rounded-full bg-[#D85A30]/10 text-[#D85A30] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-[32px] leading-tight font-medium text-foreground tabular-nums"><AnimatedCount value={filteredStats.monologues} /></h3>
              <span className="mt-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#D85A30]/10 text-[#D85A30]">Monologues (agent spoke 85%+)</span>
            </div>
          </div>

          <div className={`bg-card border-l-4 ${scoreTrend == null ? 'border-border' : scoreTrend >= 0 ? 'border-[#639922]' : 'border-[#D85A30]'} rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5F5E5A] uppercase tracking-wider">Trend vs Last Week</span>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${scoreTrend == null ? 'bg-muted text-muted-foreground' : scoreTrend >= 0 ? 'bg-[#639922]/10 text-[#639922]' : 'bg-[#D85A30]/10 text-[#D85A30]'}`}>
                <TrendingUp className={`w-4 h-4 ${scoreTrend != null && scoreTrend < 0 ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-[32px] leading-tight font-medium text-foreground tabular-nums">
                {scoreTrend == null ? '—' : `${scoreTrend > 0 ? '+' : ''}${scoreTrend}%`}
              </h3>
              <span className={`mt-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${scoreTrend == null ? 'bg-muted text-muted-foreground' : scoreTrend >= 0 ? 'bg-[#639922]/10 text-[#639922]' : 'bg-[#D85A30]/10 text-[#D85A30]'}`}>
                {scoreTrend == null ? 'Not enough data yet' : 'Avg score, week over week'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend chart + Quick insights — side by side, chart left-aligned */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <Card className="flex-[3] min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 font-medium justify-start text-left">
              <TrendingUp className="w-4 h-4 text-[#F5A623]" /> Quality Score Trend
              <span className="text-xs font-normal text-[#5F5E5A]">— last 7 days with data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TrendChart data={trendSeries} />
          </CardContent>
        </Card>

        {(topPerformers[0] || needsReviewPerformer) && (
          <div className="flex flex-col gap-3 lg:flex-[2] lg:min-w-0">
            {topPerformers[0] && (
              <div className="flex-1 flex items-center gap-3 rounded-xl border border-[#639922]/25 bg-[#639922]/15 px-4 py-3">
                <span className="text-lg">⚡</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#639922]">Top Performer</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {topPerformers[0].name} — {topPerformers[0].avg} pts avg ({topPerformers[0].callCount} call{topPerformers[0].callCount !== 1 ? 's' : ''})
                  </p>
                </div>
                <Button size="sm" variant="outline" className="border-[#639922]/40 text-[#639922] hover:bg-[#639922]/10 shrink-0" onClick={() => setShowLeaderboard((v) => !v)}>
                  {showLeaderboard ? 'Hide' : 'View'}
                </Button>
              </div>
            )}
            {needsReviewPerformer && needsReviewPerformer.avg < 60 && (
              <div className="flex-1 flex items-center gap-3 rounded-xl border border-[#D85A30]/25 bg-[#D85A30]/15 px-4 py-3">
                <span className="text-lg">🚨</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#D85A30]">Needs Review</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {needsReviewPerformer.name} — {needsReviewPerformer.avg} pts avg ({needsReviewPerformer.callCount} call{needsReviewPerformer.callCount !== 1 ? 's' : ''})
                  </p>
                </div>
                <Button
                  size="sm" variant="outline" className="border-[#D85A30]/40 text-[#D85A30] hover:bg-[#D85A30]/10 shrink-0"
                  onClick={() => setExecutiveFilter((v) => v === needsReviewPerformer.name ? 'all' : needsReviewPerformer.name)}
                >
                  {executiveFilter === needsReviewPerformer.name ? 'Clear Filter' : 'Filter'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter bar — compact top row */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by executive name or recording ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[hsl(var(--surface-2))] border-border rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors ${
              dateFilter
                ? 'bg-[#F87217]/10 border-[#F87217]/40 text-[#F87217]'
                : 'bg-[hsl(var(--surface-2))] border-border text-foreground'
            }`}>
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <input
                type="date"
                value={dateFilter}
                max={today}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent outline-none text-sm cursor-pointer w-[130px]"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="ml-1 text-[10px] font-bold text-[#F87217] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className={`flex items-center h-9 rounded-lg shadow-sm border overflow-hidden ${showFilters ? 'bg-[#F87217] border-[#F87217]' : 'bg-card border-border'}`}>
              <button
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-2 px-3 h-full text-sm font-medium transition-colors ${showFilters ? 'text-white' : 'text-foreground/80 hover:bg-muted'}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {panelFilterCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${showFilters ? 'bg-card/20 text-white' : 'bg-[#F87217] text-white'}`}>
                    {panelFilterCount}
                  </span>
                )}
              </button>
              {panelFilterCount > 0 && (
                <button
                  onClick={() => {
                    setPendingScoreFilters(DEFAULT_SCORE_FILTERS);
                    setScoreFilters(DEFAULT_SCORE_FILTERS);
                    setCategoryFilter('all');
                    setSubCategoryFilter('all');
                  }}
                  title="Clear these filters"
                  aria-label="Clear filters"
                  className={`flex items-center justify-center w-8 h-full border-l transition-colors ${
                    showFilters
                      ? 'border-white/20 text-white/80 hover:bg-card/10 hover:text-white'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-muted-foreground'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              className={`h-9 gap-2 rounded-lg shadow-sm ${selectMode ? 'bg-[#F87217] text-white hover:bg-[#C2560E]' : 'bg-card text-foreground/80 border border-border hover:bg-muted'}`}
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            >
              <MousePointerClick className="w-4 h-4" />
              {selectMode
                ? `${selectedCalls.length} selected`
                : 'Select'}
            </Button>
            <ExecutiveCompareControl scorecards={scorecards} />
            {sheetsUrl && (
              <>
                <a href={sheetsUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-9 gap-2 rounded-lg shadow-sm bg-card text-foreground/80 border border-border hover:bg-muted">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Sheet
                  </Button>
                </a>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="h-9 gap-2 rounded-lg shadow-sm bg-card text-foreground/80 border border-border hover:bg-muted">
                      <Download className="w-3.5 h-3.5" /> Export
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1.5" align="end">
                    {[
                      { fmt: 'pdf', label: 'PDF', icon: FileText },
                      { fmt: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
                      { fmt: 'csv', label: 'CSV', icon: FileType2 },
                    ].map(({ fmt, label, icon: Icon }) => (
                      <a key={fmt} href={exportSheetUrl(fmt)} target="_blank" rel="noopener noreferrer">
                        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-[hsl(var(--surface-2))] text-left">
                          <Icon className="w-4 h-4 text-muted-foreground" /> {label}
                        </button>
                      </a>
                    ))}
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-[#F87217]/8 text-[#F87217] border border-[#F87217]/20"
              >
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="p-0.5 rounded-full hover:bg-[#F87217]/15 transition-colors"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {hasFilters && (
              <button onClick={clearAll} className="text-xs font-semibold text-[#F87217] hover:underline px-1">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters slide-over drawer */}
      <ScheduleDrawer
        open={showFilters}
        onOpenChange={setShowFilters}
        title="Filters"
        subtitle={panelFilterCount > 0 ? `${panelFilterCount} active` : 'Refine the calls shown below'}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-6">
            {/* Call Quality Scores section */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Call Quality Scores</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {SCORE_DIMENSION_FILTERS.map(({ dim, label }) => (
                  <div key={dim}>
                    <p className="text-[11px] text-muted-foreground mb-1.5">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SCORE_CHIP_OPTIONS.map(({ label: cl, value: cv }) => {
                        const active = pendingScoreFilters[dim] === cv;
                        return (
                          <button
                            key={cv}
                            onClick={() => setPendingScoreFilters((p) => ({ ...p, [dim]: cv }))}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                              active
                                ? 'bg-[#F87217] border-[#F87217] text-white'
                                : 'bg-card border-border text-muted-foreground hover:bg-[hsl(var(--surface-2))]'
                            }`}
                          >
                            {cl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead Category section */}
            <div className="pt-5 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Lead Category</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Category</p>
                  <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubCategoryFilter('all'); }}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(var(--surface-2))] border-border rounded-lg">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryList.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Sub Category</p>
                  <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(var(--surface-2))] border-border rounded-lg">
                      <SelectValue placeholder="All Sub Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub Categories</SelectItem>
                      {subCategoryList.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky footer actions — pinned to the bottom of the drawer, not the page */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 px-5 py-4 bg-card border-t border-border flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 bg-[#F87217] hover:bg-[#C2560E] rounded-lg"
              onClick={() => { setScoreFilters({ ...pendingScoreFilters }); setShowFilters(false); }}
            >
              Apply Filters
            </Button>
            <Button
              size="sm" variant="outline" className="rounded-lg"
              onClick={() => { setPendingScoreFilters(DEFAULT_SCORE_FILTERS); setScoreFilters(DEFAULT_SCORE_FILTERS); setCategoryFilter('all'); setSubCategoryFilter('all'); }}
            >
              Reset
            </Button>
          </div>
        </div>
      </ScheduleDrawer>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Analysed Calls
            {hasFilters && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({filteredCalls.length} of {calls.length})
              </span>
            )}
          </CardTitle>

          {selectMode && selectedCalls.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-[hsl(var(--surface-2))] px-4 py-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={downloadSelectedReports}>
                <Download className="w-4 h-4" /> Download Report
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setSelectEmailOpen(true)}>
                <Mail className="w-4 h-4" /> Send via Mail
              </Button>
              <button
                onClick={exitSelectMode}
                className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="pl-4 py-3 w-8">
                      {selectMode && (
                        <Checkbox
                          checked={filteredCalls.length > 0 && filteredCalls.every((c) => selectedCalls.includes(c.audio_id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      )}
                    </th>
                    <th className="px-4 py-3 text-left">Executive</th>
                    <th className="px-4 py-3 text-left">
                      <button
                        className="flex items-center gap-0.5 group"
                        onClick={() => setSort(s => s === 'newest' ? 'oldest' : 'newest')}
                      >
                        Time
                        <span className="flex flex-col ml-1">
                          <ChevronUp className={`w-3 h-3 -mb-1 ${sort === 'oldest' ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
                          <ChevronDown className={`w-3 h-3 ${sort === 'newest' ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <ColFilter label="Type" value={typeFilter} onChange={setTypeFilter}
                        options={[{ label: 'All', value: 'all' }, { label: 'Dialogue', value: 'dialogue' }, { label: 'Monologue', value: 'monologue' }]} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <ColFilter label="Lead" value={leadFilter} onChange={setLeadFilter}
                        options={[{ label: 'All', value: 'all' }, { label: 'Hot', value: 'hot' }, { label: 'Warm', value: 'warm' }, { label: 'Cold', value: 'cold' }]} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <ColFilter label="Outcome" value={outcomeFilter} onChange={setOutcomeFilter}
                        options={[{ label: 'All', value: 'all' }, ...OUTCOME_OPTIONS.map(o => ({ label: o, value: o }))]} />
                    </th>
                    <th className="px-4 py-3 text-left min-w-[180px]">
                      <button
                        className="flex items-center gap-0.5 group"
                        onClick={() => setSort(s => s === 'score_desc' ? 'score_asc' : 'score_desc')}
                      >
                        Score
                        <span className="flex flex-col ml-1">
                          <ChevronUp className={`w-3 h-3 -mb-1 ${sort === 'score_asc' ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
                          <ChevronDown className={`w-3 h-3 ${sort === 'score_desc' ? 'text-[#F87217]' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
                        </span>
                      </button>
                    </th>
                    {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 ? (
                    <tr><td colSpan={99} className="py-12 text-center text-muted-foreground text-sm">No analysed calls yet. Upload a recording to get started.</td></tr>
                  ) : filteredCalls.length === 0 ? (
                    <tr><td colSpan={99} className="py-12 text-center text-muted-foreground text-sm">No calls match the current filters.</td></tr>
                  ) : filteredCalls.map((call, i) => (
                    <CallRow key={call.audio_id || i} call={call} isAdmin={isAdmin} onRefresh={load} onDelete={(id) => setCalls(prev => prev.filter(c => c.audio_id !== id))} weights={weights} selectMode={selectMode} isSelected={selectedCalls.includes(call.audio_id)} onToggle={toggleCall} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email dialog for selected executives */}
      <Dialog open={selectEmailOpen} onOpenChange={(v) => { setSelectEmailOpen(v); if (!v) setSelectEmails([]); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F87217]" />
              Send report via email
            </DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">{selectedCalls.length} call{selectedCalls.length !== 1 ? 's' : ''} selected</p>
          </DialogHeader>
          <div className="space-y-3">
            <MultiEmailInput ref={selectEmailsInputRef} emails={selectEmails} onChange={setSelectEmails} />
            <p className="text-[11px] text-muted-foreground">Press Enter or comma to add each address.</p>
            <Button onClick={sendSelectedReports} disabled={selectSending} className="w-full">
              {selectSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send{selectEmails.length > 1 ? ` (${selectEmails.length})` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
}