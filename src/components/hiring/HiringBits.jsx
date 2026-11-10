import { useId } from 'react';
import { ErrorState } from '@/components/ops/States';
import OpsButton from '@/components/ops/OpsButton';
import { errorMessage } from '@/hooks/useApiAction';
import { isForbidden } from '@/lib/hiring';

export const NOT_AVAILABLE = 'Hiring is not available to your organisation';

/** Text inputs and selects on the Hiring screens. */
export const CONTROL = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground';

/** A labelled control: `children(id)` renders it with that id. */
export function Field({ label, required = false, hint, children }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return <p role="alert" className="text-sm text-[color:var(--ops-bad)]">{children}</p>;
}

/** A failed load. A 403 says why (Hiring not available, or no permission) and offers no retry. */
export function HiringError({ error, onRetry }) {
  if (isForbidden(error)) return <ErrorState title={errorMessage(error, NOT_AVAILABLE)} />;
  return <ErrorState message={errorMessage(error, 'Try again in a moment.')} onRetry={onRetry} />;
}

/** Below a list: "Show more" while the backend may have more, or a note once its 200-row cap is reached. */
export function ListFooter({ count, limit, max, onMore, what }) {
  if (count < limit) return null;
  if (limit >= max) {
    return <p className="text-xs text-muted-foreground">Showing the first {max} {what}. Narrow the list to see others.</p>;
  }
  return <OpsButton size="sm" onClick={onMore}>Show more</OpsButton>;
}
