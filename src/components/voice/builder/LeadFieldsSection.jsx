import React from 'react';
import { Contact, Loader2 } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { FieldMessages, OptionSelect, Section } from './BuilderFields';
import { DEFAULT_LEAD_FIELDS, MASK_LABELS, USAGES, defaultSelection, registryGroups } from '../../../lib/builderPersonalization';

/**
 * Which lead details the agent knows on a call (builder config ``lead_fields``), and how it may use
 * each. Off means the agent was saved before this existed: its call details and opener stay as they
 * are. Unticked fields are sent to the call blank.
 */
export default function LeadFieldsSection({ enabled, onToggle, leadFields, onChange, registry, loading, errors = [] }) {
  const selected = new Map(leadFields.map((f) => [f.key, f]));
  const set = (key, patch) => onChange(leadFields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const toggle = (field, on) => onChange(on
    ? [...leadFields, defaultSelection(field)]
    : leadFields.filter((f) => f.key !== field.key));
  const turn = (on) => {
    onToggle(on);
    if (on && !leadFields.length) onChange(DEFAULT_LEAD_FIELDS);
  };

  return (
    <Section
      icon={Contact}
      title="Customer details"
      description="What the agent may know about each lead, and how it may use it. Unticked details never reach the call."
      action={(
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={turn} aria-label="Use customer details on calls" />
          <span className="hidden sm:inline">Use on calls</span>
        </label>
      )}
    >
      {!enabled ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-3">
          Off: this agent keeps its current opener and call details. Turn it on to greet leads by name and
          choose exactly what the agent may know.
        </p>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-4 py-3">
            {USAGES.map((u) => (
              <div key={u.value} className="flex gap-1.5 text-[11px]">
                <dt className="font-medium shrink-0">{u.label}:</dt>
                <dd className="text-muted-foreground">{u.hint}</dd>
              </div>
            ))}
          </dl>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading fields…
            </div>
          ) : registryGroups(registry, leadFields).map((group) => (
            <div key={group.id} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">{group.title}</p>
              {group.fields.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">None of your leads have custom fields yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border" aria-label={group.title}>
                  {group.fields.map((field) => {
                    const choice = selected.get(field.key);
                    return (
                      <li key={field.key} data-testid={`lead-field-${field.key}`} className="px-3 py-2 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-2 min-w-[180px] flex-1 cursor-pointer">
                            <Checkbox checked={Boolean(choice)} onCheckedChange={(on) => toggle(field, Boolean(on))}
                              aria-label={`Include ${field.label}`} />
                            <span className="text-sm">{field.label}</span>
                            <code className="text-[10px] text-muted-foreground">{field.key}</code>
                          </label>
                          {choice && (
                            <div className="flex items-center gap-2">
                              <div className="w-36">
                                <OptionSelect
                                  ariaLabel={`How the agent uses ${field.label}`}
                                  value={choice.usage}
                                  onChange={(usage) => set(field.key, { usage })}
                                  options={USAGES.map((u) => ({ value: u.value, label: u.label, disabled: !field.usages.includes(u.value) }))}
                                  className="h-8 bg-muted border-border text-xs"
                                />
                              </div>
                              {field.masks.length > 1 && (
                                <div className="w-44">
                                  <OptionSelect
                                    ariaLabel={`Mask for ${field.label}`}
                                    value={choice.mask}
                                    onChange={(mask) => set(field.key, { mask })}
                                    options={field.masks.map((m) => ({ value: m, label: MASK_LABELS[m] || m }))}
                                    className="h-8 bg-muted border-border text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {choice && (
                          <Input
                            dir="auto"
                            value={choice.label || ''}
                            maxLength={100}
                            onChange={(e) => set(field.key, { label: e.target.value })}
                            placeholder={`What the prompt calls it (default: ${field.label})`}
                            aria-label={`Prompt label for ${field.label}`}
                            className="h-8 text-xs bg-muted border-border"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
          {(registry?.unusable || []).length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Not selectable (use lowercase letters, digits and underscores in custom field names): {registry.unusable.join(', ')}
            </p>
          )}
          <FieldMessages errors={errors} />
        </div>
      )}
    </Section>
  );
}
