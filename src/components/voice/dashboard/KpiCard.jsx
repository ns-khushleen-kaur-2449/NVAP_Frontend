import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

const TONE = {
  up: { className: 'text-[var(--vd-good)]', Icon: ArrowUp },
  down: { className: 'text-[var(--vd-bad)]', Icon: ArrowDown },
  flat: { className: 'text-muted-foreground', Icon: Minus },
  none: { className: 'text-muted-foreground', Icon: null },
};

/** One headline number: value, a qualifier, the change vs the previous window, and its definition. */
export default function KpiCard({ title, value, unit, qualifier, delta, footnote, definition }) {
  const tone = TONE[delta?.tone || 'none'];
  const Icon = tone.Icon;
  return (
    <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-w-0" aria-label={title}>
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      <p className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        {qualifier && <span className="text-sm text-muted-foreground">{qualifier}</span>}
      </p>
      {delta && (
        <p className={`text-xs font-medium flex items-center gap-1 ${tone.className}`} title={delta.label}>
          {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
          <span className="sr-only">{delta.label}</span>
          <span aria-hidden="true">{delta.text}</span>
        </p>
      )}
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      <p className="mt-auto pt-2 border-t border-border text-[11px] leading-snug text-muted-foreground">{definition}</p>
    </section>
  );
}
