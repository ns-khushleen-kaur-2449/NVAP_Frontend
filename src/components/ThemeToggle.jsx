import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '../context/ThemeContext';

/** Light/dark switch, styled with the chrome tokens so it fits the sidebar and top bar in both themes. */
export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--nv-chrome-border)]',
        'text-[var(--nv-chrome-muted)] transition-colors hover:bg-[var(--nv-chrome-hover)] hover:text-[var(--nv-chrome-fg)]',
        className,
      )}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
