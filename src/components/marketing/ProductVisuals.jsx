import { PhoneCall, BarChart2, TrendingUp } from 'lucide-react';

/* ── Voice Agent live-call card (animated waveform) ── */
export function VoiceCard({ className = '', style }) {
  return (
    <div
      className={`w-72 rounded-2xl bg-[var(--deep)] p-5 text-white ring-1 ring-white/10 shadow-2xl ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--brass-2)]">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          Live call
        </span>
        <PhoneCall className="h-4 w-4 text-white/40" />
      </div>
      <p className="mt-4 text-sm font-semibold">Qualifying · John</p>
      <p className="mt-4 text-sm ">Hi! I am ROCKET 🚀 your SmartSDR</p>
      {/* <p className="text-xs text-white/50">Interest: 3 BHK, Mansarovar</p> */}
      <div className="mt-4 flex h-12 items-end gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="mk-wave-bar flex-1 rounded-full bg-gradient-to-t from-[var(--pine)] to-[var(--brass)]"
            style={{ height: '100%', animationDelay: `${(i % 9) * 0.09}s` }}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-300">Interested</span>
        <span className="text-white/50">Site visit booked</span>
      </div>
    </div>
  );
}

/* ── Executive Analytics live-score card (dark, matches VoiceCard) ── */
export function AnalyticsCard({ className = '', style }) {
  const R = 40;
  const LEN = 2 * Math.PI * R;
  const score = 87;
  const offset = LEN * (1 - score / 100);
  const rows = [
    { k: 'Rapport', v: 92 },
    { k: 'Discovery', v: 84 },
    { k: 'Objections', v: 79 },
  ];
  return (
    <div
      className={`w-72 rounded-2xl bg-[var(--deep)] p-5 text-white ring-1 ring-white/10 shadow-2xl ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--brass-2)]">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          Live scoring
        </span>
        <TrendingUp className="h-4 w-4 text-white/40" />
      </div>
      <p className="mt-4 text-sm font-semibold">Call analysed · Sarah A.</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 100 100" className="mk-ring h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
            <circle
              className="mk-ring-val"
              cx="50" cy="50" r={R} fill="none"
              stroke="var(--brass)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={LEN} strokeDashoffset={offset}
              style={{ '--ring-len': `${LEN}px` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold">{score}</span>
            <span className="text-[0.55rem] uppercase tracking-widest text-white/50">score</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {rows.map((r) => (
            <div key={r.k}>
              <div className="flex justify-between text-[0.65rem] text-white/50">
                <span>{r.k}</span><span className="font-semibold text-white/90">{r.v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)]" style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-300">Passed</span>
        <span className="text-white/50">Report ready</span>
      </div>
    </div>
  );
}

/* ── Executive Report score card (animated ring) ── */
export function ReportCard({ className = '', style }) {
  const R = 46;
  const LEN = 2 * Math.PI * R;
  const score = 87;
  const offset = LEN * (1 - score / 100);
  const rows = [
    { k: 'Rapport', v: 92 },
    { k: 'Discovery', v: 84 },
    { k: 'Objections', v: 79 },
  ];
  return (
    <div
      className={`w-72 rounded-2xl bg-white dark:bg-[var(--stone)] p-5 ring-1 ring-[var(--line)] shadow-2xl ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--pine)]">Call quality</span>
        <BarChart2 className="h-4 w-4 text-[var(--mist)]" />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="mk-ring h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--stone)" strokeWidth="10" />
            <circle
              className="mk-ring-val"
              cx="60" cy="60" r={R} fill="none"
              stroke="var(--pine)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={LEN} strokeDashoffset={offset}
              style={{ '--ring-len': `${LEN}px` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mk-display text-3xl font-semibold text-[var(--ink)]">{score}</span>
            <span className="text-[0.6rem] uppercase tracking-widest text-[var(--mist)]">score</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {rows.map((r) => (
            <div key={r.k}>
              <div className="flex justify-between text-[0.7rem] text-[var(--mist)]">
                <span>{r.k}</span><span className="font-semibold text-[var(--ink)]">{r.v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[var(--stone)]">
                <div className="h-full rounded-full bg-[var(--pine)]" style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
