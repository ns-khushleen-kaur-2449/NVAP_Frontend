import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { PLATFORM_NAV, visibleNavItems } from '@/lib/adminNav';
import ThemeToggle from '@/components/shared/ThemeToggle';

const itemClass = ({ isActive }) => cn(
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
  isActive ? 'bg-[var(--pine)] text-white' : 'text-[var(--mist)] hover:text-[var(--ink)] hover:bg-[var(--stone)]',
);

/**
 * The platform control area's own shell (/admin/*): a sidebar with only the platform pages
 * (lib/adminNav.js PLATFORM_NAV), kept apart from the tenant app and its Settings. On a phone the
 * sidebar becomes a row of links above the page.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const items = visibleNavItems(user, PLATFORM_NAV);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background" data-testid="admin-layout">
      <aside className="mk shrink-0 md:w-[240px] md:h-screen md:sticky md:top-0 flex flex-col bg-[var(--paper)] border-b md:border-b-0 md:border-r border-[var(--line)]">
        <div className="flex items-center gap-3 px-4 py-4 md:border-b border-[var(--line)]">
          <ShieldCheck className="h-5 w-5 text-[var(--pine)]" />
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-[var(--ink)]">Platform admin</p>
            <p className="text-[11px] text-[var(--mist)]">Super Admin</p>
          </div>
        </div>

        <nav aria-label="Platform admin" className="flex md:flex-col gap-1 px-3 pb-3 md:py-3 overflow-x-auto md:flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={itemClass}>
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-[var(--mist)] group-hover:text-[var(--pine)]')} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden md:block border-t border-[var(--line)] px-3 py-3 space-y-1">
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            {user?.email && <span className="text-xs text-[var(--mist)] truncate">{user.email}</span>}
            <ThemeToggle className="h-8 w-8 shrink-0" />
          </div>
          <button type="button" onClick={logout} className={cn(itemClass({ isActive: false }), 'w-full')}>
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-end gap-2 px-4 pt-3">
          <ThemeToggle className="h-8 w-8" />
          <button type="button" onClick={logout} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
