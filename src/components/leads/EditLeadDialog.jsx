import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateProspect } from '@/lib/api';
import { DETAIL_FIELDS, detailFieldsFor } from '@/lib/leadDetails';
import { DEPARTMENTS } from '@/lib/prospects';

export { DETAIL_FIELDS };

// PATCH /api/v1/prospects/{id}: prospect columns, plus the details the Add Lead form keeps in custom_fields.
// The stage is not edited here (it changes only through POST /{id}/stage, with a reason).
export const COLUMN_FIELDS = [
  { key: 'full_name', label: 'Name', required: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
  { key: 'job_title', label: 'Job title' },
  // Empty: the backend reads it from the job title.  Chosen here, a title change never replaces it.
  { key: 'department', label: 'Department', options: DEPARTMENTS },
  { key: 'source', label: 'Source' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
];

const text = (value) => (value === null || value === undefined ? '' : String(value));

/**
 * The form's starting values from a lead row (toLeadRow: custom fields spread on top-level keys).
 * `details` are the lead's detail fields (detailFieldsFor): the Add Lead ones plus every other detail it has.
 */
export function formFor(lead, details = detailFieldsFor(lead)) {
  const custom = lead?.custom_fields || {};
  return Object.fromEntries([
    ...COLUMN_FIELDS.map((f) => [f.key, text(f.key === 'full_name' ? (lead?.full_name ?? lead?.name) : lead?.[f.key])]),
    ...details.map((f) => [f.key, text(custom[f.key] ?? lead?.[f.key])]),
  ]);
}

/** Only what changed: emptied columns become null; emptied details are cleared (null). */
export function changesFor(before, after, details = DETAIL_FIELDS) {
  const body = {};
  const custom = {};
  COLUMN_FIELDS.forEach(({ key }) => {
    if (after[key].trim() !== before[key].trim()) body[key] = after[key].trim() || null;
  });
  details.forEach(({ key, type }) => {
    const value = (after[key] ?? '').trim();
    if (before[key] === undefined) return;
    if (value === before[key].trim()) return;
    custom[key] = value === '' ? null : type === 'number' ? Number(value) : value;
  });
  if (Object.keys(custom).length) body.custom_fields = custom;
  return body;
}

export default function EditLeadDialog({ open, onOpenChange, lead, onSaved }) {
  const [details, setDetails] = useState(() => detailFieldsFor(lead));
  const [initial, setInitial] = useState(() => formFor(lead, details));
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return;
    const fields = detailFieldsFor(lead);
    const start = formFor(lead, fields);
    setDetails(fields);
    setInitial(start);
    setForm(start);
    setError(null);
  }, [open, lead]);

  const changes = changesFor(initial, form, details);
  const invalidBudget = details.some((f) => f.type === 'number' && form[f.key].trim() && Number.isNaN(Number(form[f.key])));
  const canSave = form.full_name.trim() && Object.keys(changes).length > 0 && !invalidBudget;

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateProspect(lead.id, changes);
      toast.success('Lead updated');
      onOpenChange(false);
      await onSaved(res.data);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map((d) => d.msg || String(d)).join('; ') : 'Failed to update the lead');
    } finally {
      setSaving(false);
    }
  };

  const field = (f) => (
    <label key={f.key} className={`block text-xs font-medium text-muted-foreground ${f.wide ? 'col-span-2' : ''}`}>
      {f.label}{f.required ? ' *' : ''}
      {f.options ? (
        <select value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-label={f.label}
          className="mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm text-foreground">
          <option value="">From job title</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input dir="auto" type={f.type === 'email' ? 'email' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined}
          value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
          className="mt-1 bg-[hsl(var(--surface-2))] border-border" aria-label={f.label} />
      )}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit lead</DialogTitle>
          <DialogDescription>Only the fields you change are saved. Change the stage from the lead's stage controls.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">{COLUMN_FIELDS.map(field)}</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Details</p>
        <div className="grid grid-cols-2 gap-3">{details.map(field)}</div>
        {invalidBudget && <p className="text-xs text-red-600">Number fields must be numbers.</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!canSave || saving} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
