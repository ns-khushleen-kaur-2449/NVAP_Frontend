import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary: 'bg-[var(--ops-accent)] text-white hover:bg-[var(--ops-accent-hover)] border border-transparent',
  outline: 'border border-border bg-card text-[color:var(--ops-accent-ink)] hover:bg-[hsl(var(--surface-2))]',
  quiet: 'border border-transparent text-foreground hover:bg-[hsl(var(--surface-2))]',
  danger: 'bg-[var(--ops-bad)] text-white hover:opacity-90 border border-transparent',
};

/** The operations screens' button: a real <button>, visible focus, disabled while busy. */
const OpsButton = forwardRef(function OpsButton(
  { variant = 'outline', size = 'md', className, type = 'button', busy = false, disabled, children, ...props }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || busy} aria-busy={busy || undefined}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm', VARIANTS[variant], className)}
      {...props}>
      {children}
    </button>
  );
});

export default OpsButton;
