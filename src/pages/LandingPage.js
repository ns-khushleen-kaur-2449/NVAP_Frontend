import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Sparkles, PhoneCall, TrendingUp, BarChart2, Mic, Table2,
  Sliders, Layers, Calendar, BookOpen, CheckCircle2, Gauge, PhoneOutgoing, ClipboardList,
  Plus, PlayCircle, Zap, ShieldCheck, Target, FileSearch, Brain, GitBranch, Quote,
} from 'lucide-react';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import HeroWave3D from '@/components/marketing/HeroWave3D';
import { VoiceCard } from '@/components/marketing/ProductVisuals';
import HelperCharacter from '@/components/shared/HelperCharacter';
import { cn } from '@/lib/utils';

import hubspot from '@/assets/hubspot.png';
import salesforce from '@/assets/salesforce.png';
import azure from '@/assets/azure.png';
import dynamics from '@/assets/dynamics.png';
import twilio from '@/assets/twilio.png';
import zoho from '@/assets/zoho.png';

const LOGOS = [hubspot, salesforce, azure, dynamics, twilio, zoho];

const MEETINGS = [
  { a: 'AR', b: 'PK', days: 2 }, { a: 'SM', b: 'DV', days: 8 }, { a: 'RJ', b: 'NK', days: 3 },
  { a: 'VT', b: 'AS', days: 8 }, { a: 'MK', b: 'RP', days: 4 }, { a: 'KG', b: 'HT', days: 3 },
  { a: 'DN', b: 'SB', days: 4 }, { a: 'PA', b: 'JM', days: 1 },
];

const STATS = [
  { v: '3.4×', k: 'more qualified conversations' },
  { v: '87%', k: 'average call-quality score' },
  { v: '24/7', k: 'autonomous lead calling' },
  { v: '<2min', k: 'from call to scored report' },
];

const OFFERINGS = [
  {
    id: 'voice-agent',
    name: 'Voice Agent',
    tag: 'Autonomous lead calling',
    icon: PhoneCall,
    blurb:
      'An intelligent AI voice system that qualifies leads — build a campaign, let the agent call, and every conversation lands back in your logs.',
    features: [
      { icon: Layers, label: 'Lead-to-campaign builder' },
      { icon: PhoneOutgoing, label: 'Autonomous calls' },
      { icon: BookOpen, label: 'Grounded knowledge base' },
      { icon: Calendar, label: 'Auto scheduling' },
      { icon: ClipboardList, label: 'Full call logs' },
    ],
  },
  {
    id: 'executive-report',
    name: 'Executive Analytics',
    tag: 'Call intelligence for managers',
    icon: TrendingUp,
    blurb:
      'AI-powered executive reporting with call-quality analysis. Every recorded call is scored, summarised, and rolled up so managers see exactly what is working.',
    features: [
      { icon: BarChart2, label: 'Call-quality scoring' },
      { icon: Gauge, label: 'Team overview' },
      { icon: Mic, label: 'Audio upload' },
      { icon: Sliders, label: 'Tunable rubric' },
      { icon: Table2, label: 'Sheets sync' },
    ],
  },
];

const STEPS = [
  { n: '01', t: 'Connect your calls and leads', d: 'Upload call recordings, import a lead list, or sync from your sheet. No new process to learn.' },
  { n: '02', t: 'Let the agents do the work', d: 'The Voice Agent calls and qualifies leads while Executive Analytics scores and summarises every conversation.' },
  { n: '03', t: 'Act on what matters', d: 'Managers open a clear executive report; agents follow the leads that are ready to move.' },
];

const PLANS = [
  {
    name: 'Solo', tagline: 'A sales team of one', highlight: false,
    priceQ: '$199', priceA: '$2,199', periodQ: '/mo', periodA: '/yr',
    billingQ: 'billed quarterly, cancel anytime', billingA: 'billed annually, cancel anytime',
    desc: 'For solo agents and small teams who want more qualified conversations without more headcount.',
    specs: ['200 AI-qualified calls/month', '1 user', '1 Voice Agent seat · 1 phone line'],
    // features: [
    //   'Rocket AI, your expert real-estate GTM agent',
    //   'AI-qualified calls & follow-ups on autopilot',
    //   'Unlimited AI call scripts & personas',
    //   'Turnkey phone-line setup',
    //   'Native 2-way HubSpot CRM sync',
    //   'Self-serve onboarding, set up in minutes',
    //   'Email & in-app chat support',
    // ],
    footnote: 'Start now without a sales call',
    cta: 'Explore',
  },
  {
    name: 'Explore', tagline: 'Most popular', highlight: true,
    priceQ: '$799', priceA: '$8,399', periodQ: '/mo', periodA: '/yr',
    billingQ: 'billed quarterly, payment in advance', billingA: 'billed annually, payment in advance',
    desc: 'For proving voice outreach can fill your pipeline.',
    specs: ['800 AI-qualified calls/month', 'Unlimited users', '2 Voice Agent seats · 6 phone lines'],
    // features: [
    //   'Everything in Solo, plus:',
    //   'AI research & monitoring of your HubSpot data',
    //   'Lead signals: property views, portal activity & keyword tracking',
    //   'Works with your existing lead lists',
    //   'Dedicated onboarding specialist',
    //   '24/7 Slack support',
    //   'Per-campaign managed service available for +$149/campaign',
    //   'Monthly check-in & webinar',
    // ],
    cta: 'Choose Explore',
  },
  {
    name: 'Scale', tagline: 'Get results faster', highlight: false,
    priceQ: '$1,999', priceA: '$23,999', periodQ: '/mo', periodA: '/yr',
    billingQ: 'billed quarterly, payment in advance', billingA: 'billed annually, payment in advance',
    desc: 'For making voice outreach a channel you can count on.',
    specs: ['2,500 AI-qualified calls/month', 'Unlimited users', '6 Voice Agent seats · 18 phone lines'],
    // features: [
    //   'Everything in Explore, plus:',
    //   'Native two-way Salesforce CRM sync',
    //   'AI research & monitoring of HubSpot & Salesforce data',
    //   'AI voicemail drops & personalized call scripts',
    //   'Website visitor tracking, enrichment & outreach',
    //   'Dedicated onboarding specialist',
    //   'Fully managed service available for +$2,500/mo',
    //   'Priority support with bi-weekly performance review calls',
    // ],
    cta: 'Choose Scale',
  },
];

// The annual toggle used to advertise a hard-coded "save 20%". Derive it from
// PLANS instead so the badge cannot quietly contradict the prices above — the
// numbers are parsed back out of the display strings rather than duplicated,
// so there is one place to edit a price.
const _priceNum = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

const MAX_ANNUAL_SAVING_PCT = Math.max(
  0,
  ...PLANS.map((p) => {
    const yearAtQuarterlyRate = _priceNum(p.priceQ) * 12;
    if (!yearAtQuarterlyRate) return 0;
    return Math.round(((yearAtQuarterlyRate - _priceNum(p.priceA)) / yearAtQuarterlyRate) * 100);
  })
);

const WHAT = [
  { n: '01', icon: Target, t: 'Call every lead, not just the easy ones', d: 'The Voice Agent works your entire list autonomously — no lead goes cold because a rep ran out of hours.' },
  { n: '02', icon: FileSearch, t: 'Score every call on real criteria', d: 'Rapport, discovery, objection handling and more — each conversation is graded against a rubric you control.' },
  { n: '03', icon: Brain, t: 'Two agents, one connected brain', d: 'Voice Agent qualifies; Executive Analytics explains. Managers see exactly what is working across the whole team.' },
  { n: '04', icon: GitBranch, t: 'Fits how your brokerage sells', d: 'Bring your leads, recordings and sheets. Tune the scoring rubric to your market — no rip-and-replace.' },
  { n: '05', icon: Zap, t: 'Answers in minutes, not weeks', d: 'From a finished call to a scored, summarised report in under two minutes. Act while the lead is still warm.' },
];

const BUILT_FOR = [
  'Real-estate teams that need more qualified conversations',
  'Sales leaders tired of guessing which calls worked',
  'Brokerages with more leads than reps can call',
  'Managers who want a clear, scored view of every agent',
  'Teams that value human judgment, amplified by AI',
];

const CALLED_LEADS = [
  { name: 'Priya S.', days: 2, transcript: '"Hi Priya, this is SmartSDR calling about the 3BHK listing in Mansarovar you enquired about. I can see it fits your budget and timeline — would a site visit this weekend work for you?"' },
  { name: 'Rohan M.', days: 8, transcript: '"Hi Rohan, following up on the 2BHK near Vaishali Nagar. You mentioned looking to move in by next quarter — I have three units matching your criteria, want me to line up a walkthrough?"' },
  { name: 'Ananya K.', days: 3, transcript: '"Hi Ananya, thanks for your interest in the Jagatpura villa project. Based on your budget, I\'ve shortlisted two plots — shall I get an agent to call you with pricing details?"' },
  { name: 'Vikram T.', days: 8, transcript: '"Hi Vikram, checking in on the commercial space enquiry in Malviya Nagar. The unit you liked is still available — should I hold a slot for a site visit this week?"' },
  { name: 'Sneha R.', days: 4, transcript: '"Hi Sneha, your saved search for 4BHK in Civil Lines just matched a new listing. It\'s priced within your range — would you like me to schedule a viewing?"' },
];

const LIVE_STATS = [
  { icon: PhoneOutgoing, label: 'Site visits booked', value: '312', trend: '+22%' },
  { icon: PhoneCall, label: 'Leads engaged', value: '1,886', trend: '+18%' },
  { icon: TrendingUp, label: 'Qualification rate', value: '0.42', trend: '+0.1%' },
];

const TESTIMONIALS = [
  { q: 'Every call finally gets scored the same way. Coaching my team went from guesswork to a 10-minute review.', n: 'Sales Manager', r: 'Residential brokerage' },
  { q: 'The Voice Agent worked a stale lead list overnight and booked site visits we would have written off.', n: 'Team Lead', r: ' developer' },
  { q: 'Managers used to argue about which calls were good. Now the report just tells us — with the transcript to back it up.', n: 'Operations Head', r: 'Property advisory' },
];

const FAQS = [
  { q: 'What exactly are the two agents?', a: 'Voice Agent autonomously calls and qualifies your leads. Executive Analytics scores and summarises every call so managers get a clear executive view. Both come in every plan.' },
  { q: 'Do I need to change my current tools?', a: 'No. Import a lead list, drop in recordings, or sync from Google Sheets. SmartSDR fits around the way your brokerage already works.' },
  { q: 'How fast is a call scored?', a: 'Under two minutes from the end of a call to a fully scored, summarised report — rapport, discovery, objection handling and more.' },
  { q: 'Is my data secure?', a: 'Enterprise plans include SSO and role-based access. Your call data stays yours and is never used to train shared models.' },
  { q: 'Can I tune how calls are scored?', a: 'Yes. The scoring rubric is fully configurable so it reflects how your brokerage actually sells.' },
];

/* ── Reveal: rises in on scroll down, settles back on scroll up ── */
function Reveal({ children, className, delay = 0, y = 44 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

const HEADLINE = ['The', 'Future', 'of', 'Sales', 'starts', 'with', 'Smart', 'Conversation.'];

/* ── Reusable gradient CTA card (used near the top) ── */
function CtaCard({ navigate }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--pine)] via-[var(--pine-2)] to-[var(--deep)] px-8 py-14 text-center text-white md:px-16 md:py-20">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-40 mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent 60%)' }} />
      <div className="pointer-events-none absolute -right-16 -bottom-10 h-64 w-64 rounded-full opacity-30 mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(255,217,168,0.5), transparent 60%)', animationDelay: '5s' }} />
      <h2 className="mk-display relative mx-auto max-w-3xl text-[2.2rem] font-semibold leading-[1.05] md:text-[3.2rem]">
        See it run on your own calls
      </h2>
      <p className="relative mx-auto mt-5 max-w-xl text-[1.05rem] text-white/85">
        Sign in to launch a Voice Agent campaign or drop in a recording and get a scored report back.
      </p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-4">
        <button onClick={() => navigate('/login')}
          className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[0.95rem] font-semibold text-[var(--pine)] transition-all hover:-translate-y-0.5">
          Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-[0.95rem] font-semibold text-white transition-all hover:bg-white/10">
          <ShieldCheck className="h-4 w-4" /> Sign in
        </button>
      </div>
    </div>
  );
}

/* ── Sticky-progress steps ── */
function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.7', 'end 0.4'] });
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="how" className="scroll-mt-24 relative overflow-hidden bg-[var(--deep)] px-6 py-28 text-white md:px-10 md:py-36">
      <div className="pointer-events-none absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full opacity-40 mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.5), transparent 60%)' }} />
      <div className="relative mx-auto max-w-[1200px]">
        <Reveal className="mb-16 max-w-2xl">
          <p className="mk-eyebrow text-[var(--brass-2)]">Why SmartSDR</p>
          <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] md:text-[3.4rem]">
            From raw calls to clear decisions
          </h2>
        </Reveal>

        <div ref={ref} className="relative grid gap-10 md:grid-cols-3">
          <div className="absolute left-0 top-6 hidden h-[2px] w-full bg-white/10 md:block">
            <motion.div className="h-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)]" style={{ width: fill }} />
          </div>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="relative">
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pine)] text-sm font-bold text-white shadow-[0_0_30px_rgba(248,114,23,0.5)]">
                {s.n}
              </span>
              <h3 className="mk-display mt-6 text-[1.5rem] font-semibold">{s.t}</h3>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-white/60">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b border-[var(--line)]">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 py-6 text-left">
        <span className="text-[1.05rem] font-semibold text-[var(--ink)]">{item.q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--stone)] text-[var(--pine)]">
          <Plus className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <p className="pb-6 text-[0.98rem] leading-relaxed text-[var(--mist)]">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [openFaq, setOpenFaq] = useState(0);
  const [billing, setBilling] = useState('annually');
  const [activeLead, setActiveLead] = useState(0);
  const firstRender = useRef(true);

  // On reload the URL may still carry a hash — clear it and stay at the top.
  // Only smooth-scroll when the hash CHANGES (user clicked a nav anchor).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (hash) {
        window.history.replaceState(null, '', window.location.pathname);
        window.scrollTo(0, 0);
      }
      return;
    }
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
        return () => clearTimeout(t);
      }
    }
  }, [hash]);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -90]);
  const heroFade = useTransform(scrollY, [0, 460], [1, 0]);
  const blobY = useTransform(scrollY, [0, 800], [0, 180]);
  const visualY = useTransform(scrollY, [0, 600], [0, 70]);

  return (
    <div className="mk overflow-x-hidden bg-[var(--paper)]">
      <MarketingNav overHero />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--deep)] pt-36 pb-20 md:pt-44 md:pb-24">
        <HeroWave3D className="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 z-0 opacity-60" />

        <motion.div className="pointer-events-none absolute inset-0" style={{ y: blobY }}>
          <div className="mk-aurora absolute -left-40 -top-32 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.42), transparent 62%)' }} />
          <div className="mk-aurora absolute -right-32 top-10 h-[34rem] w-[34rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.32), transparent 62%)', animationDelay: '5s' }} />
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse at 50% 15%, black, transparent 72%)' }} />
        </motion.div>

        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative z-10 mx-auto grid max-w-[1300px] items-center gap-16 px-6 md:grid-cols-[1.15fr_0.85fr] md:px-10">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-[var(--brass-2)] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> AI sales intelligence · Real estate
            </motion.div>

            <h1 className="mk-display mt-6 text-[3rem] font-semibold leading-[1.03] text-white sm:text-[3.7rem] md:text-[4.6rem]">
              <motion.span className="flex flex-wrap gap-x-4"
                initial="hidden" animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}>
                {HEADLINE.map((w, i) => (
                  <span key={i} className="inline-block overflow-hidden">
                    <motion.span className={cn('inline-block', (w === 'Smart' || w === 'Conversation.') && 'text-transparent bg-clip-text bg-gradient-to-r from-[var(--pine)] to-[var(--brass)]')}
                      variants={{ hidden: { y: '110%' }, show: { y: 0 } }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                      {w}
                    </motion.span>
                  </span>
                ))}
              </motion.span>
            </h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-7 max-w-xl text-[1.06rem] leading-relaxed text-white/65">
              SmartSDR pairs an autonomous <strong className="font-semibold text-white">Voice Agent</strong> that calls and
              qualifies your leads with <strong className="font-semibold text-white">Executive Analytics</strong> that scores
              every conversation — so agents chase the right leads and managers see what's working.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }}
              className="mt-9 flex flex-wrap items-center gap-4">
              <button onClick={() => navigate('/login')}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)] px-7 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_10px_40px_-8px_rgba(248,114,23,0.6)] transition-all hover:-translate-y-0.5">
                Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <a href="#platform" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-[0.95rem] font-semibold text-white transition-all hover:bg-white/10">
                <PlayCircle className="h-4 w-4" /> See the platform
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.85 }}
              className="mt-10 flex flex-wrap gap-6 text-sm text-white/55">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--brass)]" /> Two agents, one login</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--brass)]" /> Built for real-estate teams</span>
            </motion.div>
          </div>

          {/* Single live product card — centered, no overlap */}
          <motion.div style={{ y: visualY }} className="relative hidden justify-center md:flex">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}>
              <div className="mk-float"><VoiceCard /></div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Booked-meetings live strip */}
        <div className="relative z-10 mx-auto mt-16 max-w-[1300px] px-6 md:mt-20 md:px-10">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white/45">This agent booked meetings with</p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <div className="mk-marquee flex w-max items-center gap-4">
              {[...MEETINGS, ...MEETINGS].map((m, i) => (
                <div key={i} className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur">
                  <div className="flex -space-x-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--pine)] to-[var(--brass)] text-[0.6rem] font-bold text-white ring-2 ring-[var(--deep)]">{m.a}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[0.6rem] font-bold text-white ring-2 ring-[var(--deep)]">{m.b}</span>
                  </div>
                  <div className="leading-tight">
                    <p className="text-[0.7rem] font-semibold text-white">Meeting in {m.days} day{m.days > 1 ? 's' : ''}</p>
                    <p className="text-[0.6rem] uppercase tracking-wider text-emerald-400">Outgoing</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trusted-by marquee */}
        <div className="relative z-10 mx-auto mt-10 max-w-[1300px] px-6 md:px-10">
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white/40">Plugs into the tools you already use</p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="mk-marquee flex w-max items-center gap-16">
              {[...LOGOS, ...LOGOS].map((src, i) => (
                <img key={i} src={src} alt="" className="h-12 w-auto object-contain opacity-55 grayscale transition hover:opacity-100 hover:grayscale-0" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA card (moved to top) ──────────────────────────── */}
      <section className="bg-[var(--paper)] px-6 pt-16 md:px-10 md:pt-20">
        <Reveal className="mx-auto max-w-[1200px]"><CtaCard navigate={navigate} /></Reveal>
      </section>

      {/* ── Live proof bento (call + real-time stats) ────────── */}
      <section className="bg-[var(--paper)] px-6 pt-16 md:px-10 md:pt-20">
        <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Left: call proof — interactive carousel */}
          <Reveal>
            <div className="h-full rounded-[1.75rem] border border-[var(--line)] bg-[var(--stone)]/40 p-6 md:p-8">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--mist)]">This call booked a site visit with</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {CALLED_LEADS.map((lead, i) => (
                  <button
                    key={lead.name}
                    onClick={() => setActiveLead(i)}
                    className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                      i === activeLead ? 'bg-[var(--deep)] text-white' : 'bg-white text-[var(--ink)]/70 hover:text-[var(--ink)] dark:bg-[var(--paper)]')}
                  >
                    {lead.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--mist)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Meeting in {CALLED_LEADS[activeLead].days} day{CALLED_LEADS[activeLead].days > 1 ? 's' : ''}
              </p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] shadow-xl">
                <div className="flex items-center justify-between bg-[var(--deep)] px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">Type: Outgoing</span>
                </div>
                <div className="bg-white p-5 dark:bg-[var(--stone)]">
                  <AnimatePresence mode="wait">
                    <motion.p key={activeLead} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }} className="text-sm leading-relaxed text-[var(--ink)]/85">
                      {CALLED_LEADS[activeLead].transcript}
                    </motion.p>
                  </AnimatePresence>
                  <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--stone)] px-3 py-1.5 text-xs font-semibold text-[var(--pine)] w-fit">
                    <img src="/rocket.png" alt="" className="h-4 w-4 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    Qualified by Voice Agent
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right: real-time stats + testimonial */}
          <div className="flex flex-col gap-6">
            <Reveal delay={0.1}>
              <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--stone)]/40 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--mist)]">Real-time stats</p>
                  <span className="text-[0.65rem] text-[var(--mist)]">Last 30 days</span>
                </div>
                <div className="mt-4 space-y-3">
                  {LIVE_STATS.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white p-3 dark:bg-[var(--paper)]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--stone)] text-[var(--pine)]">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-xs text-[var(--mist)]">{s.label}</p>
                        <p className="mk-display text-lg font-semibold text-[var(--ink)]">{s.value}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-500">{s.trend}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="flex-1 rounded-[1.75rem] border border-[var(--line)] bg-[var(--deep)] p-6 text-white">
                <Quote className="h-6 w-6 text-[var(--brass-2)]" />
                <p className="mt-3 text-sm leading-relaxed text-white/85">{TESTIMONIALS[0].q}</p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-sm font-semibold">{TESTIMONIALS[0].n}</p>
                  <p className="text-xs text-white/50">{TESTIMONIALS[0].r}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────── */}
      <section className="bg-[var(--paper)] px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[1200px] gap-8 rounded-3xl border border-[var(--line)] bg-[var(--stone)]/40 px-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.08} className="text-center sm:text-left">
              <p className="mk-display text-[2.8rem] font-semibold leading-none text-[var(--pine)]">{s.v}</p>
              <p className="mt-2 text-sm text-[var(--mist)]">{s.k}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Platform bento ───────────────────────────────────── */}
      <section id="platform" className="scroll-mt-24 bg-[var(--paper)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-16 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">The platform</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Two agents that do the heavy lifting
            </h2>
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-2">
            {OFFERINGS.map((o, i) => (
              <Reveal key={o.id} delay={i * 0.12}>
                <div id={o.id} className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white p-8 transition-all duration-500 hover:-translate-y-1.5 hover:border-[var(--pine)]/40 hover:shadow-[0_50px_90px_-50px_rgba(248,114,23,0.55)] dark:bg-[var(--stone)]">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.25), transparent 65%)' }} />
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--pine)] to-[var(--brass)] text-white shadow-lg">
                      <o.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <span className="mk-eyebrow text-[var(--pine)]">{o.tag}</span>
                      <h3 className="mk-display text-[1.7rem] font-semibold leading-tight text-[var(--ink)]">{o.name}</h3>
                    </div>
                  </div>
                  <p className="relative mt-5 text-[1rem] leading-relaxed text-[var(--mist)]">{o.blurb}</p>

                  <div className="relative mt-7 flex flex-wrap gap-2">
                    {o.features.map((f) => (
                      <span key={f.label} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--stone)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]">
                        <f.icon className="h-3.5 w-3.5 text-[var(--pine)]" /> {f.label}
                      </span>
                    ))}
                  </div>

                  <button onClick={() => navigate('/login')}
                    className="relative mt-8 inline-flex w-fit items-center gap-2 font-semibold text-[var(--pine)] transition-colors hover:text-[var(--pine-2)]">
                    Explore {o.name} <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── What is SmartSDR (5 differentiators) ─────────────── */}
      <section id="what" className="scroll-mt-24 bg-[var(--paper)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-16 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">What is SmartSDR</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Built to win the calls that matter
            </h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {WHAT.map((w, i) => (
              <Reveal key={w.n} delay={(i % 3) * 0.1}>
                <div className="group h-full rounded-2xl border border-[var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--pine)]/40 dark:bg-[var(--stone)]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pine)] to-[var(--brass)] text-white shadow-md">
                      <w.icon className="h-5 w-5" />
                    </span>
                    <span className="mk-display text-[2rem] font-semibold text-[var(--line)]">{w.n}</span>
                  </div>
                  <h3 className="mk-display mt-5 text-[1.35rem] font-semibold leading-tight text-[var(--ink)]">{w.t}</h3>
                  <p className="mt-3 text-[0.96rem] leading-relaxed text-[var(--mist)]">{w.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for (centered) ─────────────────────────────── */}
      <section className="bg-[var(--paper)] px-6 pb-24 md:px-10 md:pb-32">
        <div className="mx-auto max-w-2xl">
          <Reveal className="mb-10 text-center">
            <p className="mk-eyebrow text-[var(--pine)]">Is it a fit?</p>
            <h2 className="mk-display mt-4 text-[2.2rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3rem]">
              Made for teams who sell with judgment
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-[1.5rem] border-2 border-[var(--pine)]/25 bg-white p-8 dark:bg-[var(--stone)]">
              <ul className="space-y-4">
                {BUILT_FOR.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[1rem] text-[var(--ink)]/85">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pine)] text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Testimonials (Wall of love) ──────────────────────── */}
      <section className="bg-[var(--paper)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-14 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">Wall of love</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Teams that stopped guessing
            </h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-7 dark:bg-[var(--stone)]">
                  <Quote className="h-7 w-7 text-[var(--pine)]" />
                  <p className="mt-4 flex-1 text-[1rem] leading-relaxed text-[var(--ink)]/85">{t.q}</p>
                  <div className="mt-6 border-t border-[var(--line)] pt-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">{t.n}</p>
                    <p className="text-xs text-[var(--mist)]">{t.r}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-24 bg-[var(--paper)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-10 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">Pricing</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Simple plans, both agents included
            </h2>
            <p className="mt-4 max-w-xl text-[1.02rem] text-[var(--mist)]">
              Every plan includes Voice Agent and Executive Analytics — pick a tier by volume, not by feature.
            </p>
          </Reveal>

          {/* Billing toggle */}
          <div className="mb-12 inline-flex rounded-full border border-[var(--line)] bg-[var(--stone)] p-1">
            {['quarterly', 'annually'].map((b) => (
              <button key={b} onClick={() => setBilling(b)}
                className={cn('rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors',
                  billing === b ? 'bg-[var(--pine)] text-white shadow' : 'text-[var(--mist)] hover:text-[var(--ink)]')}>
                {b}{b === 'annually' && MAX_ANNUAL_SAVING_PCT > 0 && (
                  <span className="ml-1 text-xs opacity-90">· save up to {MAX_ANNUAL_SAVING_PCT}%</span>
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-3 items-start">
            {PLANS.map((p, i) => {
              const price = billing === 'annually' ? p.priceA : p.priceQ;
              const period = billing === 'annually' ? p.periodA : p.periodQ;
              const billingNote = billing === 'annually' ? p.billingA : p.billingQ;
              return (
                <Reveal key={p.name} delay={i * 0.1}>
                  <div className={cn('flex h-full flex-col rounded-[1.5rem] p-8 transition-transform duration-300 hover:-translate-y-1',
                    p.highlight ? 'bg-[var(--deep)] text-white ring-2 ring-[var(--pine)] shadow-[0_40px_80px_-40px_rgba(248,114,23,0.5)]' : 'bg-white ring-1 ring-[var(--line)] dark:bg-[var(--stone)]')}>
                    {p.highlight && (
                      <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--pine)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                        <Zap className="h-3 w-3" /> Most popular
                      </span>
                    )}
                    <h3 className={cn('mk-display text-[1.4rem] font-semibold', !p.highlight && 'text-[var(--ink)]')}>{p.name}</h3>
                    <p className={cn('mt-1 text-sm font-medium', p.highlight ? 'text-[var(--brass-2)]' : 'text-[var(--pine)]')}>{p.tagline}</p>

                    <div className="mt-5 flex items-baseline gap-1">
                      <AnimatePresence mode="wait">
                        <motion.span key={price} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }} className="mk-display text-[2.4rem] font-semibold">{price}</motion.span>
                      </AnimatePresence>
                      <span className={cn('text-sm', p.highlight ? 'text-white/50' : 'text-[var(--mist)]')}>{period}</span>
                    </div>
                    <p className={cn('mt-1 text-xs', p.highlight ? 'text-white/45' : 'text-[var(--mist)]')}>{billingNote}</p>

                    <p className={cn('mt-4 text-sm leading-relaxed', p.highlight ? 'text-white/70' : 'text-[var(--mist)]')}>{p.desc}</p>

                    <div className="mt-6">
                      <p className={cn('text-[0.65rem] font-bold uppercase tracking-wider', p.highlight ? 'text-white/40' : 'text-[var(--mist)]')}>Specs</p>
                      <ul className="mt-3 space-y-2">
                        {p.specs.map((s) => (
                          <li key={s} className={cn('text-sm', p.highlight ? 'text-white/80' : 'text-[var(--ink)]/80')}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {p.footnote && (
                      <p className={cn('mt-6 text-xs italic', p.highlight ? 'text-white/50' : 'text-[var(--mist)]')}>{p.footnote}</p>
                    )}

                    <button onClick={() => navigate('/login')}
                      className={cn('mt-8 rounded-full px-6 py-3 text-sm font-semibold transition-all',
                        p.highlight ? 'bg-white text-[var(--deep)] hover:bg-[var(--brass-2)]' : 'bg-[var(--stone)] text-[var(--pine)] hover:bg-[var(--pine)] hover:text-white')}>
                      {p.cta}
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="bg-[var(--paper)] px-6 pb-28 md:px-10 md:pb-36">
        <div className="mx-auto grid max-w-[1100px] gap-14 md:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="mk-eyebrow text-[var(--pine)]">FAQ</p>
            <h2 className="mk-display mt-4 text-[2.2rem] font-semibold leading-[1.08] text-[var(--ink)] md:text-[2.8rem]">
              Questions, answered
            </h2>
            <p className="mt-4 text-[var(--mist)]">Everything you need to know before your first campaign.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              {FAQS.map((item, i) => (
                <FaqItem key={i} item={item} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
      <HelperCharacter />
    </div>
  );
}
