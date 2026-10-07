import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ntzLogo from '@/assets/NTZLOGOnew1.png';

export default function MarketingFooter() {
  const navigate = useNavigate();
  return (
    <footer className="mk bg-[var(--deep)] text-[var(--deep-fg)]">
      <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-10">
        <div className="grid gap-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="mk-eyebrow text-[var(--brass-2)]">SmartSDR · by Netsmartz</p>
            <h3 className="mk-display mt-5 max-w-md text-[2.2rem] font-semibold leading-[1.1]">
              Put your calls to work.
            </h3>
            <button
              onClick={() => navigate('/login')}
              className="mk-underline mt-7 inline-flex items-center gap-2 pb-1 text-[var(--brass-2)]"
            >
              Get started <ArrowUpRight className="h-4 w-4" />
            </button>

            <div className="mt-11">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-white/35">Built by</span>
              <img
                src={ntzLogo}
                alt="Netsmartz — celebrating 26 years"
                className="mt-1 h-14 w-auto max-w-[220px] object-contain object-left"
              />
            </div>
          </div>

          <div>
            <p className="mk-eyebrow text-white/40">Platform</p>
            <ul className="mt-5 space-y-3 text-[0.95rem] text-white/75">
              <li><Link to="/#executive-report" className="hover:text-[var(--brass-2)]">Executive Analytics</Link></li>
              <li><Link to="/#voice-agent" className="hover:text-[var(--brass-2)]">Voice Agent</Link></li>
              <li><Link to="/#pricing" className="hover:text-[var(--brass-2)]">Pricing</Link></li>
              <li><Link to="/#how" className="hover:text-[var(--brass-2)]">How it works</Link></li>
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
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-white/70">Privacy</Link>
            <Link to="/login" className="hover:text-white/70">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
