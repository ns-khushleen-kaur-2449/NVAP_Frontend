import { Skeleton as BaseSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }) {
  return <BaseSkeleton className={cn('rounded-[14px]', className)} {...props} />;
}

/** Placeholder rows while a list loads. */
export function SkeletonRows({ rows = 5, label = 'Loading' }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="ops-card border-dashed px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'This could not be loaded.', message, onRetry }) {
  return (
    <div role="alert" className="ops-card ops-border-bad flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
      <p className="flex-1 text-foreground">
        <span className="font-semibold">{title}</span>
        {message ? <span className="text-muted-foreground"> {message}</span> : null}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="rounded-lg bg-[var(--ops-accent)] px-3 py-1.5 font-semibold text-white hover:bg-[var(--ops-accent-hover)]">
          Try again
        </button>
      )}
    </div>
  );
}

/** Shown where the UI needs data the backend does not provide yet. */
export function NotAvailable({ what }) {
  return (
    <p className="ops-card px-4 py-3 text-sm text-muted-foreground">
      {what} is not available yet.
    </p>
  );
}

/** A table that scrolls sideways inside its own box on narrow screens. */
export function ScrollTable({ children, label }) {
  return (
    <div className="ops-card overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[720px] text-sm">{children}</table>
    </div>
  );
}
