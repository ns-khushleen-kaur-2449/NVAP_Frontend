import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** NVIP mark + wordmark. `compact` shows the mark only (collapsed sidebar). */
export default function Logo({ to = '/', className, label = 'NVIP', compact = false }) {
  return (
    <Link
      to={to}
      aria-label={compact ? `${label} home` : undefined}
      className={cn('flex items-center gap-3 font-bold text-lg text-[var(--nv-chrome-fg)]', className)}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--nv-orange)] text-base text-white">N</span>
      {!compact && <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
