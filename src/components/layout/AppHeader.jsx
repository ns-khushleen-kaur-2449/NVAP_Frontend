import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import netslogoDark from '@/assets/NTZLOGOnew.png'; // dark bg version
import netslogoLight from '@/assets/NTZ-logo.png'; // light bg version
import { Menu, X, Sun, Moon } from 'lucide-react';

// Mock useTheme as it doesn't exist in frontend
const useTheme = () => ({ isDark: false, toggleTheme: () => {} });

const NAV_LINKS = [
    { label: 'Marketplace', to: '/marketplace' },
    { label: 'Plans', to: '/pricing' },
    { label: 'Home', to: '/dashboard' },
];


const AppHeader = ({ rightContent }) => {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isDark, toggleTheme } = useTheme();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const isActive = (to) => location.pathname === to;

    // ── Color tokens based on mode ───────────────────────
    const navBg = isDark
        ? scrolled ? 'rgba(13,17,23,0.92)' : 'rgba(13,17,23,0.97)'
        : scrolled ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.96)';

    const navBorder = isDark
        ? scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)'
        : scrolled ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(0,0,0,0.04)';

    const navShadow = isDark
        ? scrolled ? '0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.4)' : 'none'
        : scrolled ? '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)' : 'none';

    const inactiveColor = isDark ? '#8b949e' : '#475569';
    const hoverColor = isDark ? '#f0f6fc' : '#0f172a';
    const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

    const drawerBg = isDark ? 'rgba(13,17,23,0.98)' : 'rgba(255,255,255,0.97)';
    const drawerBorder = isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)';
    const drawerDivider = isDark ? 'border-slate-800' : 'border-slate-100';

    const logoSrc = isDark ? netslogoDark : netslogoLight;
    const logoBadgeStyle = undefined;

    return (
        <>
            <nav
                className="sticky top-0 z-50 transition-all duration-300"
                style={{
                    background: navBg,
                    backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px)',
                    WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px)',
                    borderBottom: navBorder,
                    boxShadow: navShadow,
                }}
            >
                <div className="max-w-7xl mx-auto px-5 md:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex flex-1 justify-start">
                            <Link
                                to="/"
                                className="flex items-center gap-2.5 group flex-shrink-0"
                            >
                                <span style={logoBadgeStyle} className="inline-flex items-center">
                                    <img
                                        src={logoSrc}
                                        alt="Netsmartz"
                                        className="w-auto transition-transform duration-200 group-hover:scale-[1.03]"
                                        style={{
                                            height: '150px',
                                            transition: 'all 0.3s ease',
                                            display: 'block',
                                        }}
                                    />
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-1 justify-center shrink-0">
                            {NAV_LINKS.map(({ label, to }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className="relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                                    style={{
                                        color: isActive(to) ? '#F87217' : inactiveColor,
                                        background: isActive(to)
                                            ? 'rgba(248,114,23,0.07)'
                                            : 'transparent',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive(to)) {
                                            e.currentTarget.style.color = hoverColor;
                                            e.currentTarget.style.background = hoverBg;
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive(to)) {
                                            e.currentTarget.style.color = inactiveColor;
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                >
                                    {label}
                                    {isActive(to) && (
                                        <span
                                            className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                                            style={{ background: 'linear-gradient(90deg,#F87217,#FF9A4E)' }}
                                        />
                                    )}
                                </Link>
                            ))}
                        </div>

                        {/* Right Actions */}
                        <div className="flex flex-1 items-center justify-end gap-3">
                            <div className="hidden md:flex items-center gap-2.5">
                                {rightContent}
                            </div>

                            {/* Dark mode toggle */}
                            {/* <button
                                onClick={toggleTheme}
                                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300"
                                style={{
                                    background: isDark
                                        ? 'rgba(248,114,23,0.12)'
                                        : 'rgba(0,0,0,0.05)',
                                    border: isDark
                                        ? '1px solid rgba(248,114,23,0.3)'
                                        : '1px solid rgba(0,0,0,0.08)',
                                    color: isDark ? '#F87217' : '#475569',
                                }}
                            >
                                <span
                                    className="transition-all duration-300"
                                    style={{
                                        transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.8)',
                                        opacity: isDark ? 1 : 0,
                                        position: isDark ? 'relative' : 'absolute',
                                    }}
                                >
                                    <Sun className="w-3.5 h-3.5" />
                                </span>
                                <span
                                    className="transition-all duration-300"
                                    style={{
                                        transform: isDark ? 'rotate(90deg) scale(0.8)' : 'rotate(0deg) scale(1)',
                                        opacity: isDark ? 0 : 1,
                                        position: isDark ? 'absolute' : 'relative',
                                    }}
                                >
                                    <Moon className="w-3.5 h-3.5" />
                                </span>
                                <span className="hidden sm:inline">
                                    {isDark ? 'Light' : 'Dark'}
                                </span>
                            </button> */}

                            {/* Mobile hamburger */}
                            <button
                                className="md:hidden p-2 rounded-lg transition-all duration-200"
                                style={{
                                    color: isDark ? '#8b949e' : '#64748b',
                                    background: 'transparent',
                                }}
                                onClick={() => setMobileOpen(v => !v)}
                                aria-label="Toggle menu"
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                                    e.currentTarget.style.color = isDark ? '#f0f6fc' : '#0f172a';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = isDark ? '#8b949e' : '#64748b';
                                }}
                            >
                                {mobileOpen
                                    ? <X className="w-5 h-5" />
                                    : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Drawer Backdrop */}
            <div
                className="md:hidden fixed inset-0 z-40 transition-all duration-300"
                style={{
                    opacity: mobileOpen ? 1 : 0,
                    pointerEvents: mobileOpen ? 'auto' : 'none',
                }}
                onClick={() => setMobileOpen(false)}
            >
                <div
                    className="absolute inset-0 backdrop-blur-sm"
                    style={{ background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }}
                />
            </div>

            {/* Mobile Drawer Panel */}
            <div
                className="md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 transition-transform duration-300 ease-in-out"
                style={{
                    background: drawerBg,
                    backdropFilter: 'blur(24px)',
                    boxShadow: isDark
                        ? '-8px 0 40px rgba(0,0,0,0.6)'
                        : '-8px 0 40px rgba(0,0,0,0.1)',
                    transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)',
                    borderLeft: drawerBorder,
                }}
            >
                <div className={`flex items-center justify-between px-5 py-4 border-b ${drawerDivider}`}>
                    <Link to="/" onClick={() => setMobileOpen(false)}>
                        <span style={logoBadgeStyle} className="inline-flex items-center">
                            <img
                                src={logoSrc}
                                alt="Netsmartz"
                                className="w-auto"
                                style={{
                                    height: '30px',
                                    transition: 'all 0.3s ease',
                                    display: 'block',
                                }}
                            />
                        </span>
                    </Link>
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-2 rounded-lg transition-colors"
                        style={{
                            color: isDark ? '#8b949e' : '#64748b',
                            background: 'transparent',
                        }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-4 py-4 space-y-1">
                    {NAV_LINKS.map(({ label, to }, i) => (
                        <Link
                            key={to}
                            to={to}
                            className="flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                            style={{
                                color: isActive(to) ? '#F87217' : (isDark ? '#8b949e' : '#475569'),
                                background: isActive(to) ? 'rgba(248,114,23,0.08)' : 'transparent',
                                animationDelay: `${i * 0.05}s`,
                            }}
                        >
                            {label}
                        </Link>
                    ))}
                    {/* Dark mode toggle in mobile drawer */}
                    {/* <button
                        onClick={toggleTheme}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={{
                            color: isDark ? '#F87217' : '#475569',
                            background: isDark ? 'rgba(248,114,23,0.06)' : 'transparent',
                        }}
                    >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {isDark ? 'Switch to Light' : 'Switch to Dark'}
                    </button> */}
                </div>
                <div className={`px-5 pt-2 space-y-2 border-t ${drawerDivider}`}>
                    {rightContent}
                </div>
            </div>
        </>
    );
};

export default AppHeader;
