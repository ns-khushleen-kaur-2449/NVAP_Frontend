import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useSession } from '../context/SessionContext';
import { navFor } from '../config/navigation';
import { ROLE_LABELS, homeFor } from '../config/roles';
import { USE_MOCKS } from '../api/client';

const COLLAPSE_KEY = 'nvip_sidebar_collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

const iconButton =
  'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--nv-chrome-muted)] ' +
  'transition-colors hover:bg-[var(--nv-chrome-hover)] hover:text-[var(--nv-chrome-fg)]';

/** Fades a label out while the rail narrows; it stays in the DOM so links keep their accessible name. */
function Label({ collapsed, children }) {
  return (
    <span
      className={cn(
        'whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none',
        collapsed && 'opacity-0',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Sidebar body, shared by the desktop rail and the mobile drawer.
 *   collapsed          icon-only rail (desktop)
 *   onToggleCollapse   desktop collapse/expand button
 *   onClose            mobile drawer close button
 */
function SidebarContent({ collapsed = false, onToggleCollapse, onClose, onNavigate }) {
  const { user, tenant, role, signOut } = useSession();
  const items = navFor(role, { isMspParent: tenant?.isMspParent });

  return (
    <div className="flex h-full flex-col px-3.5 py-5">
      {/* Header: logo + collapse (desktop) or close (mobile) */}
      <div className={cn('mb-7 flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between pl-1')}>
        <Logo to={homeFor(role)} compact={collapsed} />
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={iconButton}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close menu">
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1" aria-label="Workspace">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={`/app/${path}`}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => cn(
              'flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 font-medium transition-colors',
              isActive
                ? 'bg-[var(--nv-orange)] text-white shadow-sm'
                : 'text-[var(--nv-chrome-muted)] hover:bg-[var(--nv-chrome-hover)] hover:text-[var(--nv-chrome-fg)]',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <Label collapsed={collapsed}>{label}</Label>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        {/* Tenancy context banner (doc §29.7) */}
        {tenant?.parent && (collapsed ? (
          <div
            className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-[var(--nv-chrome-raised)] text-[var(--nv-chrome-muted)]"
            title={`Managed under ${tenant.parent.name}`}
          >
            <Building2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Managed under {tenant.parent.name}</span>
          </div>
        ) : (
          <div className="whitespace-nowrap rounded-xl bg-[var(--nv-chrome-raised)] px-4 py-3 text-sm text-[var(--nv-chrome-muted)]">
            Managed under <span className="font-semibold text-[var(--nv-chrome-fg)]">{tenant.parent.name}</span>
          </div>
        ))}

        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'pl-1')}>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--nv-chrome-fg)]">{user?.name}</div>
              <div className="truncate text-xs text-[var(--nv-chrome-muted)]">{ROLE_LABELS[role]}</div>
            </div>
          )}
          <ThemeToggle />
          <button type="button" onClick={signOut} className={iconButton} aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage blocked — remembered for this visit only */
      }
      return !c;
    });
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar: animates between full width and an icon rail */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 overflow-y-auto overflow-x-hidden border-r border-[var(--nv-chrome-border)]',
          'bg-[var(--nv-chrome-bg)] transition-[width] duration-300 ease-out motion-reduce:transition-none lg:block',
          collapsed ? 'w-[76px]' : 'w-[17.5rem]',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--nv-chrome-border)] bg-[var(--nv-chrome-bg)] px-4 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" className={iconButton} onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile drawer: always mounted so it can slide in and out */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', !mobileOpen && 'pointer-events-none')} inert={!mobileOpen}>
        <div
          className={cn(
            'absolute inset-0 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-72 overflow-y-auto bg-[var(--nv-chrome-bg)] shadow-xl',
            'transition-transform duration-300 ease-out motion-reduce:transition-none',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Workspace menu"
        >
          <SidebarContent onClose={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          {/* Quiet note on the page background — not a coloured band, so the page reads as one surface. */}
          {USE_MOCKS && (
            <p
              className="-mt-3 mb-5 flex items-center gap-2 text-xs text-[var(--nv-muted)]"
              title="Set REACT_APP_NVIP_USE_MOCKS=false to use the NVIP backend"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-orange)]" aria-hidden />
              Showing demo data
            </p>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
