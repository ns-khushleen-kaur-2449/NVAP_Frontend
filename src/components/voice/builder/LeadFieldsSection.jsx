import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Contact, Loader2, Search, Settings2, X } from 'lucide-react';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Switch } from '../../ui/switch';
import { FieldMessages, OptionSelect, Section } from './BuilderFields';
import { DEFAULT_LEAD_FIELDS, MASK_LABELS, USAGES, defaultSelection, registryGroups } from '../../../lib/builderPersonalization';

/**
 * Which lead details the agent knows on a call (builder config ``lead_fields``), and how it may use
 * each. ``leadFields`` is the only state: the pickers add and remove entries, the rows edit them.
 * Off means the agent was saved before this existed: its call details and opener stay as they are.
 * Unselected fields are sent to the call blank.
 */

const ROW_CLASS = 'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm outline-none '
  + 'hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-primary/50';

/** A searchable multi-select over one group of fields (standard or custom). */
function FieldPicker({ group, selected, onAdd, onRemove, loading }) {
  const [query, setQuery] = useState('');
  const list = useRef(null);
  const q = query.trim().toLowerCase();
  const shown = q ? group.fields.filter((f) => `${f.label} ${f.key}`.toLowerCase().includes(q)) : group.fields;
  const picked = group.fields.filter((f) => selected.has(f.key));
  const count = `${picked.length} of ${group.fields.length} selected`;
  const empty = !loading && group.fields.length === 0;

  // Arrow keys move between options (and back up to the search box).
  const move = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const options = [...(list.current?.querySelectorAll('[role="option"]') || [])];
    if (!options.length) return;
    e.preventDefault();
    const at = options.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, options.length - 1) : at - 1;
    if (next < 0) e.currentTarget.querySelector('input')?.focus();
    else options[next].focus();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium">{group.title}</p>
        {!empty && !loading && <span className="text-[11px] text-muted-foreground">{count}</span>}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fields…
        </div>
      ) : empty ? (
        <p className="h-9 flex items-center px-3 rounded-md border border-dashed border-border text-xs text-muted-foreground">
          None of your leads have custom fields yet.
        </p>
      ) : (
        <Popover onOpenChange={(open) => !open && setQuery('')}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Choose ${group.title.toLowerCase()}`}
              className="flex items-center justify-between w-full h-9 px-3 rounded-md border border-border bg-muted text-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 data-[state=open]:border-primary/60">
              <span className={picked.length ? '' : 'text-muted-foreground'}>
                {picked.length ? 'Add or remove fields…' : `Choose ${group.title.toLowerCase()}…`}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-[--radix-popover-trigger-width] min-w-[16rem]" onKeyDown={move}>
            <div className="relative border-b border-border">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fields" aria-label={`Search ${group.title}`}
                className="w-full h-9 pl-8 pr-2 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex items-center justify-between px-2 py-1 border-b border-border text-[11px]">
              <button type="button" className="text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                disabled={shown.every((f) => selected.has(f.key))}
                onClick={() => onAdd(shown.filter((f) => !selected.has(f.key)))}>
                {q ? 'Select matching' : 'Select all'}
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={!picked.length} onClick={() => onRemove(picked.map((f) => f.key))}>
                Clear all
              </button>
            </div>
            <div ref={list} role="listbox" aria-multiselectable="true" aria-label={group.title}
              className="max-h-64 overflow-y-auto p-1">
              {shown.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No fields match “{query}”.</p>}
              {shown.map((f) => {
                const on = selected.has(f.key);
                return (
                  <button key={f.key} type="button" role="option" aria-selected={on} className={ROW_CLASS}
                    onClick={() => (on ? onRemove([f.key]) : onAdd([f]))}>
                    <span className={`flex items-center justify-center w-4 h-4 shrink-0 rounded border ${
                      on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {on && <Check className="w-3 h-3" />}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{f.label}</span>
                    <code className="text-[10px] text-muted-foreground truncate max-w-[45%]">{f.key}</code>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={`Selected ${group.title.toLowerCase()}`}>
          {picked.map((f) => (
            <li key={f.key} className="inline-flex items-center gap-1 h-6 pl-2 pr-0.5 rounded-full border border-primary/30 bg-primary/10 text-[11px]">
              {f.label}
              <button type="button" aria-label={`Remove ${f.label}`} onClick={() => onRemove([f.key])}
                className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60">
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One selected field: usage, advanced settings (collapsed by default) and remove. */
function SelectedRow({ field, choice, expanded, onExpand, onSet, onRemove }) {
  const hint = USAGES.find((u) => u.value === choice.usage)?.hint;
  const panel = `lead-field-settings-${field.key}`;
  return (
    <li data-testid={`lead-field-${field.key}`} className="py-2 first:pt-0 last:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{(choice.label || '').trim() || field.label}</p>
          <code className="block text-[10px] text-muted-foreground truncate">{field.key}</code>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-full sm:w-36">
            <OptionSelect
              ariaLabel={`How the agent uses ${field.label}`}
              value={choice.usage}
              onChange={(usage) => onSet({ usage })}
              options={USAGES.map((u) => ({ value: u.value, label: u.label, disabled: !field.usages.includes(u.value) }))}
              className="h-8 bg-muted border-border text-xs"
            />
          </div>
          <button type="button" aria-expanded={expanded} aria-controls={panel} onClick={onExpand}
            aria-label={`Settings for ${field.label}`} title="Settings"
            className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 ${expanded ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
            <Settings2 className="w-4 h-4" />
          </button>
          <button type="button" aria-label={`Remove ${field.label}`} title="Remove" onClick={onRemove}
            className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div id={panel} className="mt-2 grid gap-2 sm:grid-cols-2 rounded-md bg-muted/60 p-2.5 animate-in fade-in-0 slide-in-from-top-1">
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">{hint}</p>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Name in prompt (optional)</span>
            <Input dir="auto" value={choice.label || ''} maxLength={100} placeholder={field.label}
              onChange={(e) => onSet({ label: e.target.value })} aria-label={`Prompt label for ${field.label}`}
              className="h-8 text-xs bg-card border-border" />
          </label>
          {field.masks.length > 1 && (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">What the agent gets</span>
              <OptionSelect
                ariaLabel={`Mask for ${field.label}`}
                value={choice.mask}
                onChange={(mask) => onSet({ mask })}
                options={field.masks.map((m) => ({ value: m, label: MASK_LABELS[m] || m }))}
                className="h-8 bg-card border-border text-xs"
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function LeadFieldsSection({ enabled, onToggle, leadFields, onChange, registry, loading, errors = [] }) {
  const [expanded, setExpanded] = useState(null);  // UI only: which row's settings are open
  const groups = useMemo(() => registryGroups(registry, leadFields), [registry, leadFields]);
  const fieldOf = useMemo(() => new Map(groups.flatMap((g) => g.fields.map((f) => [f.key, f]))), [groups]);
  const selected = new Map(leadFields.map((f) => [f.key, f]));

  const set = (key, patch) => onChange(leadFields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const add = (fields) => onChange([...leadFields, ...fields.filter((f) => !selected.has(f.key)).map(defaultSelection)]);
  const remove = (keys) => {
    if (keys.includes(expanded)) setExpanded(null);
    onChange(leadFields.filter((f) => !keys.includes(f.key)));
  };
  const turn = (on) => {
    onToggle(on);
    if (on && !leadFields.length) onChange(DEFAULT_LEAD_FIELDS);
  };
  // A selected key the registry no longer lists still shows (and can be removed), never dropped silently.
  const fallback = (key) => ({ key, label: key, usages: USAGES.map((u) => u.value), masks: ['none'] });
  const unusable = registry?.unusable || [];

  return (
    <Section
      icon={Contact}
      title="Customer details"
      description="Choose what information your agent can access during calls."
      action={(
        <label className="flex items-center gap-2 text-sm">
          <span className={`text-xs ${enabled ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {enabled ? 'On' : 'Off'}<span className="hidden sm:inline"> · Use on calls</span>
          </span>
          <Switch checked={enabled} onCheckedChange={turn} aria-label="Use customer details on calls" />
        </label>
      )}
    >
      {!enabled ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
          Off: this agent keeps its current opener and call details. Turn it on to greet leads by name and
          choose exactly what the agent may know.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <FieldPicker key={group.id} group={group} selected={selected} onAdd={add} onRemove={remove} loading={loading} />
            ))}
          </div>
          {unusable.length > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{`Can't be used (rename with lowercase letters, digits and underscores): ${unusable.join(', ')}`}</span>
            </p>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium">Selected fields & usage</p>
            {leadFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing selected: the agent knows no lead details on calls.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border px-3 py-2" aria-label="Selected fields">
                {leadFields.map((choice) => (
                  <SelectedRow
                    key={choice.key}
                    field={fieldOf.get(choice.key) || fallback(choice.key)}
                    choice={choice}
                    expanded={expanded === choice.key}
                    onExpand={() => setExpanded((open) => (open === choice.key ? null : choice.key))}
                    onSet={(patch) => set(choice.key, patch)}
                    onRemove={() => remove([choice.key])}
                  />
                ))}
              </ul>
            )}
          </div>
          <FieldMessages errors={errors} />
        </div>
      )}
    </Section>
  );
}
