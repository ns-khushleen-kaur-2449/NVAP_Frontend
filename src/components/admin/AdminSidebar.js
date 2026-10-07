import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNav = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard },
];

export default function AdminSidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r border-border bg-white px-4 py-6 md:flex">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsla(215,84%,47%,0.14)]">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary))]" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold">Admin Hub</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Enterprise Control</p>
        </div>
      </div>

      <nav className="mt-8 space-y-2 text-sm font-medium text-muted-foreground">
        {adminNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:text-foreground',
                  isActive && 'bg-[hsl(var(--surface-2))] text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
