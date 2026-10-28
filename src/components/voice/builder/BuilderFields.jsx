import React from 'react';
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
