import React from 'react';
import { Link } from 'react-router-dom';
import netslogo26 from '@/assets/NTZLOGOnew1.png';
import {
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Youtube
} from 'lucide-react';

const FOOTER_LINKS = {
  Company: [
    { label: 'About Netsmartz', to: 'https://netsmartz.com/' },
    { label: 'Contact Us', to: 'https://netsmartz.com/contact-us/' },
    { label: 'Privacy Policy', to: 'https://netsmartz.com/privacy-policy/' },
    { label: 'Terms of Service', to: 'https://netsmartz.com/disclaimer/' },
  ],
};

const TRUST_BADGES = [
  { icon: Shield, label: 'SOC2 Certified' },
  { icon: Globe, label: 'GDPR Ready' },
  { icon: Zap, label: 'HIPAA Compliant' },
];

const SOCIAL_LINKS = [
  {
    icon: Twitter,
    url: 'https://x.com/netsmartztweets',
  },
  {
    icon: Linkedin,
    url: 'https://www.linkedin.com/company/netsmartz/posts/?feedView=all',
  },
  {
    icon: Instagram,
    url: 'https://www.instagram.com/netsmartz_llc/',
  },
  {
    icon: Facebook,
    url: 'https://www.facebook.com/netsmartz',
  },
  {
    icon: Youtube,
    url: 'https://www.youtube.com/user/NetsmartzOnAir',
  },
];

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg,#0a0a0f 0%, #0f172a 100%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(248,114,23,0.12) 0%, transparent 55%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-10">

        {/* Main grid */}
        <div className="py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-block">
              <img src={netslogo26} alt="Netsmartz" className="h-8 w-auto" style={{
                height: '70px',
              }} />
            </Link>

            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Enterprise-grade AI agents for every industry. Deploy, scale,
              and automate.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-400"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Icon className="w-3 h-3 text-[#F87217]" />
                  {label}
                </div>
              ))}
            </div>

            {/* Social links */}
            <div className="flex gap-2 pt-1">
              {SOCIAL_LINKS.map(({ icon: Icon, url }, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition"
                  style={{
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                {group}
              </p>

              <ul className="space-y-2">
                {links.map(({ label, to }) => (
                  <li key={label}>
                    <a
                      href={to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group text-sm text-slate-400 hover:text-white transition-colors duration-200 flex items-center gap-1"
                    >
                      {label}
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="py-4 flex flex-col md:flex-row items-center justify-between gap-2"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-xs text-slate-600">
            © 2026 Netsmartz. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Zap className="w-3 h-3 text-[#F87217]" />

          </div>
        </div>

      </div>
    </footer>
  );
}