/**
 * NVIP UI primitives. Small, token-driven building blocks shared by every page
 * (public marketplace, tenant workspace, agent modules). Agent modules should
 * build from these so every agent screen looks like the same product.
 */
import { Link } from 'react-router-dom';
import { Lock, Loader2, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIFECYCLE_META } from '../lib/lifecycle';

/* ---------- Buttons ---------- */

const BUTTON_VARIANTS = {
  primary: 'bg-[var(--nv-orange)] text-white hover:bg-[var(--nv-orange-2)] shadow-sm',
  secondary: 'bg-[var(--nv-surface)] text-[var(--nv-ink)] border border-[var(--nv-line)] hover:bg-[var(--nv-surface-2)]',
  ghost: 'text-[var(--nv-orange-ink)] hover:bg-[var(--nv-orange-soft)]',
  // Outline button for feature panels; follows the theme.
  feature: 'bg-transparent text-[var(--nv-feature-fg)] border border-[var(--nv-feature-border)] hover:bg-[var(--nv-feature-raised)]',
  danger: 'bg-[var(--nv-surface)] text-[var(--nv-danger)] border border-[var(--nv-line)] hover:bg-[var(--nv-danger-bg)]',
};
const BUTTON_SIZES = {
  sm: 'h-8 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

function buttonClass(variant = 'primary', size = 'md', className) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
    'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
  );
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function TextLink({ className, children, ...props }) {
  return (
    <Link className={cn('inline-flex items-center gap-1 font-medium text-[var(--nv-orange-ink)] hover:underline', className)} {...props}>
      {children}
    </Link>
  );
}

/* ---------- Surfaces ---------- */

export function Panel({ className, children, ...props }) {
  return (
    <div className={cn('rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)]', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({ title, action, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-5 pt-5 pb-3', className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[var(--nv-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, children, tone = 'default' }) {
  const attention = tone === 'attention';
  return (
    <div
      className={cn(
        'rounded-2xl p-5 min-h-[120px]',
        attention
          ? 'bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]'
          : 'bg-[var(--nv-surface)] border border-[var(--nv-line)]',
      )}
    >
      <div className={cn('text-sm font-semibold', attention ? '' : 'text-[var(--nv-muted)]')}>{label}</div>
      {value !== undefined && <div className="mt-2 text-4xl font-bold tabular-nums">{value}</div>}
      {children}
    </div>
  );
}

export function Meter({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full rounded-full bg-[var(--nv-orange-soft)] overflow-hidden"
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
    >
      <div className="h-full rounded-full bg-[var(--nv-orange)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Badges & chips ---------- */

const TONES = {
  success: 'bg-[var(--nv-success-bg)] text-[var(--nv-success)]',
  warning: 'bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]',
  danger: 'bg-[var(--nv-danger-bg)] text-[var(--nv-danger)]',
  info: 'bg-[var(--nv-info-bg)] text-[var(--nv-info)]',
  neutral: 'bg-[var(--nv-neutral-bg)] text-[var(--nv-muted)]',
};

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function LifecycleBadge({ state }) {
  const meta = LIFECYCLE_META[state] || { label: state || 'Unknown', tone: 'neutral' };
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
}

/** Guardrails are fixed by design — shown locked so admins see what they can't change (doc §29.7). */
export function GuardrailChips({ guardrails = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {guardrails.map((g) => (
        <span key={g} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nv-line)] bg-[var(--nv-surface-2)] px-2 py-1 text-xs font-medium text-[var(--nv-muted)]">
          <Lock className="h-3 w-3" aria-hidden /> {g}
        </span>
      ))}
    </div>
  );
}

export function AgentTile({ agent, solid = false, size = 'md' }) {
  if (!agent) return null;
  const Icon = agent.icon;
  const box = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-12 w-12 rounded-xl';
  return (
    <div className={cn(
      'grid place-items-center shrink-0', box,
      solid ? 'bg-[var(--nv-orange)] text-white' : 'bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]',
    )}>
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden />
    </div>
  );
}

/* ---------- Async states ---------- */

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[var(--nv-muted)]" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center" role="alert">
      <CircleAlert className="h-6 w-6 text-[var(--nv-danger)]" aria-hidden />
      <p className="text-[var(--nv-muted)]">{message || 'Could not load this data.'}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 px-6 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-md text-sm text-[var(--nv-muted)]">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Wraps the loading / error / ready switch every data page repeats. */
export function AsyncBoundary({ query, children, loadingLabel }) {
  if (query.loading && !query.data) return <LoadingState label={loadingLabel} />;
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />;
  return children(query.data);
}
