import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { ButtonLink } from '../components/primitives';
import { useSession } from '../context/SessionContext';
import { homeFor } from '../config/roles';

const LINKS = [
  { to: '/', label: 'Agents', end: true },
  { to: '/pricing', label: 'Pricing' },
  { to: '/how-it-works', label: 'How it works' },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, role } = useSession();

  const linkClass = ({ isActive }) =>
    cn(
      'font-medium transition-colors',
      isActive ? 'text-[var(--nv-chrome-fg)]' : 'text-[var(--nv-chrome-muted)] hover:text-[var(--nv-chrome-fg)]',
    );
  const quietLink = 'font-semibold text-[var(--nv-chrome-muted)] hover:text-[var(--nv-chrome-fg)]';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--nv-chrome-border)] bg-[var(--nv-chrome-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-7" aria-label="Main">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
          </nav>
          <div className="ml-auto hidden md:flex items-center gap-5">
            <ThemeToggle />
            {user
              ? <Link to={homeFor(role)} className={quietLink}>Go to workspace</Link>
              : <Link to="/signin" className={quietLink}>Sign in</Link>}
            <ButtonLink to="/request-demo"><Phone className="h-4 w-4" aria-hidden /> Book a demo</ButtonLink>
          </div>
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--nv-chrome-fg)] hover:bg-[var(--nv-chrome-hover)]"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu: slides open by animating its row height */}
        <div
          id="public-mobile-menu"
          className={cn(
            'grid md:hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          inert={!open}
        >
          <div className="overflow-hidden">
            <nav className="border-t border-[var(--nv-chrome-border)] px-4 py-4 flex flex-col gap-4" aria-label="Main">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>{l.label}</NavLink>
              ))}
              <Link to={user ? homeFor(role) : '/signin'} className={quietLink} onClick={() => setOpen(false)}>
                {user ? 'Go to workspace' : 'Sign in'}
              </Link>
              <ButtonLink to="/request-demo" onClick={() => setOpen(false)}>Book a demo</ButtonLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--nv-line)] py-8 text-sm text-[var(--nv-muted)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} Netsmartz · Voice Intelligence Platform</span>
          <span>Built on Twilio · Vapi · ElevenLabs · Nylas</span>
        </div>
      </footer>
    </div>
  );
}
