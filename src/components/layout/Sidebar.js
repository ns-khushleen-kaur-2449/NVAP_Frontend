import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Sparkles,  PhoneCall, Inbox as InboxIcon, CalendarClock, Package,
  Layers, Phone, Mic, BookOpen, UploadCloud, Megaphone, ClipboardCheck, Bot,
  ChevronDown, ChevronLeft, ChevronRight, Settings, LogOut, GitCompareArrows, ShieldCheck, Crown, BarChart3,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getBillingSubscription } from '@/lib/api';
import { BILLING_CHANGED } from '@/components/billing/billingUi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandLockup, { NetsmartzMark } from '@/components/shared/BrandLockup';
import {
  canManageBilling, canUseAdmin, canViewAssistants, canViewOperations, featureEnabled, voiceTabEnabled,
} from '@/lib/rbac';

const APP_NAV = [
  { path: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  // The agents this organisation may use (the backend filters the list; every role may view it).
  { path: '/agents',      label: 'Agents',       icon: Bot },
];

// Secondary surfaces, listed below Voice Agent.
const PENDING_NAV = [
  // Operations: appointments for everyone; callbacks, do-not-call and intent review only for
  // Tenant Admins and Managers (pages/Operations.jsx gates each tab).
  { path: '/operations',  label: 'Operations',   icon: ClipboardCheck,
    requires: (user) => canViewOperations(user) || featureEnabled(user, 'appointment_booking') },
  { path: '/prospecting', label: 'Prospecting',  icon: Users },
  { path: '/conversion',  label: 'Conversion',   icon: GitCompareArrows },
  // Hidden from the menu for now; the /strategist page and route still work.
  // { path: '/strategist',  label: 'AI Strategist', icon: Sparkles },
  { path: '/inbox',       label: 'Inbox',        icon: InboxIcon },
  { path: '/catalog',     label: 'Catalog',      icon: Package, requires: (user) => featureEnabled(user, 'product_catalog') },
  { path: '/meetings',    label: 'Meetings',     icon: CalendarClock },
  { path: '/reports',     label: 'Reports & Analytics', icon: BarChart3 },
];

// Voice Agent's own internal views — reached as /voice_agent?tab=<id>, read by
// VoiceAgent.js's existing searchParams-sync effect.
const VOICE_TABS = [
  { id: 'builder',  label: 'Lead-to-Campaign Builder', icon: Layers },
  { id: 'logs',      label: 'Call Logs',                icon: Phone },
  // Creating assistants is Manager and up (the backend's AssistantAction.CREATE); the knowledge
  // base is refused to Sales Reps, so neither is offered to them.
  { id: 'create',    label: 'Create Agent',             icon: Mic, requires: canViewAssistants },
  { id: 'kb',        label: 'Knowledge Base',           icon: BookOpen, requires: canViewAssistants },
  { id: 'csv',       label: 'CSV Call Campaign',        icon: UploadCloud },
  // Its own route rather than a ?tab= view, so it carries `path`. The render
  // below falls back to the ?tab= form for every entry without one.
  { id: 'campaigns', label: 'Voice Campaigns',          icon: Megaphone, path: '/voice-campaigns' },
  { id: 'single',    label: 'Single Call',              icon: PhoneCall },
  // Assistant Requests — hidden from the nav for now (the page and its links from notifications still work).
  // Sales Reps propose assistant changes there; Managers and Tenant Admins review them. Restore this line and
  // the canUseAssistantRequests import from '@/lib/rbac' to bring it back.
  // { id: 'requests',  label: 'Assistant Requests',       icon: ClipboardCheck, requires: canUseAssistantRequests },
];

// Report Agent views — hidden from the nav for now. Restore this array, the
// reportOpen state, onReportAgent, the JSX group below, and the
// ClipboardList/BarChart2/Table2/Sliders icon imports to bring the section back.
// const REPORT_TABS = [
//   { path: '/manager-dashboard',            label: 'Team Overview', icon: LayoutDashboard, roles: ['agent', 'manager', 'admin'] },
//   { path: '/call-quality',                 label: 'Call Quality',  icon: BarChart2,       roles: ['agent', 'manager', 'admin'] },
//   { path: '/call-quality?view=analytics',  label: 'Analytics',     icon: Activity,        roles: ['agent', 'manager', 'admin'] },
//   { path: '/audio-upload',                 label: 'Audio Upload',  icon: Mic,             roles: ['agent', 'manager', 'admin'] },
//   { path: '/sheets-sync',                  label: 'Sheets Sync',   icon: Table2,          roles: ['manager', 'admin'] },
//   { path: '/weight-config',                label: 'Score Weights', icon: Sliders,         roles: ['admin'] },
// ];

const itemClass = (isActive, collapsed) => cn(
  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
  isActive
    ? 'bg-[var(--pine)] text-white shadow-[0_10px_24px_-12px_rgba(248,114,23,0.6)]'
    : 'text-[var(--mist)] hover:text-[var(--ink)] hover:bg-[var(--stone)]',
  collapsed && 'justify-center px-2'
);

const iconClass = (isActive) => cn(
  'h-4 w-4 shrink-0 transition-colors',
  isActive ? 'text-white' : 'text-[var(--mist)] group-hover:text-[var(--pine)]'
);

// Phone width: start collapsed (icons only) so the page keeps the screen.
const startCollapsed = () => Boolean(window.matchMedia?.('(max-width: 767px)').matches);

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  // Voice Agent is the primary surface, so its sub-list starts expanded.
  const [voiceOpen, setVoiceOpen] = useState(true);
  // const [reportOpen, setReportOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  // The organisation's current plan, shown above Logout for its Tenant Admin. Re-read when they leave the
  // billing page, so a plan they just bought shows without a reload. A failure only hides the label.
  const [plan, setPlan] = useState(null);
  const billingAdmin = canManageBilling(user);
  const onBilling = location.pathname.startsWith('/billing');
  useEffect(() => {
    if (!billingAdmin) return undefined;
    let stopped = false;
    Promise.resolve(getBillingSubscription())
      .then(({ data }) => { if (!stopped) setPlan({ key: data.plan, name: data.plan_name }); })
      .catch(() => { if (!stopped) setPlan(null); });
    return () => { stopped = true; };
  }, [billingAdmin, onBilling]);
  useEffect(() => {
    if (!billingAdmin) return undefined;
    const update = (e) => setPlan(e.detail);
    window.addEventListener(BILLING_CHANGED, update);
    return () => window.removeEventListener(BILLING_CHANGED, update);
  }, [billingAdmin]);
  const topPlan = plan?.key === 'pro_plus';

  const params = new URLSearchParams(location.search);
  const onVoiceAgent = location.pathname.startsWith('/voice_agent');
  // const onReportAgent = REPORT_TABS.some(
  //   (t) => location.pathname === t.path.split('?')[0]
  // );
  // With no ?tab=, VoiceAgent shows the campaign builder.
  const currentTab = onVoiceAgent ? (params.get('tab') || (params.get('view') === 'logs' ? 'logs' : 'builder')) : null;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'mk flex flex-col h-screen sticky top-0 shrink-0 bg-[var(--paper)] border-r border-[var(--line)] transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-[264px]'
        )}
      >
        <div className={cn('flex shrink-0 items-center border-b border-[var(--line)]', collapsed ? 'h-14 justify-center px-2' : 'px-5 py-4')}>
          {/* The logo is only a brand mark: it does not navigate anywhere. */}
          <div role="img" aria-label="SmartSDR by Netsmartz" className={cn('flex items-center text-[var(--ink)]', !collapsed && 'w-full')}>
            {collapsed
              ? <NetsmartzMark size={30} />
              : <BrandLockup layout="stacked" size="sm" wordAlign="end" className="flex w-full" />}
          </div>
        </div>

        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="flex flex-col gap-0.5">
            {APP_NAV.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              const link = (
                <Link key={item.path} to={item.path} aria-label={collapsed ? item.label : undefined} className={itemClass(isActive, collapsed)}>
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}

            {/* Voice Agent — expandable group, part of the same list (no separator).
                Purely a toggle: it does not navigate anywhere by itself, it just
                opens/closes the sub-list below. */}
            <button
              type="button"
              onClick={() => setVoiceOpen((v) => !v)}
              className={cn(itemClass(onVoiceAgent, collapsed), 'w-full')}
              title="Voice Agent"
              aria-label="Voice Agent"
              aria-expanded={voiceOpen}
            >
              <PhoneCall className={iconClass(onVoiceAgent)} />
              {!collapsed && <span className="flex-1 text-left">Voice Agent</span>}
              {!collapsed && (
                <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', voiceOpen ? 'rotate-180' : '')} />
              )}
            </button>

            {(voiceOpen || collapsed) && (
              <div className={collapsed ? '' : 'pl-4 flex flex-col gap-0.5'}>
                {VOICE_TABS.filter((tab) => (!tab.requires || tab.requires(user)) && voiceTabEnabled(user, tab.id)).map((tab) => {
                  const isActive = tab.path
                    ? location.pathname.startsWith(tab.path)
                    : onVoiceAgent && currentTab === tab.id;
                  const Icon = tab.icon;
                  const link = (
                    <Link key={tab.id} to={tab.path || `/voice_agent?tab=${tab.id}`} aria-label={collapsed ? tab.label : undefined} className={itemClass(isActive, collapsed)}>
                      <Icon className={iconClass(isActive)} />
                      {!collapsed && <span>{tab.label}</span>}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            )}

            {/* Report Agent — hidden for now; same expandable pattern as Voice Agent above.
            <button
              onClick={() => setReportOpen((v) => !v)}
              className={cn(itemClass(onReportAgent, collapsed), 'w-full')}
              title="Report Agent"
            >
              <ClipboardList className={iconClass(onReportAgent)} />
              {!collapsed && <span className="flex-1 text-left">Report Agent</span>}
              {!collapsed && (
                <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', reportOpen ? 'rotate-180' : '')} />
              )}
            </button>

            {(reportOpen || collapsed) && (
              <div className={collapsed ? '' : 'pl-4 flex flex-col gap-0.5'}>
                {REPORT_TABS.filter((tab) => !user || tab.roles.includes(user.role)).map((tab) => {
                  const [tabPath, tabQuery] = tab.path.split('?');
                  const isActive = tabQuery
                    ? location.pathname === tabPath && location.search.includes(tabQuery)
                    : location.pathname === tabPath && !location.search.includes('view=');
                  const Icon = tab.icon;
                  const link = (
                    <Link key={tab.path} to={tab.path} className={itemClass(isActive, collapsed)}>
                      <Icon className={iconClass(isActive)} />
                      {!collapsed && <span>{tab.label}</span>}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={tab.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            )}
            */}

            {PENDING_NAV.filter((item) => !item.requires || item.requires(user)).map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              const link = (
                <Link key={item.path} to={item.path} aria-label={collapsed ? item.label : undefined} className={itemClass(isActive, collapsed)}>
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-[var(--line)] px-3 py-3 space-y-1 shrink-0">
          {/* Admin — hidden for now.
          {hasRole('admin', 'manager') && (
            <Link to="/admin" className={itemClass(false, collapsed)}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--mist)] group-hover:text-[var(--pine)]" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
          */}
          {/* Users, Teams and Tenants open from Settings → General → Administration (lib/adminNav.js), not from here. */}
          <NavLink to="/settings" aria-label={collapsed ? 'Settings' : undefined} className={({ isActive }) => itemClass(isActive, collapsed)}>
            <Settings className="h-4 w-4 shrink-0 text-[var(--mist)] group-hover:text-[var(--pine)]" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          <div className={cn('flex items-center gap-2 px-1 pt-1', collapsed ? 'flex-col' : 'justify-between')}>
            {!collapsed && user?.email && <span className="text-xs text-[var(--mist)] truncate">{user.email}</span>}
            <ThemeToggle className="h-8 w-8 shrink-0" />
          </div>
          {/* Upgrade Plan — the organisation's subscription; only its Tenant Admin sees it. Sits just above Logout. */}
          {billingAdmin && plan && !collapsed && (
            <p data-testid="current-plan" className="px-3 pt-1 text-xs text-[var(--mist)]">
              You are on the <span className="font-semibold text-[var(--pine)]">{plan.name}</span> plan
            </p>
          )}
          {billingAdmin && (
            <NavLink
              to="/billing"
              aria-label={collapsed ? (topPlan ? 'Manage Plan' : 'Upgrade Plan') : undefined}
              title={collapsed ? (topPlan ? `${plan.name} plan` : plan ? `${plan.name} plan - upgrade` : 'Upgrade Plan') : undefined}
              className={({ isActive }) => cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 hover:translate-x-0.5',
                isActive
                  ? 'bg-[var(--pine)] text-white shadow-[0_10px_24px_-12px_rgba(248,114,23,0.6)]'
                  : 'text-[var(--pine)] hover:bg-[rgba(248,114,23,0.12)]',
                collapsed && 'justify-center px-2 hover:translate-x-0'
              )}
            >
              <Crown className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
              {!collapsed && <span>{topPlan ? 'Manage Plan' : 'Upgrade Plan'}</span>}
            </NavLink>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Logout' : undefined}
            onClick={logout}
            className={cn(
              'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--mist)] hover:text-[var(--pine)] hover:bg-[var(--stone)] transition-colors',
              collapsed && 'justify-center px-2'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button
          type="button"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center justify-center py-2.5 border-t border-[var(--line)] text-[var(--mist)] hover:text-[var(--pine)] hover:bg-[var(--stone)] transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}

export default Sidebar;
