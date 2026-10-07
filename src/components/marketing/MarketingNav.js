import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu, X, Sun, Moon, ChevronDown, PhoneCall, TrendingUp, LayoutGrid,
  Search, BookOpen, Calendar, Table2, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORM = [
  { icon: LayoutGrid, label: 'What is SmartSDR?', desc: 'The complete platform overview', to: '/#what' },
  { icon: Sparkles, label: 'Features', desc: 'Every tool for AI real-estate sales', to: '/#platform' },
  { icon: PhoneCall, label: 'Voice Agent', desc: 'Autonomous AI that calls & qualifies leads', to: '/#voice-agent' },
  { icon: TrendingUp, label: 'Executive Analytics', desc: 'Call-quality scoring & executive reporting', to: '/#executive-report' },
  { icon: Search, label: 'Prospecting', desc: 'Find and engage the right buyers', to: '/#platform' },
  { icon: BookOpen, label: 'Knowledge base', desc: 'Ground every call in your listings', to: '/#platform' },
  { icon: Calendar, label: 'Scheduling', desc: 'Auto-book site visits & callbacks', to: '/#how' },
  { icon: Table2, label: 'Sheets sync', desc: 'Push results straight to Google Sheets', to: '/#platform' },
];

export default function MarketingNav({ overHero = false }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null); // 'platform' | 'why' | null
  const [scrolled, setScrolled] = useState(!overHero);
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  const solid = scrolled || open || !!menu;
  const textLight = overHero && !solid;

  return (
    <header
      className={cn(
        'mk z-50 transition-all duration-500',
        overHero ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        solid ? 'bg-[var(--paper)]/90 backdrop-blur-xl border-b border-[var(--line)]' : 'bg-transparent'
      )}
      onMouseLeave={() => setMenu(null)}
    >
      {textLight && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--deep)]/70 via-[var(--deep)]/25 to-transparent" />
      )}
      <div className="relative mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="flex flex-col leading-none">
          <span className={cn('mk-display text-[1.55rem] font-semibold tracking-tight transition-colors duration-500',
            textLight ? 'text-white' : 'text-[var(--ink)]')}>
            Smart<span className="text-[var(--pine)]">SDR</span>
          </span>
          <span className={cn('mk-eyebrow mt-1 text-[0.58rem] transition-colors duration-500',
            textLight ? 'text-white/60' : 'text-[var(--mist)]')}>
            by Netsmartz
          </span>
        </Link>

        <nav className={cn('hidden items-center gap-8 text-[0.9rem] font-medium md:flex',
          textLight ? 'text-white/85' : 'text-[var(--ink)]/75')}>
          <button
            onMouseEnter={() => setMenu('platform')}
            onClick={() => setMenu((v) => (v === 'platform' ? null : 'platform'))}
            className={cn('flex items-center gap-1 transition-colors hover:text-[var(--pine)]', menu === 'platform' && 'text-[var(--pine)]')}
          >
            Platform <ChevronDown className={cn('h-4 w-4 transition-transform', menu === 'platform' && 'rotate-180')} />
          </button>
          <button
            onMouseEnter={() => setMenu('why')}
            onClick={() => setMenu((v) => (v === 'why' ? null : 'why'))}
            className={cn('flex items-center gap-1 transition-colors hover:text-[var(--pine)]', menu === 'why' && 'text-[var(--pine)]')}
          >
            Why SmartSDR <ChevronDown className={cn('h-4 w-4 transition-transform', menu === 'why' && 'rotate-180')} />
          </button>
          <Link to="/#pricing" onMouseEnter={() => setMenu(null)}
            className="mk-underline transition-colors hover:text-[var(--pine)]">
            Pricing
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme"
            className={cn('flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300',
              textLight ? 'border-white/30 text-white hover:bg-white/10' : 'border-[var(--line)] text-[var(--ink)]/70 hover:text-[var(--pine)]')}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => navigate('/login')}
            className={cn('rounded-full px-5 py-2 text-[0.85rem] font-semibold transition-all duration-300',
              textLight ? 'bg-white text-[var(--deep)] hover:bg-[var(--brass-2)]'
                : 'bg-gradient-to-r from-[var(--pine)] to-[var(--brass)] text-white hover:opacity-90')}>
            Sign in
          </button>
        </div>

        <button className={cn('md:hidden', textLight ? 'text-white' : 'text-[var(--ink)]')}
          onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Dropdowns */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setMenu(menu)}
            className="absolute inset-x-0 top-full hidden md:block"
          >
            <div className="mx-auto max-w-[1100px] px-6">
              {menu === 'platform' ? (
                <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 shadow-2xl lg:grid-cols-4">
                  {PLATFORM.map((p) => (
                    <Link key={p.label} to={p.to} onClick={() => setMenu(null)}
                      className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--stone)]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--stone)] text-[var(--pine)] transition-colors group-hover:bg-[var(--pine)] group-hover:text-white">
                        <p.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-[var(--ink)]">{p.label}</span>
                        <span className="block text-xs leading-snug text-[var(--mist)]">{p.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mx-auto max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center shadow-2xl">
                  <div className="flex items-center justify-center gap-2 text-[var(--pine)]">
                    <Sparkles className="h-4 w-4" />
                    <span className="mk-eyebrow">Why SmartSDR</span>
                  </div>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--ink)]/85">
                    Netsmartz SDR acts as your intelligent AI Sales Development Representative, working 24/7 to
                    identify prospects, engage leads with personalized communication, qualify opportunities, and
                    schedule meetings — helping your sales team accelerate revenue growth with less manual effort.
                  </p>
                  <Link to="/#how" onClick={() => setMenu(null)}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--pine)] hover:text-[var(--pine-2)]">
                    See why teams choose SmartSDR <ChevronDown className="h-4 w-4 -rotate-90" />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      {open && (
        <div className="mk border-t border-[var(--line)] bg-[var(--paper)] px-6 pb-6 pt-2 md:hidden">
          <div className="flex flex-col gap-1 py-3">
            <p className="mk-eyebrow py-2 text-[var(--pine)]">Platform</p>
            {PLATFORM.slice(0, 4).map((p) => (
              <Link key={p.label} to={p.to} onClick={() => setOpen(false)} className="flex items-center gap-2 py-2 text-[var(--ink)]/80">
                <p.icon className="h-4 w-4 text-[var(--pine)]" /> {p.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-[var(--line)]" />
            <Link to="/#how" onClick={() => setOpen(false)} className="py-2 text-lg text-[var(--ink)]">Why SmartSDR</Link>
            <Link to="/#pricing" onClick={() => setOpen(false)} className="py-2 text-lg text-[var(--ink)]">Pricing</Link>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="flex items-center gap-2 text-[var(--ink)]/70">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <button onClick={() => { setOpen(false); navigate('/login'); }}
              className="rounded-full bg-gradient-to-r from-[var(--pine)] to-[var(--brass)] px-5 py-2.5 text-center font-semibold text-white">
              Sign in
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
