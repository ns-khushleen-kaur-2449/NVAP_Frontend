import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowLeft, Mail, LockKeyhole, Info, AudioLines, Activity, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import HeroWave3D from '@/components/marketing/HeroWave3D';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { NetsmartzLogo, SmartSDRWordmark } from '@/components/shared/BrandLockup';
import { cn } from '@/lib/utils';
import { homePath } from '@/lib/rbac';
import { CodeInput, codeError } from '@/components/auth/MfaParts';

// "Remember me" keeps the email address on this device so the field is filled
// in next time. Sign-in itself always persists (see AuthContext), so this
// never stores the password or the session.
const REMEMBERED_EMAIL_KEY = 'smartsdr_login_email';

const readRememberedEmail = () => {
  try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { return ''; }
};
const writeRememberedEmail = (email) => {
  try {
    if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch { /* storage unavailable: nothing to remember */ }
};

const FEATURES = [
  { icon: AudioLines, t: 'Intelligent Voice Agents', d: 'Automate and scale your conversations.' },
  { icon: Activity, t: 'Real-time Call Insights', d: 'Analyze, qualify and score every call.' },
  { icon: ShieldCheck, t: 'Secure & Reliable', d: 'Built for enterprise-grade security.' },
];

/* Faint connected-node network running down the brand panel's inner edge, so it
   never sits behind the logo or the copy. Two links carry a slow moving dash
   ("data flowing"), skipped when the visitor prefers reduced motion. */
const NODES = [
  [70, 40], [30, 110], [95, 175], [45, 250], [110, 320], [60, 385], [165, 140],
  [185, 225], [235, 300], [190, 370], [210, 70], [265, 190], [270, 420], [140, 455],
];
const LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 4], [7, 8], [8, 9],
  [9, 4], [6, 10], [7, 11], [8, 12], [9, 13], [5, 13], [11, 8], [0, 6],
];
const FLOWING = new Set([3, 8]);

function NeuralNetwork({ animate, className }) {
  return (
    <svg viewBox="0 0 300 480" fill="none" aria-hidden="true" className={className}>
      {LINKS.map(([a, b], i) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        const flowing = animate && FLOWING.has(i);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={flowing ? 'rgba(255,138,61,0.75)' : 'rgba(248,114,23,0.28)'}
            strokeWidth={flowing ? 1.4 : 1}
            strokeDasharray={flowing ? '6 10' : undefined}>
            {flowing && <animate attributeName="stroke-dashoffset" from="32" to="0" dur="2.4s" repeatCount="indefinite" />}
          </line>
        );
      })}
      {NODES.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="6" fill="rgba(248,114,23,0.10)" />
          <circle cx={cx} cy={cy} r="2.2" fill="#FF8A3D" />
        </g>
      ))}
    </svg>
  );
}

export default function LoginPage() {
  const { login, completeMfaLogin, user, token } = useAuth();
  const navigate = useNavigate();
  const [email,        setEmail]        = useState(readRememberedEmail);
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [remember,     setRemember]     = useState(() => Boolean(readRememberedEmail()));
  const [showResetHelp, setShowResetHelp] = useState(false);
  // A Super Admin's second step: { token } from the password step; recovery: typing a recovery code instead.
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaError, setMfaError] = useState(null);
  const [reducedMotion] = useState(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));

  useEffect(() => { if (user || token) navigate(homePath(user), { replace: true }); }, [user, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const signedIn = await login(email, password);
      writeRememberedEmail(remember ? email.trim() : '');
      if (signedIn?.mfa_required) {
        setMfa({ token: signedIn.mfa_token });
        setPassword('');
        return;
      }
      toast.success('Welcome back!');
      navigate(homePath(signedIn?.user));
    } catch (err) {
      toast.error(err.response?.status === 429 ? 'Too many sign-in attempts. Wait a few minutes, then try again.'
        : err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setLoading(true);
    setMfaError(null);
    try {
      const signedIn = await completeMfaLogin(mfa.token, useRecovery ? { recoveryCode: mfaCode.trim() } : { code: mfaCode });
      toast.success('Welcome back!');
      navigate(homePath(signedIn?.user));
    } catch (err) {
      const message = codeError(err);
      setMfaCode('');
      if (err.response?.status === 401 && err.response?.data?.detail === 'Sign in again') {
        setMfa(null);  // the challenge expired or was used: start again from the password
        toast.error(message);
      } else setMfaError(message);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => { setMfa(null); setMfaCode(''); setMfaError(null); setUseRecovery(false); };

  // Field colours live in CSS variables so the autofill override below can
  // repaint Chrome's blue autofill background with the same surface colour.
  const fieldClass = cn(
    'peer w-full h-12 rounded-xl border pl-11 pr-4 text-sm outline-none transition-[border-color,box-shadow] duration-200',
    'bg-[var(--field)] border-[var(--field-line)] text-[var(--ink)] caret-[var(--pine)] placeholder:text-[var(--mist)]/70',
    'hover:border-[rgba(248,114,23,0.4)] focus:border-[var(--pine)] focus:ring-4 focus:ring-[rgba(248,114,23,0.16)]',
    'autofill:shadow-[inset_0_0_0_1000px_var(--field)] autofill:[-webkit-text-fill-color:var(--ink)]',
  );
  const fieldIconClass = 'pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mist)] transition-colors peer-focus:text-[var(--pine)]';

  return (
    <div className="mk relative isolate flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#FFF6EC_0%,#FDEBDA_100%)] dark:bg-none dark:bg-[#080808] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">

      {/* ── Shared backdrop. It spans the whole page, so the 3D wave runs under
             both columns in either theme (light mode reuses the landing hero's warm
             band). On small screens the wave sits behind the brand header at the
             top instead. ── */}
      <HeroWave3D className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] opacity-50 lg:bottom-0 lg:top-auto lg:h-[62%]" />
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.30), transparent 62%)' }} />
      <div className="pointer-events-none absolute -bottom-48 -right-32 -z-10 h-[30rem] w-[30rem] rounded-full mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.20), transparent 62%)', animationDelay: '5s' }} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '52px 52px', maskImage: 'radial-gradient(ellipse at 40% 40%, black, transparent 75%)' }} />

      {/* ── Brand panel: follows the theme, sits above the form on small screens ── */}
      <section className="relative text-[var(--ink)] lg:min-h-screen">
        <NeuralNetwork animate={!reducedMotion}
          className="pointer-events-none absolute right-0 top-1/2 -z-10 hidden w-[220px] -translate-y-1/2 opacity-80 lg:block xl:w-[260px] [mask-image:linear-gradient(to_left,black_35%,transparent_95%)]" />

        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex max-w-[34rem] flex-col px-6 pb-10 pt-8 sm:px-10 sm:pt-10 lg:mx-0 lg:min-h-screen lg:max-w-none lg:justify-center lg:px-16 lg:py-14 xl:px-24">
          {/* The logo gets its own box: as a direct child of this flex column it
              would be stretched to the column's full width. */}
          <div className="flex max-w-full items-center self-start">
            <NetsmartzLogo className="h-12 sm:h-14 lg:h-[4.5rem] xl:h-20" />
          </div>
          <SmartSDRWordmark className="mt-5 text-[2.5rem] text-[var(--ink)] sm:text-[2.9rem] lg:mt-7 lg:text-[3.4rem] xl:text-[3.9rem]" />

          <p className="mk-display mt-4 text-[1.15rem] font-medium leading-snug text-[var(--ink)]/90 lg:mt-6 lg:text-[1.4rem]">
            Your AI-Powered Voice Agent Workspace
          </p>
          <p className="mt-3 hidden max-w-[32rem] text-[0.98rem] leading-relaxed text-[var(--mist)] lg:block">
            Turn every conversation into insights. SmartSDR helps real estate teams qualify, analyze, and score calls using AI.
          </p>

          <ul className="mt-10 hidden max-w-[30rem] space-y-5 lg:block">
            {FEATURES.map((f, i) => (
              <motion.li key={f.t} className="flex items-start gap-4"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.25 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(248,114,23,0.4)] bg-white/70 text-[var(--pine)] dark:bg-[rgba(248,114,23,0.07)]">
                  <f.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="pt-0.5">
                  <span className="block text-[0.98rem] font-semibold text-[var(--ink)]">{f.t}</span>
                  <span className="mt-0.5 block text-sm text-[var(--mist)]">{f.d}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* ── Sign-in panel: follows the theme ── */}
      <section className="relative flex flex-1 flex-col px-5 py-8 sm:px-10 lg:min-h-screen lg:pl-0 lg:pr-12 lg:py-10">
        <div className="mx-auto flex w-full max-w-[26rem] items-center justify-between lg:max-w-none">
          <Link to="/" className="group flex w-fit items-center gap-2 rounded-md text-sm text-[var(--mist)] transition-colors hover:text-[var(--pine)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)]">
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <ThemeToggle />
        </div>

        {/* Desktop: the card starts at the column's left edge (in line with
            "Back to Home"), nearer the page centre; smaller screens centre it. */}
        <div className="flex flex-1 items-center justify-center py-8 lg:justify-start lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'w-full max-w-[26rem] rounded-[1.25rem] border p-7 sm:p-9',
              'border-[var(--line)] bg-white shadow-[0_24px_60px_-32px_rgba(23,19,15,0.25)]',
              'dark:border-[rgba(248,114,23,0.16)] dark:bg-[#0E0C0B] dark:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]',
              '[--field:#FFFFFF] [--field-line:var(--line)] dark:[--field:#14171C] dark:[--field-line:rgba(248,114,23,0.18)]',
            )}>
            {mfa ? (
              <form onSubmit={handleMfa} className="space-y-5" data-testid="login-mfa-form">
                <div>
                  <h1 className="mk-display text-[1.9rem] font-semibold leading-tight text-[var(--ink)]">Two-factor check</h1>
                  <p className="mt-1.5 text-sm text-[var(--mist)]">
                    {useRecovery ? 'Enter one of your recovery codes. Each works once.'
                      : 'Enter the 6-digit code from your authenticator app.'}
                  </p>
                </div>
                {useRecovery ? (
                  <input id="login-recovery-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                    autoComplete="off" autoFocus placeholder="abcde-12345" aria-label="Recovery code" maxLength={20}
                    className={cn(fieldClass, 'pl-4 font-mono tracking-wider')} />
                ) : (
                  <CodeInput id="login-mfa-code" value={mfaCode} onChange={setMfaCode} disabled={loading} />
                )}
                {mfaError && <p role="alert" className="text-sm text-red-600">{mfaError}</p>}
                <button type="submit" disabled={loading || (useRecovery ? !mfaCode.trim() : mfaCode.length !== 6)}
                  className="h-12 w-full rounded-xl bg-[var(--pine)] text-sm font-bold text-white transition-colors hover:bg-[var(--pine-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)] disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="login-mfa-submit">
                  {loading ? 'Checking…' : 'Verify'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setUseRecovery((v) => !v); setMfaCode(''); setMfaError(null); }}
                    className="font-semibold text-[var(--pine)] hover:underline underline-offset-4">
                    {useRecovery ? 'Use my authenticator app' : 'Use a recovery code'}
                  </button>
                  <button type="button" onClick={restart} className="text-[var(--mist)] hover:text-[var(--ink)]">Start over</button>
                </div>
              </form>
            ) : (<>
            <h1 className="mk-display text-[1.9rem] font-semibold leading-tight text-[var(--ink)]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-[var(--mist)]">Sign in to your Voice Agent workspace.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-sm font-semibold text-[var(--ink)]">Email address</label>
                <div className="relative">
                  <input id="login-email" type="email" autoComplete="email" placeholder="you@company.com" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={fieldClass} data-testid="login-email-input" required />
                  <Mail className={fieldIconClass} aria-hidden="true" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-sm font-semibold text-[var(--ink)]">Password</label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Enter your password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(fieldClass, 'pr-12', 'no-native-reveal')} data-testid="login-password-input" required />
                  <LockKeyhole className={fieldIconClass} aria-hidden="true" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--mist)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)]">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[var(--mist)] transition-colors hover:text-[var(--ink)]">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[var(--pine)]" data-testid="login-remember-checkbox" />
                  Remember me
                </label>
                <button type="button" onClick={() => setShowResetHelp((v) => !v)} aria-expanded={showResetHelp}
                  aria-controls="login-reset-help"
                  className="rounded-md font-semibold text-[var(--pine)] transition-colors hover:text-[var(--pine-2)] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)]">
                  Forgot password?
                </button>
              </div>

              {showResetHelp && (
                <p id="login-reset-help" role="status"
                  className="flex gap-2.5 rounded-xl border border-[rgba(248,114,23,0.25)] bg-[rgba(248,114,23,0.07)] px-3.5 py-3 text-[0.82rem] leading-relaxed text-[var(--ink)]/85">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pine)]" aria-hidden="true" />
                  Passwords are managed by your workspace admin. Ask them for a new temporary password — you'll choose your own the next time you sign in.
                </p>
              )}

              <button type="submit" disabled={loading}
                className={cn(
                  'h-12 w-full rounded-xl bg-[var(--pine)] text-sm font-bold text-white transition-all duration-200',
                  'shadow-[0_10px_30px_-8px_rgba(248,114,23,0.65)] hover:-translate-y-px hover:bg-[var(--pine-2)] hover:shadow-[0_14px_36px_-8px_rgba(248,114,23,0.8)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pine)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0E0C0B]',
                  'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:bg-[var(--pine)]',
                )}
                data-testid="login-submit-btn">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
            </>)}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
