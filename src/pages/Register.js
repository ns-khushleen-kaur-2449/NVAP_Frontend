import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Check, TrendingUp, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import HeroWave3D from '@/components/marketing/HeroWave3D';

const BENEFITS = [
  'Score every call on quality and outcome',
  'Launch autonomous voice-agent campaigns',
  'One workspace for your whole team',
];

const PRODUCTS = [
  { icon: TrendingUp, name: 'Executive Report', text: 'Call-quality analysis and executive reporting for managers.' },
  { icon: PhoneCall,  name: 'Voice Agent',      text: 'Autonomous AI voice agent that calls and qualifies leads.' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [role,         setRole]         = useState('agent');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [visible,      setVisible]      = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) { toast.error('Please fill in all fields'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(name, email, password, role);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = { border: '1.5px solid var(--line)', background: '#fff', color: 'var(--ink)' };
  const onFocus = e => { e.target.style.border = '1.5px solid var(--pine)'; e.target.style.boxShadow = '0 0 0 3px rgba(49,63,128,0.12)'; };
  const onBlur  = e => { e.target.style.border = '1.5px solid var(--line)'; e.target.style.boxShadow = 'none'; };

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : password.length < 14 ? 3 : 4;
  const strengthColors = ['#e2e8f0', '#ef4444', '#f59e0b', '#6D7BF0', '#10b981'];

  return (
    <div className="mk min-h-screen flex bg-[var(--paper)]">
      {/* Left Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-8 md:px-14 lg:px-20 py-10 min-h-screen overflow-y-auto bg-[var(--paper)]">
        <Link to="/" className="flex items-center gap-2 mb-10 text-sm group w-fit text-[var(--mist)] hover:text-[var(--pine)] transition-colors"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)', transition: 'opacity 0.4s, transform 0.4s' }}>
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="max-w-sm w-full mx-auto"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.5s ease 0.05s, transform 0.5s ease 0.05s' }}>

          {/* Brand */}
          <div className="mb-8 flex flex-col leading-none">
            <span className="mk-display text-3xl font-semibold text-[var(--ink)]">Mahima</span>
            <span className="mk-eyebrow mt-1.5 text-[var(--pine)]">AI Sales Platform</span>
          </div>

          <h1 className="mk-display text-3xl font-semibold mb-2 text-[var(--ink)]">Create your account</h1>
          <p className="mb-8 text-sm text-[var(--mist)]">Get your team on Executive Report and Voice Agent.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="block text-sm font-semibold text-[var(--ink)]">Full Name</label>
              <input id="reg-name" type="text" placeholder="John Smith" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200"
                style={inputBase} onFocus={onFocus} onBlur={onBlur} data-testid="register-name-input" required />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block text-sm font-semibold text-[var(--ink)]">Work Email</label>
              <input id="reg-email" type="email" placeholder="you@company.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200"
                style={inputBase} onFocus={onFocus} onBlur={onBlur} data-testid="register-email-input" required />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="block text-sm font-semibold text-[var(--ink)]">Password</label>
              <div className="relative">
                <input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-xl text-sm outline-none transition-all duration-200"
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} data-testid="register-password-input" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--mist)] hover:text-[var(--ink)] transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {[1,2,3,4].map(n => (
                    <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: strength >= n ? strengthColors[strength] : '#e2e8f0' }} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-role" className="block text-sm font-semibold text-[var(--ink)]">Role</label>
              <select id="reg-role" value={role} onChange={e => setRole(e.target.value)}
                className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 appearance-none"
                style={{ ...inputBase, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} data-testid="register-role-input">
                <option value="agent">Sales Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl text-white font-bold text-sm transition-all duration-200 mt-1 disabled:opacity-60"
              style={{ background: 'var(--pine)', boxShadow: loading ? 'none' : '0 6px 20px rgba(49,63,128,0.35)', cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--pine)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              data-testid="register-submit-btn">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 space-y-2.5">
            {BENEFITS.map((text, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-[var(--mist)]"
                style={{ animation: visible ? `reFadeUp 0.4s ease ${0.3 + i * 0.1}s both` : 'none' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--stone)]">
                  <Check className="w-3 h-3 text-[var(--pine)]" />
                </div>
                {text}
              </div>
            ))}
          </div>

          <p className="mt-7 text-center text-sm text-[var(--mist)]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[var(--pine)] hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Visual Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center bg-[var(--ink)]">
        <HeroWave3D className="pointer-events-none absolute inset-0 opacity-70" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 45% 35%,rgba(109,123,240,0.25) 0%,transparent 55%)' }} />

        <div className="relative z-10 max-w-sm px-10">
          <p className="mk-eyebrow text-[var(--brass-2)]">Get started</p>
          <h2 className="mk-display mt-4 text-[2.4rem] font-semibold leading-[1.1] text-white">
            Put your calls to work.
          </h2>
          <p className="mt-4 text-sm text-white/60">Two products for real-estate teams, one login.</p>

          <div className="mt-9 space-y-3">
            {PRODUCTS.map(({ icon: Icon, name, text }) => (
              <div key={name} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brass)]/20 text-[var(--brass-2)]">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-white/55">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
