import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import BrandLockup from '@/components/shared/BrandLockup';

export default function MarketingFooter() {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  // Already on the landing page with this hash in the URL: the router sees no
  // change, so scroll directly instead of relying on the hash effect.
  const goToSection = (e, target) => {
    if (pathname !== '/' || hash !== target) return;
    const el = document.querySelector(target);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="mk mk-band bg-[var(--deep)] text-[var(--deep-fg)]">
      <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-10">
        <div className="grid gap-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label="SmartSDR by Netsmartz — home" className="inline-flex">
              <BrandLockup layout="stacked" size="xl" />
            </Link>
            <h3 className="mk-display mt-8 max-w-md text-[2.2rem] font-semibold leading-[1.1]">
              Put your calls to work.
            </h3>
            <button
              onClick={() => navigate('/login')}
              className="mk-underline mt-7 inline-flex items-center gap-2 pb-1 text-[var(--brass-2)]"
            >
              Get started <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div>
            <p className="mk-eyebrow text-white/40">Platform</p>
            <ul className="mt-5 space-y-3 text-[0.95rem] text-white/75">
              <li><Link to="/#voice-agent" onClick={(e) => goToSection(e, '#voice-agent')} className="hover:text-[var(--brass-2)]">Voice Agent</Link></li>
              <li><Link to="/#pricing" onClick={(e) => goToSection(e, '#pricing')} className="hover:text-[var(--brass-2)]">Pricing</Link></li>
              <li><Link to="/#how" onClick={(e) => goToSection(e, '#how')} className="hover:text-[var(--brass-2)]">How it works</Link></li>
            </ul>
          </div>

          <div>
            <p className="mk-eyebrow text-white/40">Account</p>
            <ul className="mt-5 space-y-3 text-[0.95rem] text-white/75">
              <li><Link to="/login" className="hover:text-[var(--brass-2)]">Sign in</Link></li>
              <li><a href="mailto:hello@netsmartz.com" className="hover:text-[var(--brass-2)]">Contact us</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/40">
          <span>© {new Date().getFullYear()} SmartSDR · Netsmartz</span>
          {/* Privacy / Terms links removed until /privacy and /terms pages exist. */}
        </div>
      </div>
    </footer>
  );
}
