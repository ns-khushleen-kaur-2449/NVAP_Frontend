import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MAX_DAYS,
  MAX_LIST_VALUES,
  MAX_TEXT_LENGTH,
  dateInputValue,
  newCondition,
  operatorLabel,
  operatorTakesList,
  operatorTakesNoValue,
  operatorTakesRange,
  valueForOperatorChange,
} from '@/components/prospecting/filterUtils';

// How a single value is typed in, by the field type GET /fields reports.
const PLACEHOLDERS = {
  number: 'e.g. 500 or 5k',
  country: 'e.g. IN or India',
  user: 'me, or a user id',
};

/** An owner is a user id (a whole number) or the word "me"; everything else stays text. */
const toFieldValue = (field, text) => (field?.type === 'user' && /^\d+$/.test(text.trim()) ? Number(text.trim()) : text);

const asText = (value) => (value === null || value === undefined ? '' : String(value));

function ScalarInput({ field, value, onChange, label, disabled }) {
  if (field?.type === 'date') {
    // /parse hands back a UTC timestamp. Show the day it means; an edit sends the plain day.
    return (
      <Input type="date" aria-label={label} disabled={disabled}
        value={dateInputValue(value)} onChange={(event) => onChange(event.target.value)} />
    );
  }
  return (
    <Input
      type="text"
      aria-label={label}
      disabled={disabled}
      inputMode={field?.type === 'number' ? 'decimal' : undefined}
      maxLength={MAX_TEXT_LENGTH}
      placeholder={PLACEHOLDERS[field?.type] || 'Value'}
      value={asText(value)}
      onChange={(event) => onChange(toFieldValue(field, event.target.value))}
    />
  );
}

function ChoiceSelect({ value, options, onChange, label, placeholder, disabled }) {
  return (
    <Select value={asText(value)} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** "is any of" / "is none of" for a field with a fixed set of values. */
function ChoiceList({ values, options, onChange, label, disabled }) {
  const toggle = (option, checked) => onChange(checked ? [...values, option] : values.filter((item) => item !== option));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-2 py-1.5">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-1.5 text-sm">
          <Checkbox checked={values.includes(option)} disabled={disabled}
            onCheckedChange={(checked) => toggle(option, checked === true)} />
          {option}
        </label>
      ))}
    </div>
  );
}

/** "is any of" / "is none of" for free values: type one, then Enter or a comma adds it. */
function ValueList({ field, values, onChange, label, disabled }) {
  const [draft, setDraft] = useState('');
  const full = values.length >= MAX_LIST_VALUES;

  const addDraft = (text = draft) => {
    const added = text.split(',').map((part) => part.trim()).filter(Boolean).map((part) => toFieldValue(field, part));
    setDraft('');
    if (added.length === 0) return;
    onChange(Array.from(new Set([...values, ...added])).slice(0, MAX_LIST_VALUES));
  };

  return (
    <div className="space-y-1.5">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: chosen values`}>
          {values.map((item) => (
            <li key={String(item)}>
              <Badge variant="secondary" className="gap-1 font-normal">
                <span className="break-all">{String(item)}</span>
                <button type="button" disabled={disabled} aria-label={`Remove ${item}`}
                  onClick={() => onChange(values.filter((other) => other !== item))}
                  className="rounded-sm hover:text-foreground text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        type="text"
        aria-label={label}
        disabled={disabled || full}
        maxLength={MAX_TEXT_LENGTH}
        placeholder={full ? `Up to ${MAX_LIST_VALUES} values` : `${PLACEHOLDERS[field?.type] || 'Type a value'}, then press Enter`}
        value={draft}
        onChange={(event) => (event.target.value.includes(',') ? addDraft(event.target.value) : setDraft(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); addDraft(); }
        }}
        onBlur={() => addDraft()}
      />
    </div>
  );
}

/** The value control for a condition, chosen from its operator and the field's type. */
function ValueControl({ field, op, value, onChange, disabled }) {
  const label = `${field?.label || 'Condition'} value`;
  const allowedValues = field?.allowed_values || [];

  if (operatorTakesNoValue(op)) return <p className="text-xs text-muted-foreground py-2">No value needed</p>;

  if (op === 'is' || field?.type === 'boolean') {
    return (
      <ChoiceSelect label={label} disabled={disabled} placeholder="Choose"
        value={typeof value === 'boolean' ? String(value) : ''}
        options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
        onChange={(next) => onChange(next === 'true')} />
    );
  }

  if (operatorTakesList(op)) {
    const values = Array.isArray(value) ? value : [];
    return allowedValues.length > 0
      ? <ChoiceList label={label} disabled={disabled} values={values} options={allowedValues} onChange={onChange} />
      : <ValueList label={label} disabled={disabled} field={field} values={values} onChange={onChange} />;
  }

  if (operatorTakesRange(op)) {
    const [low, high] = Array.isArray(value) && value.length === 2 ? value : ['', ''];
    return (
      <div className="flex items-center gap-2">
        <ScalarInput field={field} label={`${label}: from`} disabled={disabled} value={low} onChange={(next) => onChange([next, high])} />
        <span className="text-xs text-muted-foreground shrink-0">and</span>
        <ScalarInput field={field} label={`${label}: to`} disabled={disabled} value={high} onChange={(next) => onChange([low, next])} />
      </div>
    );
  }

  if (op === 'in_last_days') {
    // The backend wants a whole number here, not text.
    return (
      <Input type="number" min={1} max={MAX_DAYS} step={1} inputMode="numeric" aria-label={`${label}: number of days`}
        disabled={disabled} placeholder="Days, e.g. 30" value={asText(value)}
        onChange={(event) => {
          const text = event.target.value;
          onChange(text !== '' && Number.isInteger(Number(text)) ? Number(text) : text);
        }} />
    );
  }

  if (allowedValues.length > 0) {
    return (
      <ChoiceSelect label={label} disabled={disabled} placeholder="Choose a value" value={value}
        options={allowedValues.map((option) => ({ value: option, label: option }))} onChange={onChange} />
    );
  }

  return <ScalarInput field={field} label={label} disabled={disabled} value={value} onChange={onChange} />;
}

/**
 * One editable filter condition: field, operator and value.
 *
 * `fields` is the list from GET /api/ai/filter/fields; it supplies every label,
 * operator and allowed value, so nothing about a field is hardcoded here.
 */
export default function FilterConditionRow({ index, condition, fields, onChange, onRemove, error, disabled }) {
  const field = fields.find((item) => item.key === condition.field);
  const operators = field?.operators || [];
  const position = `Condition ${index + 1}`;

  const changeField = (key) => onChange({ ...condition, ...newCondition(fields.find((item) => item.key === key)) });
  const changeOperator = (op) => onChange({ ...condition, op, value: valueForOperatorChange(condition.op, op, condition.value, field) });

  return (
    <li className="border border-border rounded-lg p-3 bg-card space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-start">
        <ChoiceSelect label={`${position}: field`} disabled={disabled} placeholder="Choose a field" value={field ? condition.field : ''}
          options={fields.map((item) => ({ value: item.key, label: item.label }))} onChange={changeField} />
        <ChoiceSelect label={`${position}: operator`} disabled={disabled || !field} placeholder="Choose an operator"
          value={operators.includes(condition.op) ? condition.op : ''}
          options={operators.map((op) => ({ value: op, label: operatorLabel(op) }))} onChange={changeOperator} />
        <div className="min-w-0">
          {field && <ValueControl field={field} op={condition.op} value={condition.value} disabled={disabled}
            onChange={(value) => onChange({ ...condition, value })} />}
        </div>
        <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={onRemove} aria-label={`Remove ${position.toLowerCase()}`}>
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive break-words" role="alert">{error}</p>}
    </li>
  );
}
