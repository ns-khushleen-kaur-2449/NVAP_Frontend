import { cn } from '@/lib/utils';
import { USD_TO_INR } from './billingUi';

// Drawn inline: flag emoji do not render on Windows.
function FlagUS() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-[3px]" aria-hidden="true">
      <rect width="24" height="16" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(i * 16) / 13} width="24" height={16 / 13} fill="#b22234" />)}
      <rect width="10" height="8.6" fill="#3c3b6e" />
    </svg>
  );
}

function FlagIN() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-[3px]" aria-hidden="true">
      <rect width="24" height="5.34" fill="#ff9933" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <rect y="10.66" width="24" height="5.34" fill="#138808" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="#000080" strokeWidth="0.6" />
    </svg>
  );
}

const OPTIONS = [
  { value: 'usd', label: 'USD', Flag: FlagUS },
  { value: 'inr', label: 'INR', Flag: FlagIN },
];

/** Switches the prices on the plan cards between US dollars and Indian rupees (display only; billing stays in USD). */
export default function CurrencyToggle({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Currency" className="inline-flex rounded-lg border border-border p-0.5 text-sm">
        {OPTIONS.map(({ value: v, label, Flag }) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={cn('inline-flex items-center gap-2 rounded-md px-3 py-1 font-semibold transition-colors',
              value === v ? 'bg-[var(--ops-accent)] text-white' : 'text-muted-foreground hover:text-foreground')}>
            <Flag /> {label}
          </button>
        ))}
      </div>
      {value === 'inr' && <span className="text-xs text-muted-foreground">1 USD ≈ ₹{USD_TO_INR}. You are charged in USD.</span>}
    </div>
  );
}
