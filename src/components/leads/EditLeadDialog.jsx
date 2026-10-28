import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateProspect } from '@/lib/api';

// PATCH /api/v1/prospects/{id}: prospect columns, plus the details the Add Lead form keeps in custom_fields.
// The stage is not edited here (it changes only through POST /{id}/stage, with a reason).
export const COLUMN_FIELDS = [
  { key: 'full_name', label: 'Name', required: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
  { key: 'job_title', label: 'Job title' },
  { key: 'source', label: 'Source' },
];
export const DETAIL_FIELDS = [
  { key: 'project', label: 'Project', wide: true },
  { key: 'category', label: 'Category' },
  { key: 'sub_category', label: 'Sub category' },
  { key: 'budget_min', label: 'Budget min', type: 'number' },
  { key: 'budget_max', label: 'Budget max', type: 'number' },
  { key: 'location_preference', label: 'Location' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'employment', label: 'Employment', wide: true },
];

const text = (value) => (value === null || value === undefined ? '' : String(value));

/** The form's starting values from a lead row (toLeadRow: custom fields spread on top-level keys). */
export function formFor(lead) {
  const custom = lead?.custom_fields || {};
  return Object.fromEntries([
    ...COLUMN_FIELDS.map((f) => [f.key, text(f.key === 'full_name' ? (lead?.full_name ?? lead?.name) : lead?.[f.key])]),
    ...DETAIL_FIELDS.map((f) => [f.key, text(custom[f.key] ?? lead?.[f.key])]),
  ]);
}

/** Only what changed: emptied columns become null; emptied details are cleared (null). */
export function changesFor(before, after) {
  const body = {};
  const custom = {};
  COLUMN_FIELDS.forEach(({ key }) => {
    if (after[key].trim() !== before[key].trim()) body[key] = after[key].trim() || null;
  });
  DETAIL_FIELDS.forEach(({ key, type }) => {
    const value = after[key].trim();
    if (value === before[key].trim()) return;
    custom[key] = value === '' ? null : type === 'number' ? Number(value) : value;
  });
  if (Object.keys(custom).length) body.custom_fields = custom;
  return body;
}

export default function EditLeadDialog({ open, onOpenChange, lead, onSaved }) {
  const [initial, setInitial] = useState(() => formFor(lead));
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return;
    const start = formFor(lead);
    setInitial(start);
    setForm(start);
    setError(null);
  }, [open, lead]);

  const changes = changesFor(initial, form);
  const invalidBudget = DETAIL_FIELDS.some((f) => f.type === 'number' && form[f.key].trim() && Number.isNaN(Number(form[f.key])));
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
      <Input dir="auto" type={f.type === 'email' ? 'email' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined}
        value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        className="mt-1 bg-[hsl(var(--surface-2))] border-border" aria-label={f.label} />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit lead</DialogTitle>
          <DialogDescription>Only the fields you change are saved. Change the stage from the lead's stage controls.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">{COLUMN_FIELDS.map(field)}</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Details</p>
        <div className="grid grid-cols-2 gap-3">{DETAIL_FIELDS.map(field)}</div>
        {invalidBudget && <p className="text-xs text-red-600">Budgets must be numbers.</p>}
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
