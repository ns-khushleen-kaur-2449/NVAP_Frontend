import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import HeroWave3D from '@/components/marketing/HeroWave3D';
import { VoiceCard } from '@/components/marketing/ProductVisuals';
import HelperCharacter from '@/components/shared/HelperCharacter';
import ThemeToggle from '@/components/shared/ThemeToggle';

const SSO_PROVIDERS = [
  {
    id: 'google', label: 'Google',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.11Z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"/></svg>
    ),
  },
  {
    id: 'microsoft', label: 'Microsoft',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
    ),
  },
];

export default function LoginPage() {
  const { login, user, token } = useAuth();
  const navigate = useNavigate();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [visible,      setVisible]      = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => { if (user || token) navigate('/dashboard', { replace: true }); }, [user, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 bg-white dark:bg-[var(--stone)] border-[1.5px] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--mist)]/70 focus:border-[var(--pine)] focus:ring-4 focus:ring-[var(--pine)]/15';

  const handleSSO = (provider) => {
    toast.info(`${provider} sign-in is coming soon — use email for now.`);
  };

  return (
    <div className="mk min-h-screen flex bg-[var(--paper)]">
      {/* Left Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-8 md:px-14 lg:px-20 py-10 min-h-screen overflow-y-auto bg-[var(--paper)]">
        <div className="mb-12 flex items-center justify-between"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}>
          <Link to="/" className="flex items-center gap-2 text-sm group w-fit text-[var(--mist)] hover:text-[var(--pine)] transition-colors">
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="max-w-sm w-full mx-auto"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.5s ease 0.05s, transform 0.5s ease 0.05s' }}>

          {/* Brand */}
          <div className="mb-10 flex flex-col leading-none">
            <span className="mk-display text-3xl font-semibold text-[var(--ink)]">
              Smart<span className="text-[var(--pine)]">SDR</span>
            </span>
            <span className="mk-eyebrow mt-1.5 text-[var(--pine)]">by Netsmartz</span>
          </div>

          <h1 className="mk-display text-3xl font-semibold mb-2 text-[var(--ink)]">Welcome back</h1>
          <p className="mb-7 text-sm text-[var(--mist)]">Sign in to your Report Agent and Voice Agent workspace.</p>

          <div className="grid grid-cols-2 gap-3">
            {SSO_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSSO(p.label)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--pine)]/50 dark:bg-[var(--stone)]"
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-[var(--mist)]">
            <span className="h-px flex-1 bg-[var(--line)]" /> or with email <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-semibold text-[var(--ink)]">Email</label>
              <input id="login-email" type="email" placeholder="you@company.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass} data-testid="login-email-input" required />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-semibold text-[var(--ink)]">Password</label>
              <div className="relative">
                <input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`} data-testid="login-password-input" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--mist)] hover:text-[var(--ink)] transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl text-white font-bold text-sm transition-all duration-200 disabled:opacity-60"
              style={{ background: 'var(--pine)', boxShadow: loading ? 'none' : '0 6px 20px rgba(248,114,23,0.35)', cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--pine-2)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--pine)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              data-testid="login-submit-btn">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Right Visual Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center bg-[var(--deep)]">
        <HeroWave3D className="pointer-events-none absolute inset-0 opacity-55" />
        {/* Aurora atmosphere */}
        <div className="mk-aurora pointer-events-none absolute -top-32 left-10 h-[32rem] w-[32rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.4), transparent 62%)' }} />
        <div className="mk-aurora pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.28), transparent 62%)', animationDelay: '4s' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at 50% 40%, black, transparent 72%)' }} />

        <div className="relative z-10 w-full max-w-md px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="mk-eyebrow text-[var(--brass-2)]">AI sales intelligence</p>
            <h2 className="mk-display mt-4 text-[2.6rem] font-semibold leading-[1.08] text-white">
              Every call, qualified and{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--pine)] to-[var(--brass)]">scored.</span>
            </h2>
            <p className="mt-4 text-sm text-white/60">Two agents for real-estate teams, one login.</p>
          </motion.div>

          {/* Live product card */}
          <div className="relative mt-12 flex justify-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}>
              <div className="mk-float"><VoiceCard /></div>
            </motion.div>
          </div>
        </div>
      </div>
      <HelperCharacter />
    </div>
  );
}
