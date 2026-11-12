import { useId } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-lg border border-[var(--nv-line)] bg-[var(--nv-surface)] px-3 h-11 text-[var(--nv-ink)] ' +
  'placeholder:text-[var(--nv-muted)]/70 focus:border-[var(--nv-orange)] focus:outline-none focus:ring-2 focus:ring-[var(--nv-orange)]/25';

/** Labelled form control. `as` = 'input' | 'select' | 'textarea'. */
export default function Field({ label, hint, as: Tag = 'input', className, children, ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <Tag id={id} className={cn(control, Tag === 'textarea' && 'h-auto min-h-[110px] py-2.5')} {...props}>
        {children}
      </Tag>
      {hint && <p className="mt-1 text-xs text-[var(--nv-muted)]">{hint}</p>}
    </div>
  );
}
