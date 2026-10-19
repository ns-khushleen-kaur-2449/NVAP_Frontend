import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart2, Mic, Table2, Sliders, BarChart3, ChevronLeft, ChevronRight, LayoutDashboard, Activity
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { path: '/manager-dashboard',        label: 'Team Overview',  icon: LayoutDashboard, roles: ['rep', 'manager', 'tenant_admin', 'super_admin'] },
  { path: '/call-quality',             label: 'Call Quality',   icon: BarChart2,       roles: ['rep', 'manager', 'tenant_admin', 'super_admin'] },
  { path: '/call-quality?view=analytics', label: 'Analytics',  icon: Activity,        roles: ['rep', 'manager', 'tenant_admin', 'super_admin'] },
  { path: '/audio-upload',             label: 'Audio Upload',   icon: Mic,             roles: ['rep', 'manager', 'tenant_admin', 'super_admin'] },
  { path: '/sheets-sync',              label: 'Sheets Sync',    icon: Table2,          roles: ['manager', 'tenant_admin', 'super_admin'] },
  { path: '/weight-config',            label: 'Score Weights',  icon: Sliders,         roles: ['tenant_admin', 'super_admin'] },
];

const navLinkClass = (isActive, collapsed) => cn(
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

export const ExecSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const visible = (roles) => !user || roles.includes(user.role);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'mk flex flex-col rounded-2xl bg-[var(--paper)] shadow-[0_30px_60px_-45px_rgba(15,23,42,0.5)] ring-1 ring-[var(--line)] transition-[width] duration-200 h-full overflow-hidden',
          collapsed ? 'w-[72px]' : 'w-[272px]'
        )}
      >
        {/* Header section */}
        <div className="flex flex-col border-b border-[var(--line)]">

          <div className="flex items-center gap-3 px-4 py-5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pine)] to-[var(--ink)] text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="mk-display text-lg font-semibold tracking-tight text-[var(--ink)]">Executive Analytics</h1>
                <p className="mk-eyebrow text-[0.6rem] text-[var(--pine)]">AI Analytics</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter(item => visible(item.roles)).map((item) => {
              const [itemPath, itemQuery] = item.path.split('?');
              const isActive = itemQuery
                ? location.pathname === itemPath && location.search.includes(itemQuery)
                : location.pathname.startsWith(itemPath) && !location.search.includes('view=');
              const Icon = item.icon;

              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={navLinkClass(isActive, collapsed)}
                >
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>
        </ScrollArea>


        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-[var(--line)] text-[var(--mist)] hover:text-[var(--pine)] hover:bg-[var(--stone)] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
};
