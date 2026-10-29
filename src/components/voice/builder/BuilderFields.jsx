import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

// Form primitives shared by the Agent Builder's sections (moved from AssistantBuilder.js).

// Keep a value the backend accepted visible even if this UI doesn't list it.
export const withCurrent = (options, value) =>
  !value || options.some((o) => o.value === value) ? options : [...options, { value, label: value }];

export function Section({ icon: Icon, title, description, action, children }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** options: [{ value, label, disabled? }] */
export function OptionSelect({ value, onChange, options, ariaLabel, disabled, className = 'bg-muted border-border' }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className} aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>
        {withCurrent(options, value).map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Field messages from preview/save: errors in red, warnings in amber. */
export function FieldMessages({ errors = [], warnings = [] }) {
  if (!errors.length && !warnings.length) return null;
  return (
    <ul className="space-y-1">
      {errors.map((m) => <li key={`e-${m}`} role="alert" className="text-[11px] text-red-600">{m}</li>)}
      {warnings.map((m) => <li key={`w-${m}`} className="text-[11px] text-amber-700">{m}</li>)}
    </ul>
  );
}

/** Chips with a text box: Enter or a comma adds, Backspace on an empty box removes the last. */
export function TagInput({ values, onChange, placeholder, suggestions = [], ariaLabel, disabled = false }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const value = raw.trim();
    if (!value || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  const unused = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1.5 min-h-[40px]">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button type="button" aria-label={`Remove ${v}`} disabled={disabled} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          dir="auto"
          aria-label={ariaLabel}
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { add(draft); setDraft(''); }}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none py-1"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
