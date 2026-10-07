import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  XCircle, Clock, Target,
  Brain, Eye, ClipboardCheck, Hourglass,
  Hash, GitBranch,
  PhoneIncoming, PhoneMissed, PhoneOff, PhoneForwarded,
  ArrowUpRight, HelpCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import KpiCategoryTabs from './KpiCategoryTabs';

/* ─── PALETTE ─── */
const C = {
  primary: '#F87217',
  blue:    '#4a5aa0',
  green:   '#16a34a',
  amber:   '#d97706',
  red:     '#dc2626',
  teal:    '#0d9488',
  slate:   '#64748b',
};

/* ─── MOCK DATA ─── */
const MOCK = {
  // Voice Agent specific latency/escalation data
  avgResponseLatency: 1420,
  responsesOver2s:    12.6,
  fallbackRate:       8.3,
  humanEscalationRate: 5.1,
  fallbackByQuestion: [
    { type: 'Legal / Registry',    count: 34 },
    { type: 'Possession Timeline', count: 28 },
    { type: 'Pricing Negotiation', count: 19 },
    { type: 'Loan Pre-approval',   count: 14 },
  ],
  latencyTrend: [
    { week: 'W1', latency: 1540, escalation: 6.2 },
    { week: 'W2', latency: 1490, escalation: 5.8 },
    { week: 'W3', latency: 1450, escalation: 5.4 },
    { week: 'W4', latency: 1420, escalation: 5.1 },
  ],

  // AI RELIABILITY
  hallucinationRate: 4.7,
  hallucinationByCategory: [
    { category: 'Price',     rate: 2.1 },
    { category: 'Location',  rate: 1.3 },
    { category: 'Amenity',   rate: 0.8 },
    { category: 'Loan/Fin.', rate: 0.5 },
  ],
  hallucinationTrend: [
    { week: 'W1', rate: 6.2 },
    { week: 'W2', rate: 5.8 },
    { week: 'W3', rate: 5.1 },
    { week: 'W4', rate: 4.7 },
  ],
  callsWithHallucination: 47,

  // FOLLOW-UP COMMITMENT
  commitmentAccuracy: 68.3,
  commitmentsPerCall: 2.4,
  commitmentByType: [
    { type: 'Site Visit Confirmation', rate: 74 },
    { type: 'Location Details Sent',   rate: 81 },
    { type: 'Callback Completed',      rate: 52 },
    { type: 'Brochure / Info Shared',  rate: 63 },
  ],
  avgTimeToFulfil: '3h 14m',
  brokenCommitmentRate: 31.7,

  // CALL OUTCOMES
  meetingConversionRate: 22.4,
  callbackRate: 18.7,
  notInterestedRate: 34.1,
  disconnectedRate: 12.8,
  outcomeTrend: [
    { week: 'W1', meeting: 18.2, notInterested: 37.4 },
    { week: 'W2', meeting: 20.1, notInterested: 35.8 },
    { week: 'W3', meeting: 21.3, notInterested: 34.9 },
    { week: 'W4', meeting: 22.4, notInterested: 34.1 },
  ],
};

const pct = (v) => `${v}%`;
const scoreColor = (s) => s >= 75 ? C.green : s >= 50 ? C.amber : C.red;

/* ─── SUB-COMPONENTS ─── */
function SectionHeader({ icon: Icon, title, color = C.primary, desc }) {
  return (
    <div className="flex flex-col gap-1 mb-6 mt-1">
      <div className="flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl shadow-sm transition-transform duration-300 hover:rotate-3"
          style={{ background: `${color}14`, border: `1px solid ${color}20` }}
        >
          <Icon className="w-5 h-5 shrink-0" style={{ color }} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
          {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{desc}</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color = C.primary, alert = false }) {
  const bgStyle = alert
    ? 'border-red-200 bg-gradient-to-br from-red-50/50 to-red-100/20 dark:from-red-950/20 dark:to-red-900/10'
    : 'border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900';

  return (
    <div
      className={`group rounded-2xl border p-5 ${bgStyle} shadow-sm hover:shadow-xl hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between gap-4 backdrop-blur-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 leading-tight">
            {title}
          </p>
          <p className="text-xl font-bold tracking-tight tabular-nums" style={{ color }}>
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-300 shrink-0"
          style={{ background: `${color}14`, color }}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {sub && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-auto">
          {sub}
        </p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/50 px-3 py-2.5 rounded-xl shadow-xl text-xs">
      <p className="font-bold text-slate-400 mb-1">{label}</p>
      <div className="space-y-1">
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-white font-extrabold tabular-nums">
              {formatter ? formatter(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── CATEGORY SECTIONS ─── */

function LatencySection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Clock}
        title="Latency, Fallback & Escalation"
        color={C.amber}
        desc="Real-time voice AI performance — response delays, unanswered questions, and human hand-offs."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <StatCard
            title="Avg Response Latency"
            value={`${m.avgResponseLatency}ms`}
            sub="How long the AI takes to respond mid-conversation. High latency creates awkward silences."
            icon={Hourglass}
            color={m.avgResponseLatency > 1500 ? C.amber : C.green}
          />
          <StatCard
            title="Responses Over 2s"
            value={pct(m.responsesOver2s)}
            sub="% of responses exceeding the 2-second threshold. Causes prospect disengagement."
            icon={Clock}
            color={m.responsesOver2s > 10 ? C.red : C.amber}
            alert={m.responsesOver2s > 15}
          />
          <StatCard
            title="Fallback / Non-Answer Rate"
            value={pct(m.fallbackRate)}
            sub="Agent hit a question it can't handle — distinct from hallucination. Informs prompt gaps."
            icon={HelpCircle}
            color={m.fallbackRate > 10 ? C.red : C.amber}
          />
          <StatCard
            title="Human Escalation Rate"
            value={pct(m.humanEscalationRate)}
            sub="% of calls handed off to a human. A rising rate means the prompt needs updating."
            icon={ArrowUpRight}
            color={m.humanEscalationRate > 8 ? C.red : C.amber}
          />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Latency & Escalation Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.latencyTrend}>
                  <defs>
                    <linearGradient id="va-colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.amber} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.amber} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" width={40} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Area yAxisId="left" type="monotone" dataKey="latency" name="Latency (ms)" stroke={C.amber} strokeWidth={2.5} fill="url(#va-colorLatency)" />
                  <Area yAxisId="right" type="monotone" dataKey="escalation" name="Escalation %" stroke={C.red} strokeWidth={2.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Tracks mid-conversation delays and escalation rates over the last 4 weeks.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Fallback Triggers by Question Type</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.fallbackByQuestion} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={16}>
                    {m.fallbackByQuestion.map((d, i) => (
                      <Cell key={i} fill={C.amber} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              High-count question types indicate gaps in the active prompt knowledge base that require immediate attention.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiReliabilitySection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Brain}
        title="AI Reliability Monitor"
        color="#be185d"
        desc="Factuality checks measuring hallucination rates and correctness. Flagged Price or Location mix-ups are damaging to both agents."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="flex flex-col gap-4">
          <StatCard
            title="AI Hallucination Rate"
            value={pct(m.hallucinationRate)}
            sub="Factually incorrect or unverifiable statements on live calls."
            icon={Eye}
            color="#be185d"
            alert={m.hallucinationRate > 3}
          />
          <StatCard
            title="Calls With ≥1 Hallucination"
            value={m.callsWithHallucination}
            sub="Absolute count this period. Often more impactful than a %."
            icon={Hash}
            color={C.red}
            alert={m.callsWithHallucination > 30}
          />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Hallucination Rate by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.hallucinationByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={70} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={16}>
                    {m.hallucinationByCategory.map((d) => (
                      <Cell key={d.category} fill={d.category === 'Price' ? C.red : d.category === 'Location' ? C.amber : C.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Price hallucinations are far more damaging than amenity mix-ups.</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Hallucination Rate Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.hallucinationTrend}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Area type="monotone" dataKey="rate" stroke="#be185d" strokeWidth={3} fill="url(#va-colorHallucination)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Is the model getting more or less reliable over time, especially after prompt updates.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CommitmentSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ClipboardCheck}
        title="Follow-Up Commitment Accuracy"
        color={C.teal}
        desc="Tracking promise fulfillment: whether the agent sent details or returned callbacks in time."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Commitment Accuracy"
            value={pct(m.commitmentAccuracy)}
            sub="Commitments fulfilled ÷ commitments made."
            icon={ClipboardCheck}
            color={m.commitmentAccuracy >= 80 ? C.green : C.amber}
          />
          <StatCard
            title="Commitments / Call"
            value={m.commitmentsPerCall}
            sub="Avg promises per call. Many unfulfilled commitments erode trust."
            icon={GitBranch}
            color={C.blue}
          />
          <StatCard
            title="Avg Time to Fulfil"
            value={m.avgTimeToFulfil}
            sub="How long after 'I'll send details shortly' it actually takes."
            icon={Hourglass}
            color={C.teal}
          />
          <StatCard
            title="Broken Commitment Rate"
            value={pct(m.brokenCommitmentRate)}
            sub="Promises made but not fulfilled in the agreed window."
            icon={XCircle}
            color={C.red}
            alert={m.brokenCommitmentRate > 25}
          />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Commitment Fulfilment Rate by Type</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-4">
              {m.commitmentByType.map((c) => {
                const color = scoreColor(c.rate);
                return (
                  <div key={c.type} className="group space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{c.type}</span>
                      <span className="font-extrabold px-2 py-0.5 rounded-lg text-white text-xs" style={{ background: color }}>{c.rate}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.rate}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">Different commitment types have very different fulfilment rates. Callbacks are consistently the weakest.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OutcomesSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Target}
        title="Call Outcomes & Conversion Rates"
        color={C.teal}
        desc="Post-call outcomes representing ultimate conversion metrics, callback logs, and early disconnects."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Meeting Conversion Rate" value={pct(m.meetingConversionRate)} sub="Prospect agreed for the meeting. The closest proxy to a sales result." icon={PhoneIncoming} color={C.green} />
          <StatCard title="Callback Requested"      value={pct(m.callbackRate)}          sub="A softer positive signal."                                              icon={PhoneForwarded} color={C.blue} />
          <StatCard title="Not Interested Rate"     value={pct(m.notInterestedRate)}     sub="A rising rate may indicate script or targeting issues."                 icon={PhoneMissed}   color={C.amber} />
          <StatCard title="Prospect Disconnected"   value={pct(m.disconnectedRate)}      sub="Abrupt hang-up. High rates point to poor rapport in the opening."       icon={PhoneOff}      color={C.red} alert={m.disconnectedRate > 15} />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Outcome Trend — Week on Week</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.outcomeTrend}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Area type="monotone" dataKey="meeting"      name="Meeting %"       stroke={C.green} strokeWidth={2.5} fill="url(#va-colorOutcomeGreen)" />
                  <Area type="monotone" dataKey="notInterested" name="Not Interested %" stroke={C.red}   strokeWidth={2.5} fill="url(#va-colorOutcomeRed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Are meeting conversions improving week on week, or is the not-interested rate climbing.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function VoiceAgentAnalytics() {
  const m = MOCK;

  const categories = [
    {
      id: 'call_performance',
      label: 'Call Performance',
      icon: Clock,
      color: C.amber,
      content: <LatencySection m={m} />,
    },
    {
      id: 'ai_reliability',
      label: 'AI Reliability',
      icon: Brain,
      color: '#be185d',
      content: <AiReliabilitySection m={m} />,
    },
    {
      id: 'commitments',
      label: 'Follow-Up Commitments',
      icon: ClipboardCheck,
      color: C.teal,
      content: <CommitmentSection m={m} />,
    },
    {
      id: 'conversion',
      label: 'Conversion Metrics',
      icon: Target,
      color: C.green,
      content: <OutcomesSection m={m} />,
    },
  ];

  return (
    <div className="mt-2 relative">
      {/* SVG Gradient Definitions */}
      <svg className="absolute w-0 h-0" width="0" height="0">
        <defs>
          <linearGradient id="va-colorHallucination" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#be185d" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#be185d" stopOpacity={0.0}  />
          </linearGradient>
          <linearGradient id="va-colorOutcomeGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C.green} stopOpacity={0.0}  />
          </linearGradient>
          <linearGradient id="va-colorOutcomeRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.red} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C.red} stopOpacity={0.0}  />
          </linearGradient>
        </defs>
      </svg>

      <KpiCategoryTabs categories={categories} defaultTab="call_performance" />
    </div>
  );
}
