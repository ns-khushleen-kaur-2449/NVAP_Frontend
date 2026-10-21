import { useLocation, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LogOut, LayoutDashboard, Users, Settings,
  BarChart2, Mic, Table2, Sliders, MessageSquare, Phone, PhoneCall, Menu, X, Activity, ArrowLeft, Bot,
  Sparkles,  Inbox as InboxIcon, CalendarClock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/shared/ThemeToggle';
import NotificationBell from '@/components/ops/NotificationBell';

// ── Nav definitions (same as old sidebars) ──────────────────────
const MAIN_NAV = [
  { path: '/dashboard',    label: 'Home',         icon: LayoutDashboard, roles: ['agent', 'manager', 'admin'] },
  { path: '/settings',     label: 'Settings',     icon: Settings,        roles: ['agent', 'manager', 'admin'] },
];

const EXEC_NAV = [
  { path: '/manager-dashboard', label: 'Team Overview',   icon: LayoutDashboard, roles: ['agent', 'manager', 'admin'] },
  { path: '/call-quality',      label: 'Call Quality',    icon: BarChart2,       roles: ['agent', 'manager', 'admin'] },
  { path: '/weight-config',     label: 'Scoring Criteria',icon: Sliders,         roles: ['admin'] },
  { path: '/audio-upload',      label: 'Audio Upload',    icon: Mic,             roles: ['agent', 'manager', 'admin'] },
  { path: '/sheets-sync',       label: 'Sheets Sync',     icon: Table2,          roles: ['manager', 'admin'] },
  { path: '/knowledge-base',    label: 'Knowledge Base',  icon: Bot,             roles: ['admin'] },
  // { path: '/agent-performance', label: 'Match Executive', icon: Users,        roles: ['manager', 'admin'] },
];

const VOICE_NAV = [
  { path: '/voice_agent', label: 'Voice Agent', icon: PhoneCall,     roles: ['agent', 'manager', 'admin'] },
  { path: '/voice_agent?view=logs', label: 'Calls', icon: Phone, roles: ['agent', 'manager', 'admin'] },
  { path: '/prospecting',  label: 'Prospecting',  icon: Users,           roles: ['agent', 'manager', 'admin'] },
  { path: '/strategist',   label: 'AI Strategist', icon: Sparkles,       roles: ['agent', 'manager', 'admin'] },
  { path: '/inbox',        label: 'Inbox',        icon: InboxIcon,       roles: ['agent', 'manager', 'admin'] },
  { path: '/meetings',     label: 'Meetings',     icon: CalendarClock,   roles: ['agent', 'manager', 'admin'] },
];

// Exec paths & voice paths used to detect active section
const EXEC_PATHS  = EXEC_NAV.map(n => n.path);
const VOICE_PATHS = VOICE_NAV.map(n => n.path);


export const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isExecSection  = EXEC_PATHS.some(p  => location.pathname.startsWith(p));
  const isVoiceSection = VOICE_PATHS.some(p => location.pathname.startsWith(p));

  // Decide which nav set to show inline
  let activeNav = MAIN_NAV;
  if (isExecSection)  activeNav = [];
  if (isVoiceSection) activeNav = VOICE_NAV;

  const visible = (roles) => !user || roles.includes(user.role);

  const navLinkClass = (isActive) => cn(
    'relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 group',
    isActive
      ? 'text-[var(--pine)] bg-[var(--stone)]'
      : 'text-[var(--mist)] hover:text-[var(--pine)] hover:bg-[var(--stone)]/60'
  );

  return (
    <>
      <header
        className="mk sticky top-0 z-50 flex flex-col border-b border-[var(--line)] bg-[var(--paper)] transition-all duration-300 shadow-sm"
        data-testid="topbar"
      >
        {/* ── Main row ── */}
        <div className="flex items-center justify-between px-5 h-14">
          {/* Left Side: Back button + Logo */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            {(isExecSection || isVoiceSection) && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-[var(--pine)] hover:bg-[var(--stone)] border border-[var(--line)] shadow-sm transition-all duration-200"
              >
                ← Home
              </button>
            )}

            {/* Logo / Brand */}
            <Link to="/dashboard" className="flex items-center group leading-none">
              <span className="mk-display text-xl font-semibold text-[var(--ink)]">
                Smart<span className="text-[var(--pine)]">SDR</span>
              </span>
            </Link>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-0.5 mx-4">

            {activeNav.filter(item => visible(item.roles)).map((item) => {
              const itemPath = item.path.split('?')[0];
              const itemSearch = item.path.includes('?') ? new URLSearchParams(item.path.split('?')[1]) : null;
              const siblingQueries = activeNav.filter(n => n.path.includes('?')).map(n => new URLSearchParams(n.path.split('?')[1]).toString());
              const isActive = itemPath === '/kpis'
                ? location.pathname === '/kpis'
                : location.pathname.startsWith(itemPath) &&
                  (itemSearch
                    ? location.search.includes(itemSearch.toString())
                    : !siblingQueries.some(q => location.search.includes(q)));
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={navLinkClass(isActive)}
                >
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-[var(--pine)]' : 'text-[var(--pine)]/50 group-hover:text-[var(--pine)]/80')} />
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[var(--pine)]" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2.5">

            {/* Admin — hidden for now. Restore this block plus the ShieldCheck
                import and hasRole from useAuth() to bring it back.
            {hasRole('admin', 'manager') && (
              <Link
                to="/admin"
                data-testid="open-admin-dashboard"
                className="hidden sm:flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--stone)] hover:bg-[var(--pine)]/15 text-[var(--pine)] transition-colors"
              >
                <ShieldCheck className="w-4 h-4 mr-1" /> Admin
              </Link>
            )}
            */}

            {user && <NotificationBell />}

            <ThemeToggle />

            {user && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--mist)] hover:text-[var(--pine)] hover:bg-[var(--stone)]/60 border border-transparent transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-[var(--pine)]/60 hover:bg-[var(--stone)] transition-colors"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        className="md:hidden fixed inset-0 z-40 transition-all duration-300"
        style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none' }}
        onClick={() => setMobileOpen(false)}
      >
        <div className="absolute inset-0 backdrop-blur-sm bg-[var(--deep)]/40" />
      </div>

      {/* Mobile drawer */}
      <div
        className="mk md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 transition-transform duration-300 ease-in-out bg-[var(--paper)] border-l border-[var(--line)] shadow-2xl"
        style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <span className="mk-display text-lg font-semibold text-[var(--ink)]">
            Smart<span className="text-[var(--pine)]">SDR</span>
          </span>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-[var(--pine)]/60 hover:bg-[var(--stone)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4 space-y-1">
          {(isExecSection || isVoiceSection) && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--ink)] hover:bg-[var(--stone)] transition-colors border-b border-[var(--line)] mb-2 pb-3"
            >
              ← Home
            </button>
          )}
          {activeNav.filter(item => visible(item.roles)).map(({ path, label, icon: Icon }) => {
            const basePath = path.split('?')[0];
            const searchPart = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : null;
            const mSiblingQueries = activeNav.filter(n => n.path.includes('?')).map(n => new URLSearchParams(n.path.split('?')[1]).toString());
            const isActive = basePath === '/kpis'
              ? location.pathname === '/kpis'
              : location.pathname.startsWith(basePath) &&
                (searchPart
                  ? location.search.includes(searchPart.toString())
                  : !mSiblingQueries.some(q => location.search.includes(q)));
            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors',
                  isActive ? 'text-[var(--pine)] bg-[var(--stone)]' : 'text-[var(--ink)]/70 hover:text-[var(--pine)] hover:bg-[var(--stone)]/60'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-[var(--pine)]' : 'text-[var(--ink)]/40')} />
                {label}
              </NavLink>
            );
          })}
        </div>
        {user && (
          <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-[var(--line)]">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--pine)] hover:bg-[var(--stone)] border border-transparent hover:border-[var(--line)] transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
};
