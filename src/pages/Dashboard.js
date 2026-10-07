import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, PhoneCall, ArrowUpRight, BarChart2, Gauge, Mic, Layers, Calendar, BookOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { VoiceCard, AnalyticsCard } from '@/components/marketing/ProductVisuals';

const PRODUCTS = [
  {
    name: 'Voice Agent',
    category: 'Autonomous lead calling',
    desc: 'Intelligent AI voice qualification for real-estate lead calls, automating prospect engagement and follow-ups.',
    icon: PhoneCall,
    path: '/voice_agent',
    chips: [
      { icon: Layers, label: 'Campaign builder' },
      { icon: Calendar, label: 'Scheduling' },
      { icon: BookOpen, label: 'Knowledge base' },
    ],
    visual: <VoiceCard />,
    panel: 'from-[var(--pine)] to-[var(--deep)]',
  },
  {
    name: 'Executive Analytics',
    category: 'Call intelligence for managers',
    desc: 'AI-powered executive reporting with call-quality analysis and performance matching for real-estate operations.',
    icon: TrendingUp,
    path: '/call-quality',
    chips: [
      { icon: BarChart2, label: 'Call-quality scoring' },
      { icon: Gauge, label: 'Team overview' },
      { icon: Mic, label: 'Audio upload' },
    ],
    visual: <AnalyticsCard />,
    panel: 'from-[var(--pine)] to-[var(--deep)]',
  },
];

const fade = (delay) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
});

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="mk bg-transparent">
      {/* Hero header band */}
      <div className="relative overflow-hidden bg-[var(--deep)] px-4 pt-12 pb-28 md:px-8">
        <div className="mk-aurora pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.4), transparent 62%)' }} />
        <div className="mk-aurora pointer-events-none absolute -right-20 top-0 h-[22rem] w-[22rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.26), transparent 62%)', animationDelay: '4s' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 72%)' }} />

        <div className="relative mx-auto w-full max-w-6xl">
          <motion.p {...fade(0)} className="mk-eyebrow text-[var(--brass-2)]">Your workspace</motion.p>
          <motion.h1 {...fade(0.08)} className="mk-display mt-3 text-[2.4rem] font-semibold leading-[1.03] text-white md:text-[3rem]">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </motion.h1>
          <motion.p {...fade(0.16)} className="mt-3 max-w-xl text-white/60">
            Two agents, one login. Open a workspace to score your calls or launch a voice campaign.
          </motion.p>
        </div>
      </div>

      {/* Agent cards */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 md:px-0">
        <div className="grid gap-6 lg:grid-cols-2">
          {PRODUCTS.map((p, i) => (
            <motion.button key={p.name} {...fade(0.35 + i * 0.1)} onClick={() => navigate(p.path)}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--pine)] hover:shadow-[0_50px_90px_-50px_rgba(248,114,23,0.55)] dark:bg-[var(--stone)]"
            >
              <div className={`relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br ${p.panel}`}>
                <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
                  style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                <div className="scale-[0.92] transition-transform duration-500 group-hover:scale-[0.98]">
                  {p.visual || <p.icon className="h-24 w-24 text-white/80" strokeWidth={1.2} />}
                </div>
                <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-emerald-600 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready
                </span>
              </div>

              <div className="flex flex-1 flex-col p-7">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pine)] to-[var(--brass)] text-white shadow-md">
                    <p.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--pine)]">{p.category}</span>
                </div>
                <h2 className="mk-display mt-4 text-[1.8rem] font-semibold text-[var(--ink)]">{p.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mist)]">{p.desc}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {p.chips.map((c) => (
                    <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--stone)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]">
                      <c.icon className="h-3.5 w-3.5 text-[var(--pine)]" /> {c.label}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[var(--line)] pt-5">
                  <span className="text-sm font-semibold text-[var(--pine)]">Open {p.name}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--stone)] text-[var(--pine)] transition-all duration-300 group-hover:bg-[var(--pine)] group-hover:text-white">
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
