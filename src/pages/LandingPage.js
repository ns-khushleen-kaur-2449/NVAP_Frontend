import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Plus, PlayCircle, Zap, ShieldCheck, Target, FileSearch, Quote,
  Check, Layers, BookOpen, FileSpreadsheet, PhoneCall, Calendar, BellRing, BarChart3, PhoneOff, Gauge,
  AudioLines, UserCog, Users, Mail, CalendarSync, Headset, Infinity as InfinityIcon,
} from 'lucide-react';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import HeroWave3D from '@/components/marketing/HeroWave3D';
import GlassCalendar from '@/components/marketing/GlassCalendar';
import WorkflowVisual from '@/components/marketing/WorkflowVisual';
import { NetsmartzLogo, SmartSDRWordmark } from '@/components/shared/BrandLockup';
import { cn } from '@/lib/utils';

import hubspot from '@/assets/hubspot.png';
import salesforce from '@/assets/salesforce.png';
import azure from '@/assets/azure.png';
import dynamics from '@/assets/dynamics.png';
import twilio from '@/assets/twilio.png';
import zoho from '@/assets/zoho.png';

const LOGOS = [hubspot, salesforce, azure, dynamics, twilio, zoho];

const STATS = [
  { v: '3.4×', k: 'more qualified conversations' },
  { v: '100%', k: 'of your lead list called' },
  { v: '24/7', k: 'autonomous lead calling' },
  { v: 'HOT · WARM · COLD', k: 'every lead scored automatically' },
];

const STEPS = [
  { n: '01', t: 'Connect your calls and leads', d: 'Import a lead list or sync from your sheet. No new process to learn.' },
  { n: '02', t: 'Let the Voice Agent do the work', d: 'The Voice Agent calls and qualifies every lead, then scores each one so you know who is ready to move.' },
  { n: '03', t: 'Act on what matters', d: 'Reps follow the hottest leads first, and managers see which leads are moving.' },
];

// Each plan is laid out as the same seven rows (header, price, usage, seats,
// features, add-on seats, CTA) so the cards line up for comparison.
const PLANS = [
  {
    name: 'Plus', highlight: false,
    price: '$249', period: '/mo',
    billing: 'billed monthly',
    desc: 'For solo agents and small sales teams.',
    usage: [
      { icon: PhoneCall, value: '150', label: 'AI-qualified calls/month' },
      { icon: AudioLines, value: '450', label: 'voice minutes' },
    ],
    seats: [
      { icon: UserCog, value: '1', label: 'Manager seat' },
      { icon: Users, value: '3', label: 'Sales Rep seats' },
    ],
    features: [
      { icon: Mail, label: 'Email support' },
    ],
    addons: [
      { label: 'Extra Manager seat', price: '$39', period: '/month' },
      { label: 'Extra Sales Rep seat', price: '$19', period: '/month' },
    ],
    cta: 'Choose Plus',
  },
  {
    name: 'Pro', highlight: true,
    price: '$1,499', period: '/mo',
    billing: 'billed monthly',
    desc: 'For growing teams scaling voice outreach.',
    usage: [
      { icon: PhoneCall, value: '1,000', label: 'AI-qualified calls/month' },
      { icon: AudioLines, value: '3,000', label: 'voice minutes' },
    ],
    seats: [
      { icon: UserCog, value: '3', label: 'Manager seats' },
      { icon: Users, value: '15', label: 'Sales Rep seats' },
    ],
    features: [
      { icon: Mail, label: 'Priority email support' },
      { icon: CalendarSync, label: 'CRM & calendar integration' },
    ],
    addons: [
      { label: 'Extra Manager seat', price: '$29', period: '/month' },
      { label: 'Extra Sales Rep seat', price: '$15', period: '/month' },
    ],
    cta: 'Choose Pro',
  },
  {
    name: 'Pro+', highlight: false,
    price: '$3,999', period: '/mo',
    billing: 'billed monthly',
    desc: 'For large teams with high-volume outreach.',
    usage: [
      { icon: PhoneCall, value: '3,500', label: 'AI-qualified calls/month' },
      { icon: AudioLines, value: '10,500', label: 'voice minutes' },
    ],
    seats: [
      { icon: UserCog, value: 'Unlimited', label: 'Manager seats' },
      { icon: Users, value: 'Unlimited', label: 'Sales Rep seats' },
    ],
    features: [
      { icon: Mail, label: 'Priority email support' },
      { icon: CalendarSync, label: 'CRM & calendar integration' },
      { icon: Headset, label: 'Dedicated customer success manager' },
    ],
    addons: [],
    addonsNote: 'Unlimited Manager and Sales Rep seats are included.',
    cta: 'Choose Pro+',
  },
];

const WHAT = [
  { n: '01', icon: Target, t: 'Call every lead, not just the easy ones', d: 'The Voice Agent works your entire list autonomously — no lead goes cold because a rep ran out of hours.' },
  { n: '02', icon: FileSearch, t: 'Know which leads are ready', d: 'Every lead gets a score from fit and engagement, labelled HOT, WARM or COLD, with the reasons behind it.' },
  { n: '03', icon: Zap, t: 'Follow up while the lead is warm', d: 'Scores update as soon as a lead engages, so your team acts on the right lead at the right time.' },
];

const FEATURES = [
  { icon: Layers, t: 'Campaign builder', d: 'Pick a lead list, an agent and a schedule, then launch a calling campaign in a few clicks.' },
  { icon: Gauge, t: 'Lead scoring', d: 'Every call is scored HOT, WARM or COLD from fit and engagement, with the reasons shown.' },
  { icon: BookOpen, t: 'Knowledge base', d: 'Give the agent your projects, pricing and FAQs so it answers the way your team would.' },
  { icon: FileSpreadsheet, t: 'Lead imports & sync', d: 'Upload a list or sync from Google Sheets. No new process to learn.' },
  { icon: BarChart3, t: 'Live dashboard', d: 'Dialed, connected, interested and hot leads, per agent, refreshed as calls happen.' },
  { icon: PhoneOff, t: 'Do-not-call safety', d: 'Numbers on your do-not-call list are never dialed, so campaigns stay compliant.' },
];

const VOICE_POINTS = [
  'Calls your whole lead list autonomously, around the clock',
  'Asks your qualifying questions and understands the answers',
  'Marks each lead Interested, Callback or Not interested',
  'Hands hot leads to your reps while they are still warm',
];

const SCHEDULING_POINTS = [
  { icon: Calendar, t: 'Site visits booked on the call', d: 'When a lead says yes, the agent proposes a time and books it against your calendar.' },
  { icon: BellRing, t: 'Callbacks that do not slip', d: 'Leads who ask for a later call, or a person, become tasks with a due time for your reps.' },
  { icon: PhoneCall, t: 'Smart retries', d: 'No answer or busy? The agent retries later in the day, when the lead is likelier to pick up.' },
];

const TESTIMONIALS = [
  { q: 'Every lead finally gets scored the same way. Deciding who to call first went from guesswork to a glance.', n: 'Sales Manager', r: 'Residential brokerage' },
  { q: 'The Voice Agent worked a stale lead list overnight and booked site visits we would have written off.', n: 'Team Lead', r: ' developer' },
  { q: 'Managers used to argue about which leads were worth chasing. Now the score just tells us, with the reasons behind it.', n: 'Operations Head', r: 'Property advisory' },
];

const FAQS = [
  { q: 'What exactly is the Voice Agent?', a: 'The Voice Agent autonomously calls and qualifies your leads, books appointments, and scores each lead so your team knows who to follow up with first.' },
  { q: 'Do I need to change my current tools?', a: 'No. Import a lead list, drop in recordings, or sync from Google Sheets. SmartSDR fits around the way your brokerage already works.' },
  { q: 'How is a lead scored?', a: 'Each lead gets a score out of 100 from how well they fit your ideal customer and how engaged they are, labelled HOT, WARM or COLD. You can see the reasons behind every score.' },
  { q: 'Is my data secure?', a: 'Enterprise plans include SSO and role-based access. Your call data stays yours and is never used to train shared models.' },
  { q: 'Can I tune how the agent talks to leads?', a: 'Yes. You set the script, the questions it asks and the knowledge it draws on, so it reflects how your brokerage actually sells.' },
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
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--pine)] via-[var(--pine-2)] to-[var(--pine-2)] dark:to-[var(--deep)] px-8 py-14 text-center text-white md:px-16 md:py-20">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-40 mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent 60%)' }} />
      <div className="pointer-events-none absolute -right-16 -bottom-10 h-64 w-64 rounded-full opacity-30 mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(255,217,168,0.5), transparent 60%)', animationDelay: '5s' }} />
      <h2 className="mk-display relative mx-auto max-w-3xl text-[2.2rem] font-semibold leading-[1.05] md:text-[3.2rem]">
        See it run on your own calls
      </h2>
      <p className="relative mx-auto mt-5 max-w-xl text-[1.05rem] text-white/85">
        Sign in to launch a Voice Agent campaign and see your leads scored.
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
    <section id="how" className="mk-band scroll-mt-24 relative overflow-hidden bg-[var(--deep)] px-6 py-28 text-white md:px-10 md:py-36">
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

/* ── Pricing card: seven rows that line up across cards via CSS subgrid (lg+) ── */
const PLAN_ROW = 'mx-5 sm:mx-6 lg:mx-5 xl:mx-6';
const PLAN_SECTION = cn(PLAN_ROW, 'border-t border-[var(--line)] py-4');
const ICON_CHIP = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(248,114,23,0.1)] text-[var(--pine)]';

function PlanLabel({ children }) {
  return <p className="mb-2.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--mist)]">{children}</p>;
}

// Hover lift is driven by `group-hover/plan` from the Reveal wrapper, which does not
// move: if the card itself were the hover target, lifting it would pull its
// bottom edge out from under the cursor and the card would flicker.
// The whole card selects the plan; focusing its button selects it too, so
// keyboard users get the same selection as mouse users.
function PlanCard({ plan, selected, onSelect, onChoose }) {
  const p = plan;
  return (
    <div onClick={onSelect} onFocus={onSelect} className={cn(
      'relative flex h-full cursor-pointer select-none flex-col rounded-[1.5rem] bg-white ring-1 ring-[var(--line)] dark:bg-[var(--stone)]',
      'transition-[transform,box-shadow] duration-300 ease-out motion-reduce:transition-none',
      'lg:row-span-7 lg:grid lg:grid-rows-subgrid lg:gap-y-0',
      p.highlight && 'bg-[radial-gradient(120%_45%_at_50%_0%,rgba(248,114,23,0.16),transparent_70%)]',
      selected
        ? 'ring-2 ring-[var(--pine)] shadow-[0_32px_64px_-32px_rgba(248,114,23,0.6)] group-hover/plan:shadow-[0_40px_72px_-30px_rgba(248,114,23,0.7)] lg:-translate-y-3 lg:group-hover/plan:-translate-y-4'
        : 'group-hover/plan:-translate-y-1 group-hover/plan:ring-[rgba(248,114,23,0.45)] group-hover/plan:shadow-[0_28px_56px_-32px_rgba(0,0,0,0.5)]',
    )}>
      {selected && <span className="sr-only">Selected plan</span>}
      {p.highlight && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--pine)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white shadow-[0_6px_16px_-6px_rgba(248,114,23,0.8)]">
          <Zap className="h-3 w-3" /> Most popular
        </span>
      )}

      {/* 1 · Plan name and description */}
      <div className={cn(PLAN_ROW, 'pt-7')}>
        <h3 className="mk-display text-[1.6rem] font-semibold leading-tight text-[var(--ink)]">{p.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--mist)]">{p.desc}</p>
      </div>

      {/* 2 · Price */}
      <div className={cn(PLAN_ROW, 'pb-5 pt-4')}>
        <p className="flex items-baseline gap-1">
          <span className="mk-display text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">{p.price}</span>
          <span className="text-base text-[var(--mist)]">{p.period}</span>
        </p>
        <p className="mt-2 text-xs text-[var(--mist)]">{p.billing}</p>
      </div>

      {/* 3 · Usage allowance */}
      <div className={PLAN_SECTION}>
        <PlanLabel>Usage allowance</PlanLabel>
        <ul className="space-y-2">
          {p.usage.map((u) => (
            <li key={u.label} className="flex items-center gap-3 text-sm text-[var(--ink)]/80">
              <span className={ICON_CHIP}><u.icon className="h-3.5 w-3.5" /></span>
              <span><span className="font-semibold tabular-nums text-[var(--ink)]">{u.value}</span> {u.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 4 · Included seats — the check marks them as part of the price */}
      <div className={PLAN_SECTION}>
        <PlanLabel>Included seats</PlanLabel>
        <ul className="space-y-2">
          {p.seats.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm text-[var(--ink)]/80">
              <span className={ICON_CHIP}><s.icon className="h-3.5 w-3.5" /></span>
              <span className="flex-1"><span className="font-semibold tabular-nums text-[var(--ink)]">{s.value}</span> {s.label}</span>
              <Check className="h-4 w-4 shrink-0 text-[var(--pine)]" aria-label="Included" />
            </li>
          ))}
        </ul>
      </div>

      {/* 5 · Features and support */}
      <div className={PLAN_SECTION}>
        <PlanLabel>Features &amp; support</PlanLabel>
        <ul className="space-y-2">
          {p.features.map((f) => (
            <li key={f.label} className="flex items-center gap-3 text-sm text-[var(--ink)]/80">
              <span className={ICON_CHIP}><f.icon className="h-3.5 w-3.5" /></span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>

      {/* 6 · Additional seats — priced per month, unlike the included ones */}
      <div className={PLAN_SECTION}>
        <PlanLabel>{p.addons.length ? 'Additional seats (optional)' : 'Additional seats'}</PlanLabel>
        {p.addons.length ? (
          <ul className="space-y-2">
            {p.addons.map((a) => (
              <li key={a.label} className="flex items-center gap-3 text-sm text-[var(--ink)]/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-[var(--mist)]">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1">{a.label}</span>
                <span className="whitespace-nowrap">
                  <span className="font-semibold tabular-nums text-[var(--pine)]">{a.price}</span>
                  <span className="text-xs text-[var(--mist)]">{a.period}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-3 text-sm text-[var(--ink)]/80">
            <span className={ICON_CHIP}><InfinityIcon className="h-3.5 w-3.5" /></span>
            {p.addonsNote}
          </p>
        )}
      </div>

      {/* 7 · CTA, pinned to the bottom so all three buttons align */}
      <div className={cn(PLAN_ROW, 'mt-auto pb-6 pt-2 lg:mt-0 lg:self-end')}>
        <button onClick={onChoose}
          className={cn(
            'group/cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[var(--stone)]',
            selected
              ? 'bg-[var(--pine)] text-white shadow-[0_10px_24px_-10px_rgba(248,114,23,0.8)] hover:bg-[var(--pine-2)]'
              : 'border-[1.5px] border-[var(--line)] text-[var(--ink)] hover:border-[var(--pine)] hover:text-[var(--pine)]',
          )}>
          {p.cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
        </button>
      </div>
    </div>
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
  // The highlighted plan card; Pro (most popular) until the visitor picks another.
  const [selectedPlan, setSelectedPlan] = useState('Pro');
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
  // The hero fades and drifts as you scroll only from lg up. Below lg the workflow
  // visual sits under the copy, and the fade would hide it before it is reached.
  const [heroScrollFx, setHeroScrollFx] = useState(() => Boolean(window.matchMedia?.('(min-width: 1024px)').matches));
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    if (!mq) return undefined;
    const onChange = (e) => setHeroScrollFx(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="mk overflow-x-hidden bg-[var(--paper)]">
      <MarketingNav overHero showBrand={false} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mk-band relative overflow-hidden bg-[var(--deep)] pt-36 pb-20 md:pt-44 md:pb-24">
        <HeroWave3D className="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 z-0 opacity-60" />

        <motion.div className="pointer-events-none absolute inset-0" style={{ y: blobY }}>
          <div className="mk-aurora absolute -left-40 -top-32 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.42), transparent 62%)' }} />
          <div className="mk-aurora absolute -right-32 top-10 h-[34rem] w-[34rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.32), transparent 62%)', animationDelay: '5s' }} />
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse at 50% 15%, black, transparent 72%)' }} />
        </motion.div>

        <motion.div style={heroScrollFx ? { y: heroY, opacity: heroFade } : undefined} className="relative z-10 mx-auto grid max-w-[1300px] items-center gap-16 px-6 md:px-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            {/* Brand first, then the headline: logo > SmartSDR > headline in size. */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <NetsmartzLogo className="h-14 sm:h-20 lg:h-24" />
              <SmartSDRWordmark className="mt-3 block text-[3.25rem] text-white sm:mt-4 sm:text-[4.25rem] lg:text-[5rem]" />
            </motion.div>
            <h1 className="mk-display mt-6 text-[1.4rem] font-semibold leading-snug text-white sm:text-[1.6rem] lg:text-[1.8rem]">
              <motion.span className="flex flex-wrap gap-x-[0.28em]"
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
              SmartSDR's autonomous <strong className="font-semibold text-white">Voice Agent</strong> calls and
              qualifies your leads — so your team chases the right leads and sees what's working.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }}
              className="mt-9 flex flex-wrap items-center gap-4">
              <button onClick={() => navigate('/login')}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)] px-7 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_10px_40px_-8px_rgba(248,114,23,0.6)] transition-all hover:-translate-y-0.5">
                Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              {/* Explicit per-theme colours. No "bg-white" in the class list: the light-mode
                  .mk-band rules in index.css match it by substring and would grey the button
                  and keep its text white. */}
              <a href="#what" className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,19,15,0.25)] px-7 py-3.5 text-[0.95rem] font-semibold text-[var(--ink)] transition-all hover:border-[var(--pine)] hover:text-[var(--pine)] dark:border-[rgba(255,255,255,0.2)] dark:text-[#FFFFFF] dark:hover:border-[rgba(255,255,255,0.2)] dark:hover:bg-[rgba(255,255,255,0.1)] dark:hover:text-[#FFFFFF]">
                <PlayCircle className="h-4 w-4" /> See the platform
              </a>
            </motion.div>
          </div>

          {/* Workflow visual: AI calls → understands conversations → books meetings.
              Beside the copy from lg; below it on smaller screens. */}
          <motion.div style={heroScrollFx ? { y: visualY } : undefined} className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}>
              <WorkflowVisual />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Trusted-by marquee */}
        <div className="relative z-10 mx-auto mt-16 max-w-[1300px] px-6 md:mt-20 md:px-10">
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white/40">Plugs into the tools you already use</p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="mk-marquee flex w-max items-center gap-16">
              {[...LOGOS, ...LOGOS].map((src, i) => (
                <img key={i} src={src} alt="" className="h-12 w-auto object-contain" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA card (moved to top) ──────────────────────────── */}
      <section className="bg-[var(--paper)] px-6 pt-16 md:px-10 md:pt-20">
        <Reveal className="mx-auto max-w-[1200px]"><CtaCard navigate={navigate} /></Reveal>
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

      {/* ── Features (nav: Platform → Features) ──────────────── */}
      <section id="platform" className="scroll-mt-24 bg-[var(--paper)] px-6 pb-24 md:px-10 md:pb-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-14 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">Features</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Everything you need to run voice outreach
            </h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 0.1}>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--pine)]/40 dark:bg-[var(--stone)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pine)] to-[var(--brass)] text-white shadow-md">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mk-display mt-5 text-[1.25rem] font-semibold leading-tight text-[var(--ink)]">{f.t}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--mist)]">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Voice Agent (nav: Platform → Voice Agent) ────────── */}
      <section id="voice-agent" className="mk-band scroll-mt-24 relative overflow-hidden bg-[var(--deep)] px-6 py-24 text-white md:px-10 md:py-32">
        <div className="pointer-events-none absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full opacity-40 mk-aurora"
          style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.45), transparent 60%)' }} />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 md:grid-cols-2">
          <Reveal>
            <p className="mk-eyebrow text-[var(--brass-2)]">Voice Agent</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] md:text-[3.2rem]">
              An SDR that never stops dialing
            </h2>
            <p className="mt-5 max-w-lg text-[1.02rem] leading-relaxed text-white/65">
              The Voice Agent calls and qualifies your leads, so your reps spend their time on conversations that are ready to close.
            </p>
            <ul className="mt-7 space-y-3">
              {VOICE_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[0.98rem] text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--pine)]">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/login')}
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)] px-7 py-3.5 text-[0.95rem] font-semibold text-white transition-all hover:-translate-y-0.5">
              Try the Voice Agent <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </Reveal>
          <Reveal delay={0.1} className="flex justify-center">
            <GlassCalendar />
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Scheduling (nav: Platform → Scheduling) ──────────── */}
      <section id="scheduling" className="scroll-mt-24 bg-[var(--paper)] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mb-14 max-w-2xl">
            <p className="mk-eyebrow text-[var(--pine)]">Scheduling</p>
            <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.05] text-[var(--ink)] md:text-[3.4rem]">
              Site visits and callbacks, booked for you
            </h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {SCHEDULING_POINTS.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.1}>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-7 dark:bg-[var(--stone)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--stone)] text-[var(--pine)]">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mk-display mt-5 text-[1.25rem] font-semibold leading-tight text-[var(--ink)]">{s.t}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--mist)]">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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
              Simple plans, Voice Agent included
            </h2>
            <p className="mt-4 max-w-xl text-[1.02rem] text-[var(--mist)]">
              Every plan includes the Voice Agent — pick a tier by volume, not by feature.
            </p>
          </Reveal>

          {/* One column (max 30rem) below lg; three subgrid-aligned columns from lg up. */}
          <div className="mx-auto grid max-w-[30rem] gap-8 lg:max-w-[1120px] lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.1} className="group/plan lg:row-span-7 lg:grid lg:grid-rows-subgrid lg:gap-y-0">
                <PlanCard plan={p} selected={selectedPlan === p.name}
                  onSelect={() => setSelectedPlan(p.name)} onChoose={() => navigate('/login')} />
              </Reveal>
            ))}
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
    </div>
  );
}
