import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Phone, CheckCircle2, XCircle, Users, Timer,
  ShieldAlert, UserX, FileWarning, AlertTriangle, Cpu,
  TrendingUp, TrendingDown, BarChart3, Trophy,
  Target, BookOpen, Mic, MessageSquare,
  Activity, ChevronDown, ChevronUp,
  GitBranch, Brain, Eye, ClipboardCheck, Hourglass,
  Hash, PhoneIncoming, PhoneMissed, PhoneOff, PhoneForwarded
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import KpiCategoryTabs from './KpiCategoryTabs';

/* ─── PALETTE ────────────────────────────────────────── */
const C = {
  primary: '#F87217',
  blue:    '#4a5aa0',
  green:   '#16a34a',
  amber:   '#d97706',
  red:     '#dc2626',
  purple:  '#7c3aed',
  teal:    '#0d9488',
  slate:   '#64748b',
};

/* ─── MOCK DATA (swap with real API responses) ───────── */
const MOCK = {
  totalProcessed: 1284,
  totalEvaluated: 1196,
  volumeTrend: [
    { day: 'Mon', processed: 180, evaluated: 165 },
    { day: 'Tue', processed: 210, evaluated: 195 },
    { day: 'Wed', processed: 225, evaluated: 210 },
    { day: 'Thu', processed: 205, evaluated: 190 },
    { day: 'Fri', processed: 240, evaluated: 225 },
    { day: 'Sat', processed: 120, evaluated: 110 },
    { day: 'Sun', processed: 104, evaluated: 96 },
  ],
  systemHealthIssues: [
    { name: 'Metadata Incomplete', rate: 38.8 },
    { name: 'Unattributed Calls', rate: 5.4 },
    { name: 'Duplicate Recording', rate: 2.1 },
    { name: 'AI Proc. Failure', rate: 0.8 },
  ],
  zohoAccuracy: [
    { name: 'Correct', value: 93.4, color: '#16a34a' },
    { name: 'Wrong Disp.', value: 5.4, color: '#d97706' },
    { name: 'Incorrect DQ', value: 1.2, color: '#dc2626' },
  ],
  incorrectInfoData: [
    { name: 'Price Error', rate: 3.2, color: '#dc2626' },
    { name: 'Availability Error', rate: 4.1, color: '#d97706' },
    { name: 'Location Error', rate: 2.1, color: '#d97706' },
  ],
  zeroScoreTriggers: [
    { reason: 'TAT failure', count: 42 },
    { reason: 'Incorrect Details', count: 35 },
    { reason: 'No Thank You Msg', count: 18 },
  ],
  noOpportunityData: [
    { reason: 'Budget mismatch', count: 54 },
    { reason: 'Wrong property', count: 28 },
    { reason: 'Wrong location', count: 12 },
  ],
  evalSuccessRate: 93.1,
  outOfScopeCount: 47,
  outOfScopeRate: 3.7,
  failedPending: 12,
  callsPerAgentPerDay: 18.4,
  avgCallDuration: '4m 32s',
  auditCoverage: 78.5,
  duplicateRate: 2.1,
  unattributedRate: 5.4,
  metadataCompleteness: 61.2,
  scoreAnomalyCount: 1,
  aiFailureRate: 0.8,
  teamAvgScore: 67.4,
  scoreWeekTrend: [
    { week: 'W1', score: 61.2 },
    { week: 'W2', score: 63.8 },
    { week: 'W3', score: 65.1 },
    { week: 'W4', score: 67.4 },
  ],
  scoreDistribution: [
    { band: '0–25',   count: 18  },
    { band: '25–50',  count: 94  },
    { band: '50–75',  count: 612 },
    { band: '75–100', count: 472 },
  ],
  leaderboard: [
    { name: 'Executive 1', score: 74.3, delta: +13.92 },
    { name: 'Executive 2', score: 68.1, delta: +2.1   },
    { name: 'Executive 3', score: 63.7, delta: -1.4   },
    { name: 'Executive 4', score: 58.9, delta: +0.5   },
  ],
  parameters: [
    { label: 'Introduction/Hook',                             team: 42, zeroRate: 21 },
    { label: 'Adherence to script/Product Knowledge',         team: 71, zeroRate: 4  },
    { label: 'Actively listening/ Responding Appropriately',  team: 68, zeroRate: 6  },
    { label: 'Fumble',                                        team: 58, zeroRate: 9  },
    { label: 'Probing',                                       team: 65, zeroRate: 7  },
    { label: 'Closing',                                       team: 73, zeroRate: 5  },
    { label: 'Objection Handling',                            team: 62, zeroRate: 11 },
    { label: 'Site Visit Persuasion',                         team: 66, zeroRate: 8  },
  ],
  agentConcerns: [
    { name: 'Executive 1', param: 'Introduction/Hook', streak: 2 },
    { name: 'Executive 1', param: 'Fumble',              streak: 2 },
    { name: 'Executive 3', param: 'Closing',             streak: 3 },
    { name: 'Executive 4', param: 'Probing',             streak: 1 },
  ],
  teamMonologueRate: 28.3,
  fumbleDistribution: [
    { band: '0–20',  count: 312 },
    { band: '20–40', count: 198 },
    { band: '40–60', count: 421 },
    { band: '60–80', count: 289 },
    { band: '80+',   count: 76  },
  ],
  fillerWordsPerMin: 2.9,
  agentsBelowFumble: 2,
  incorrectInfo: { overall: 9.4, price: 3.2, availability: 4.1, location: 2.1 },
  uspAmenitiesCoverage: { overall: 58.0, byAgent: [
    { name: 'Shweta', rate: 72 }, { name: 'Executive 1', rate: 65 }, { name: 'Executive 3', rate: 45 }, { name: 'Roshani', rate: 38 },
  ]},
  crossPitch: { attemptRate: 24.5, conversionRate: 12.1 },
  zohoDisposition: { incorrectDisqualification: 1.2, wrongDisposition: 5.4 },
  followUpCapture: { overall: 76.5, byAgent: [
    { name: 'Executive 1', rate: 88 }, { name: 'Executive 3', rate: 82 }, { name: 'Roshani', rate: 75 }, { name: 'Shweta', rate: 45 },
  ]},
  budgetConfirmation: { overall: 89.2, byAgent: [
    { name: 'Executive 1', rate: 95 }, { name: 'Shweta', rate: 92 }, { name: 'Executive 3', rate: 88 }, { name: 'Roshani', rate: 50 },
  ]},
  zeroScore: { rate: 9.4, triggers: [
    { reason: 'TAT failure', count: 42 }, { reason: 'Incorrect Details', count: 35 }, { reason: 'No Thank You Message', count: 18 },
  ]},
  noOpportunityFound: { rate: 7.3, reasons: [
    { reason: 'Budget mismatch', count: 54 }, { reason: 'Wrong property type', count: 28 }, { reason: 'Wrong location', count: 12 },
  ]},
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

/* ─── HELPERS ────────────────────────────────────────── */
const pct = (v) => `${v}%`;
const scoreColor  = (s) => s >= 75 ? C.green : s >= 50 ? C.amber : C.red;
const streakColor = (n) => n >= 3 ? C.red : n === 2 ? C.amber : C.slate;
const streakLabel = (n) => n >= 3 ? '🔴 3+ wks' : n === 2 ? '🟡 2 wks' : '⚪ 1 wk';

/* ─── SUB-COMPONENTS ─────────────────────────────────── */
function SectionHeader({ icon: Icon, title, color = C.primary, desc }) {
  return (
    <div className="flex flex-col gap-1 mb-6 mt-1">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl shadow-sm transition-transform duration-300 hover:rotate-3"
          style={{ background: `${color}14`, border: `1px solid ${color}20` }}>
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
    <div className={`group rounded-2xl border p-5 ${bgStyle} shadow-sm hover:shadow-xl hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between gap-4 backdrop-blur-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 leading-tight">{title}</p>
          <p className="text-xl font-bold tracking-tight tabular-nums" style={{ color }}>{value}</p>
        </div>
        <div className="p-2.5 rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-300 shrink-0" style={{ background: `${color}14`, color }}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-auto">{sub}</p>}
    </div>
  );
}

function ProgressRow({ label, value, zeroRate }) {
  const color = scoreColor(value);
  return (
    <div className="group space-y-2 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="text-slate-700 dark:text-slate-300 font-semibold">{label}</span>
        <div className="flex items-center gap-3">
          {zeroRate > 20 && (
            <span className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-950/30 px-2.5 py-0.5 rounded-full border border-red-200/50 dark:border-red-900/50 flex items-center gap-1 animate-pulse">
              <span>⚠</span> {zeroRate}% zeros
            </span>
          )}
          <span className="font-extrabold tabular-nums px-2 py-0.5 rounded-lg text-xs text-white" style={{ background: color }}>{value}</span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
        <div className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
      </div>
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
            <span className="text-white font-extrabold tabular-nums">{formatter ? formatter(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── CATEGORY SECTION COMPONENTS ─────────────────────── */

function CallVolumeSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Phone} title="Call Volume & Pipeline"
        desc="Total processed metrics representing raw call intake, exclusions, failed calls, and audit coverage." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <StatCard title="Total Calls Processed"  value={m.totalProcessed.toLocaleString()} sub="Raw intake. Every call received and attempted." icon={Phone} color={C.primary} />
          <StatCard title="Total Calls Evaluated"  value={m.totalEvaluated.toLocaleString()} sub={`${pct(m.evalSuccessRate)} success rate.`} icon={CheckCircle2} color={C.green} />
          <StatCard title="Out-of-Scope Calls"     value={`${m.outOfScopeCount} (${pct(m.outOfScopeRate)})`} sub="Auto-excluded. Rising % needs scope retuning." icon={XCircle} color={C.amber} alert={m.outOfScopeRate > 5} />
          <StatCard title="Failed / Pending"        value={m.failedPending} sub="Errored or stuck mid-pipeline. Should be near zero." icon={AlertTriangle} color={m.failedPending > 10 ? C.red : C.green} alert={m.failedPending > 10} />
          <StatCard title="Calls / Agent / Day"    value={m.callsPerAgentPerDay} sub="Average daily volume per agent." icon={Users} color={C.blue} />
          <StatCard title="Avg Call Duration"       value={m.avgCallDuration} sub="Very short = early hang-ups; very long = poor efficiency." icon={Timer} color={C.teal} />
          <StatCard title="Audit Coverage"          value={pct(m.auditCoverage)} sub="Audited calls ÷ total calls per agent per week." icon={ShieldAlert} color={m.auditCoverage < 70 ? C.amber : C.green} />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Daily Call Volume & Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.volumeTrend}>
                  <defs>
                    <linearGradient id="era-colorProcessed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="era-colorEvaluated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.green} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.green} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Area type="monotone" dataKey="processed" name="Processed" stroke={C.blue} strokeWidth={2.5} fill="url(#era-colorProcessed)" />
                  <Area type="monotone" dataKey="evaluated" name="Evaluated" stroke={C.green} strokeWidth={2.5} fill="url(#era-colorEvaluated)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Daily raw call volume vs successfully evaluated calls over the last 7 days.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DataIntegritySection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Cpu} title="Data Integrity & System Health" color={C.purple}
        desc="Key diagnostic logs verifying the precision and alignment of incoming metrics." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <StatCard title="Duplicate Recording Rate"    value={pct(m.duplicateRate)}          sub="Silently inflates every downstream KPI."             icon={FileWarning} color={C.amber} alert={m.duplicateRate > 0} />
          <StatCard title="Unattributed Calls %"        value={pct(m.unattributedRate)}       sub="Username = 'Unknown'. Agent data can't be trusted."   icon={UserX}       color={C.red}   alert={m.unattributedRate > 2} />
          <StatCard title="Metadata Completeness Rate"  value={pct(m.metadataCompleteness)}   sub="% of calls with Date/Time and Duration present."      icon={Activity}    color={C.blue} />
          <StatCard title="Score Anomaly Count"         value={m.scoreAnomalyCount}           sub="Stored Overall Score differs from weighted formula."   icon={AlertTriangle} color={C.red} alert={m.scoreAnomalyCount > 0} />
          <StatCard title="AI Processing Failure Rate"  value={pct(m.aiFailureRate)}          sub="% of attempts where evaluation failed."               icon={Cpu}         color={C.amber} />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Integrity Issues & Anomaly Rates</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.systemHealthIssues} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={16}>
                    {m.systemHealthIssues.map((d, i) => (
                      <Cell key={i} fill={d.rate > 5 ? C.red : C.amber} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Visual comparison of failure rates and data incompleteness points.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeamPerformanceSection({ m }) {
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  return (
    <div className="space-y-6">
      <SectionHeader icon={TrendingUp} title="Overall Team Performance & Rankings" color={C.green}
        desc="Overall team metrics, grade distribution, historical trend, and top agents." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-6">
          <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
            <CardContent className="p-6 flex flex-col gap-6">
              <div className="text-center py-3 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-800/10 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Team Avg Overall Score</p>
                <p className="text-4xl font-extrabold tracking-tight tabular-nums" style={{ color: scoreColor(m.teamAvgScore) }}>{m.teamAvgScore}</p>
                <p className="text-[11px] text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed font-semibold">Weighted composite score averaged across all agents. Core leadership metric.</p>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 text-xs font-extrabold text-[#F87217] dark:text-blue-400 bg-[#F87217]/5 hover:bg-[#F87217]/10 p-2.5 rounded-xl border border-[#F87217]/10 transition-all duration-300"
                onClick={() => setShowLeaderboard(v => !v)}
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                {showLeaderboard ? 'Hide' : 'Show'} Full Leaderboard
                {showLeaderboard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardContent>
          </Card>
          {showLeaderboard && (
            <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg animate-in slide-in-from-top-4 duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Agent Leaderboard</h3>
                </div>
                <div className="space-y-2.5">
                  {m.leaderboard.map((a, i) => (
                    <div key={a.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40">
                      <span className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-extrabold ${i === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : i === 1 ? 'bg-slate-200 text-slate-800 border border-slate-300' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">{a.name}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs flex items-center gap-0.5 font-semibold" style={{ color: a.delta >= 0 ? C.green : C.red }}>
                          {a.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {a.delta >= 0 ? '+' : ''}{a.delta}
                        </span>
                        <span className="font-extrabold tabular-nums text-xs sm:text-sm px-2 py-0.5 rounded-md" style={{ color: scoreColor(a.score), background: `${scoreColor(a.score)}15` }}>{a.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">Overall Score Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.scoreWeekTrend}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[55, 75]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke={C.primary} strokeWidth={3} fill="url(#era-colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Week-on-week trend for team average. The core "are we improving" signal.</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.scoreDistribution}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} calls`} />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    {m.scoreDistribution.map((d) => (
                      <Cell key={d.band} fill={d.band === '75–100' ? C.green : d.band === '50–75' ? C.blue : d.band === '25–50' ? C.amber : C.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Reveals whether the team is uniformly average or split between high/low performers.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ParameterScoresSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={BarChart3} title="8 Parameter Scores" color={C.blue}
        desc="Dimensional performance across script parameters. Detects systemic gaps vs isolated errors." />
      <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {m.parameters.map((p) => <ProgressRow key={p.label} label={p.label} value={p.team} zeroRate={p.zeroRate} />)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-6 space-y-2 border-t border-slate-100 dark:border-slate-800/60 pt-4 leading-relaxed font-medium">
            <p>Where the whole team stands on each of the 8 dimensions. Reveals systemic training gaps vs individual issues.</p>
            <p className="flex items-center gap-1.5 bg-red-50/50 dark:bg-red-950/10 p-2.5 rounded-xl border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              Parameters with zeros above 20% are flagged as high Coaching Priorities requiring direct intervention.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CoachingSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={BookOpen} title="Agent Coaching Streaks" color={C.amber}
        desc="Track continuous operational concerns. Identifies recurring pattern issues at the agent level." />
      <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recurring Concern Streaks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-6 py-3.5 text-left">Agent</th>
                  <th className="px-6 py-3.5 text-left">Parameter</th>
                  <th className="px-6 py-3.5 text-left">Streak Period</th>
                  <th className="px-6 py-3.5 text-left">Escalation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {m.agentConcerns.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">{c.name}</td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold">{c.param}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-700 dark:text-slate-200 text-xs sm:text-sm tabular-nums">{c.streak} week{c.streak > 1 ? 's' : ''}</td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 w-fit"
                        style={{ color: streakColor(c.streak), borderColor: `${streakColor(c.streak)}30`, background: `${streakColor(c.streak)}10` }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-ping shrink-0" style={{ background: streakColor(c.streak) }} />
                        {streakLabel(c.streak).split(' ').slice(1).join(' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-6 pt-4 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/50 mt-2 space-y-1 leading-relaxed font-semibold">
            <p>1 week = neutral, 2 weeks = amber, 3+ weeks = red priority coaching.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ZohoSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={ShieldAlert} title="ZOHO CRM Disposition Accuracy" color={C.red}
        desc="Critical CRM updates tracking live lead management and categorisation errors." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <StatCard title="Incorrect Disqualification" value={pct(m.zohoDisposition.incorrectDisqualification)}
            sub="CRITICAL: Prospect showed interest but marked DQ'd. Kills a live lead." icon={XCircle} color={C.red} alert={m.zohoDisposition.incorrectDisqualification > 0} />
          <StatCard title="Wrong Disposition Rate" value={pct(m.zohoDisposition.wrongDisposition)}
            sub="Minor categorisation errors in CRM (Interested vs Scheduled, wrong callback date)." icon={FileWarning} color={C.amber} />
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Zoho CRM Disposition Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.zohoAccuracy} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16}>
                    {m.zohoAccuracy.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Breakdown of correct entries vs wrong classifications and critical incorrect DQ events.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExecutionMetricsSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Target} title="Detailed Agent Execution Metrics" color={C.purple}
        desc="Granular breakdown of incorrect info, cross-pitching, budget confirmation, and qualitative outcomes." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Incorrect Info Rate"     value={pct(m.incorrectInfo.overall)}          sub="Price, availability, or location errors."    icon={AlertTriangle} color={C.red}   alert={m.incorrectInfo.overall > 5} />
        <StatCard title="USP/Amenities Coverage"  value={pct(m.uspAmenitiesCoverage.overall)}  sub="Both fully shared on call."                 icon={CheckCircle2}  color={C.amber} alert={m.uspAmenitiesCoverage.overall < 70} />
        <StatCard title="Budget Confirmation"     value={pct(m.budgetConfirmation.overall)}     sub="Budget confirmed during probing."           icon={Users}         color={C.teal} />
        <StatCard title="Cross-Pitch Attempt"     value={pct(m.crossPitch.attemptRate)}         sub="Alternative project offered."               icon={GitBranch}     color={C.blue} />
        <StatCard title="Cross-Pitch Conversion"  value={pct(m.crossPitch.conversionRate)}      sub="Prospect interested in alternative."        icon={TrendingUp}    color={C.green} />
        <StatCard title="No Opportunity Found"    value={pct(m.noOpportunityFound.rate)}        sub="Excluded from averages."                    icon={ShieldAlert}   color={C.slate} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Incorrect Info Errors</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.incorrectInfoData} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={16}>
                    {m.incorrectInfoData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Agent Focus Metrics</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">USP & Amenities</th>
                  <th className="px-4 py-3 text-left">Follow-Up Date</th>
                  <th className="px-4 py-3 text-left">Budget Confirmation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {m.uspAmenitiesCoverage.byAgent.map((a, i) => {
                  const followUp = m.followUpCapture.byAgent.find(f => f.name === a.name)?.rate || 0;
                  const budget = m.budgetConfirmation.byAgent.find(b => b.name === a.name)?.rate || 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs">{a.name}</td>
                      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded" style={{ background: `${scoreColor(a.rate)}15`, color: scoreColor(a.rate) }}>{a.rate}%</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded" style={{ background: `${scoreColor(followUp)}15`, color: scoreColor(followUp) }}>{followUp}%</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded" style={{ background: `${scoreColor(budget)}15`, color: scoreColor(budget) }}>{budget}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Zero Score Triggers ({m.zeroScore.rate}%)</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.zeroScoreTriggers} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="reason" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} occurrences`} />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={16} fill={C.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">No Opportunity Found Reasons</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.noOpportunityData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="reason" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32} fill={C.slate} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SpeechQualitySection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Mic} title="Speech Quality, Fluency & Advanced Dimensions" color={C.purple}
        desc="Fluency diagnostics analyzing conversational pace, filler words, monologues, and tone composition." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4 flex flex-col justify-between h-full">
            <StatCard title="Team Monologue Rate" value={pct(m.teamMonologueRate)}
              sub="Agent spoke >85% of the time. Identifies pitching vs conversing." icon={Mic} color={m.teamMonologueRate > 30 ? C.red : C.amber} />
            <StatCard title="Agents Below Fumble Floor" value={m.agentsBelowFumble}
              sub="Agents whose avg Fumble score is below the defined floor." icon={AlertTriangle} color={C.red} alert={m.agentsBelowFumble > 0} />
          </div>
          <div className="space-y-4 flex flex-col justify-between h-full">
            <StatCard title="Filler Words / Min" value={m.fillerWordsPerMin}
              sub="Primary driver of Fumble scores. Target is under 2." icon={MessageSquare} color={m.fillerWordsPerMin > 2 ? C.amber : C.green} />
            <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-md p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">Tone Profile — Team Avg</p>
              <div className="space-y-1.5">
                {[{ label: 'Friendly', val: 72, color: C.green }, { label: 'Assertive', val: 61, color: C.blue }, { label: 'Empathetic', val: 58, color: C.teal }, { label: 'Formal', val: 44, color: C.slate }].map(t => (
                  <div key={t.label} className="group">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">{t.label}</span>
                      <span className="font-extrabold tabular-nums" style={{ color: t.color }}>{t.val}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.val}%`, background: t.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 leading-tight">Friendly+Assertive yields highest conversion; Formal-only yields lowest.</p>
            </Card>
          </div>
        </div>

        <Card className="border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">Fumble Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.fumbleDistribution}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} occurrences`} />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={C.purple} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Histogram reveals hidden clusters — Unknown agents ~30%, Executive 1 ~5–20%.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiReliabilitySection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Brain} title="AI Reliability Monitor" color="#be185d"
        desc="Factuality checks measuring hallucination rates and correctness. Flagged Price or Location mix-ups are damaging to both agents." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="flex flex-col gap-4">
          <StatCard title="AI Hallucination Rate" value={pct(m.hallucinationRate)}
            sub="Factually incorrect or unverifiable statements on live calls." icon={Eye} color="#be185d" alert={m.hallucinationRate > 3} />
          <StatCard title="Calls With ≥1 Hallucination" value={m.callsWithHallucination}
            sub="Absolute count this period. Often more impactful than a %." icon={Hash} color={C.red} alert={m.callsWithHallucination > 30} />
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
                  <Area type="monotone" dataKey="rate" stroke="#be185d" strokeWidth={3} fill="url(#era-colorHallucination)" />
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
      <SectionHeader icon={ClipboardCheck} title="Follow-Up Commitment Accuracy" color={C.teal}
        desc="Tracking promise fulfillment: whether the agent sent details or returned callbacks in time." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Commitment Accuracy" value={pct(m.commitmentAccuracy)}
            sub="Commitments fulfilled ÷ commitments made." icon={ClipboardCheck} color={m.commitmentAccuracy >= 80 ? C.green : C.amber} />
          <StatCard title="Commitments / Call" value={m.commitmentsPerCall}
            sub="Avg promises per call. Many unfulfilled commitments erode trust." icon={GitBranch} color={C.blue} />
          <StatCard title="Avg Time to Fulfil" value={m.avgTimeToFulfil}
            sub="How long after 'I'll send details shortly' it actually takes." icon={Hourglass} color={C.teal} />
          <StatCard title="Broken Commitment Rate" value={pct(m.brokenCommitmentRate)}
            sub="Promises made but not fulfilled in the agreed window." icon={XCircle} color={C.red} alert={m.brokenCommitmentRate > 25} />
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

function ConversionSection({ m }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Target} title="Call Outcomes & Conversion Rates" color={C.teal}
        desc="Post-call outcomes representing ultimate conversion metrics, callback logs, and early disconnects." />
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
                  <Area type="monotone" dataKey="meeting"      name="Meeting %"       stroke={C.green} strokeWidth={2.5} fill="url(#era-colorOutcomeGreen)" />
                  <Area type="monotone" dataKey="notInterested" name="Not Interested %" stroke={C.red}   strokeWidth={2.5} fill="url(#era-colorOutcomeRed)" />
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

/* ─── MAIN COMPONENT ─────────────────────────────────── */
export default function ExecReportAnalytics() {
  const m = MOCK;

  const categories = [
    {
      id: 'call_volume',
      label: 'Call Volume',
      icon: Phone,
      color: C.primary,
      content: <CallVolumeSection m={m} />,
    },
    {
      id: 'data_integrity',
      label: 'Data Integrity',
      icon: Cpu,
      color: C.purple,
      content: <DataIntegritySection m={m} />,
    },
    {
      id: 'team_performance',
      label: 'Team Performance',
      icon: TrendingUp,
      color: C.green,
      content: <TeamPerformanceSection m={m} />,
    },
    {
      id: 'parameter_scores',
      label: 'Parameter Scores',
      icon: BarChart3,
      color: C.blue,
      content: <ParameterScoresSection m={m} />,
    },
    {
      id: 'coaching',
      label: 'Agent Coaching',
      icon: BookOpen,
      color: C.amber,
      content: <CoachingSection m={m} />,
    },
    {
      id: 'zoho_crm',
      label: 'ZOHO CRM',
      icon: ShieldAlert,
      color: C.red,
      content: <ZohoSection m={m} />,
    },
    {
      id: 'execution',
      label: 'Execution Metrics',
      icon: Target,
      color: C.purple,
      content: <ExecutionMetricsSection m={m} />,
    },
    {
      id: 'speech_quality',
      label: 'Speech Quality',
      icon: Mic,
      color: C.purple,
      content: <SpeechQualitySection m={m} />,
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
      label: 'Follow-Up',
      icon: ClipboardCheck,
      color: C.teal,
      content: <CommitmentSection m={m} />,
    },
    {
      id: 'conversion',
      label: 'Conversion',
      icon: TrendingUp,
      color: C.green,
      content: <ConversionSection m={m} />,
    },
  ];

  return (
    <div className="mt-2 relative">
      {/* SVG gradient definitions */}
      <svg className="absolute w-0 h-0" width="0" height="0">
        <defs>
          <linearGradient id="era-colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.primary} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C.primary} stopOpacity={0.0}  />
          </linearGradient>
          <linearGradient id="era-colorHallucination" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#be185d" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#be185d" stopOpacity={0.0}  />
          </linearGradient>
          <linearGradient id="era-colorOutcomeGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C.green} stopOpacity={0.0}  />
          </linearGradient>
          <linearGradient id="era-colorOutcomeRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.red} stopOpacity={0.35} />
            <stop offset="95%" stopColor={C.red} stopOpacity={0.0}  />
          </linearGradient>
        </defs>
      </svg>

      <KpiCategoryTabs categories={categories} defaultTab="call_volume" />
    </div>
  );
}
