import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Light / dark theme. The choice is written to <html data-theme="…"> (which
 * swaps the CSS tokens in index.css) and remembered in localStorage. With no
 * saved choice, it follows the operating system. public/index.html applies the
 * saved theme before React loads, so the page never flashes the wrong theme.
 */
export const THEME_KEY = 'nvip_theme';

const ThemeContext = createContext(null);

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function savedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [saved, setSaved] = useState(savedTheme);
  const [system, setSystem] = useState(systemTheme);
  const theme = saved ?? system;

  // Follow OS changes while the user hasn't picked a theme themselves.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    setSaved(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked — the choice lasts for this visit only */
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
