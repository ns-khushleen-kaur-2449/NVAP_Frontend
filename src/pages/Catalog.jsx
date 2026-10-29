import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Eye, EyeOff, LayoutTemplate, ListOrdered, Loader2, Package, Plus, Search, Settings2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { canEditCatalog } from '@/lib/rbac';
import CatalogBrochures, { CompanyBrochure } from '@/components/catalog/CatalogBrochures';
import { BrochureControl } from '@/components/admin/brochureControls';
import ChangeNotice from '@/components/catalog/ChangeNotice';
import ImportReport from '@/components/catalog/ImportReport';
import FieldMenu from '@/components/catalog/FieldMenu';
import FieldSettingsDialog from '@/components/catalog/FieldSettingsDialog';
import MatchingOrderSheet from '@/components/catalog/MatchingOrderSheet';
import PresetPicker from '@/components/catalog/PresetPicker';
import CatalogSettingsSheet from '@/components/catalog/CatalogSettingsSheet';
import { matchingNote } from '@/lib/catalogFields';
import {
  addCatalogField, addCatalogItem, deleteCatalogField, getCatalogTable, importCatalog, renameCatalogField,
  setCatalogVisibility, updateCatalogField, updateCatalogItem, uploadCatalogItemBrochure,
} from '@/lib/api';

// GET /api/v1/catalog/table. Column kinds: fixed (name, category, price), matching (the agent filters on
// them; options for fixed choices) and custom (the tenant's own fields, sent to the agent as facts).
// Each column says whether the agent sees it (agent_visible) and whether that can change (locked).
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'yes_no', label: 'Yes / No' },
];
const CORE_KEYS = ['name', 'category', 'price'];

export const errorText = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => (typeof d === 'string' ? d : d.msg)).join('; ');
  return fallback;
};

/** Where a column's value lives on a row, and the PATCH body that changes it. */
export function cellValue(row, column) {
  if (CORE_KEYS.includes(column.key)) return row[column.key];
  return column.custom ? row.extra?.[column.key] : row.attrs?.[column.key];
}
export function changeFor(column, value) {
  if (CORE_KEYS.includes(column.key)) return { [column.key]: value };
  return { [column.custom ? 'extra' : 'attrs']: { [column.key]: value === '' ? null : value } };
}

const shown = (value, column) => {
  if (value === undefined || value === null || value === '') return '—';
  if (column.type === 'price') return `₹${Number(value).toLocaleString('en-IN')}`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

/** One editable cell: click to edit, Enter or leaving the cell saves, Escape cancels. */
function Cell({ row, column, editable, onSave }) {
  const value = cellValue(row, column);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const start = () => {
    if (!editable) return;
    setDraft(value === undefined || value === null ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value));
    setEditing(true);
  };
  const save = async () => {
    const before = value === undefined || value === null ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
    if (draft === before) { setEditing(false); return; }
    setSaving(true);
    const ok = await onSave(row, column, draft);
    setSaving(false);
    if (ok) setEditing(false);
  };
  const keys = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') setEditing(false);
  };
  const label = `${column.label} of ${row.name}`;
  if (!editing) {
    return (
      <td className={`px-3 py-2 align-top whitespace-nowrap ${editable ? 'cursor-text hover:bg-muted/60' : ''}`}
        onClick={start} title={editable ? 'Click to edit' : undefined}>
        <span dir="auto">{shown(value, column)}</span>
      </td>
    );
  }
  const options = column.options || (column.type === 'yes_no' || column.type === 'bool' ? ['yes', 'no'] : null);
  return (
    <td className="px-1 py-1 align-top">
      {options ? (
        <select autoFocus aria-label={label} value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)}
          onBlur={save} onKeyDown={keys} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input autoFocus dir="auto" aria-label={label} value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)}
          onBlur={save} onKeyDown={keys} className="h-8 min-w-[120px] text-sm"
          inputMode={['number', 'int', 'float', 'price'].includes(column.type) ? 'decimal' : undefined} />
      )}
    </td>
  );
}

function AddProductDialog({ open, onOpenChange, onAdded }) {
  const [form, setForm] = useState({ name: '', price: '', category: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm({ name: '', price: '', category: '' }); setError(''); } }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      // Price is optional: a tenant may not share prices (the agent then never quotes one).
      await addCatalogItem({ name: form.name.trim(), price: form.price.trim() || null, category: form.category.trim() || null });
      toast.success('Product added');
      onOpenChange(false);
      await onAdded();
    } catch (e) {
      setError(errorText(e, 'Failed to add the product'));
    } finally {
      setBusy(false);
    }
  };
  const field = (key, label, placeholder) => (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <Input dir="auto" aria-label={label} value={form[key]} placeholder={placeholder} className="mt-1"
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>Fill in the rest of its columns in the table afterwards.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {field('name', 'Name', 'e.g. Tata Punch EV')}
          {field('price', 'Price (₹, optional)', 'e.g. 1100000 or 11 lakh; leave empty to not share it')}
          {field('category', 'Category', 'e.g. suv')}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.name.trim()}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add a field, or rename one (``field`` set). */
function FieldDialog({ open, onOpenChange, field, onSaved }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setLabel(field?.label || ''); setType(field?.type || 'text'); setError(''); } }, [open, field]);
  const save = async () => {
    setBusy(true);
    try {
      const res = field ? await renameCatalogField(field.key, label.trim()) : await addCatalogField({ label: label.trim(), type });
      toast.success(field ? 'Field renamed' : 'Field added');
      onOpenChange(false);
      await onSaved(res?.data);
    } catch (e) {
      setError(errorText(e, 'Failed to save the field'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{field ? 'Rename field' : 'Add field'}</DialogTitle>
          <DialogDescription>
            Your own column, like Mileage or Warranty. The agent can tell leads these facts when it suggests a product.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Name
            <Input dir="auto" aria-label="Field name" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Mileage" className="mt-1" />
          </label>
          {!field && (
            <label className="block text-xs font-medium text-muted-foreground">
              Type
              <select aria-label="Field type" value={type} onChange={(e) => setType(e.target.value)}
                className="mt-1 block h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !label.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the agent sees of a column: a toggle for editors where it may change, else a plain icon. */
export function AgentToggle({ label, column, editable, onToggle }) {
  const visible = column.agent_visible;
  const Icon = visible ? Eye : EyeOff;
  const tone = visible ? 'text-primary' : 'text-muted-foreground';
  if (column.locked || !editable) {
    const title = column.locked
      ? (visible ? 'The agent always sees this' : 'Not sent to the agent')
      : (visible ? 'The agent sees this' : 'Hidden from the agent');
    return <span title={title} aria-label={`${label}: ${title.toLowerCase()}`}><Icon className={`w-3 h-3 ${tone}`} /></span>;
  }
  const action = visible ? `Hide ${label} from the agent` : `Show ${label} to the agent`;
  return (
    <button type="button" aria-label={action} title={action} aria-pressed={visible} onClick={() => onToggle(!visible)}>
      <Icon className={`w-3 h-3 ${tone}`} />
    </button>
  );
}

/** A CSV with the current columns and no rows, so the import starts from the right headers. */
export function templateCsv(columns) {
  const headers = ['source_row_id', ...columns.map((c) => (c.custom ? c.label : c.key)), 'location', 'units', 'test_drive_available'];
  return `${headers.map((h) => (/[",]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h)).join(',')}\n`;
}

export default function CatalogPage() {
  const { user } = useAuth();
  const editable = canEditCatalog(user);
  // A Super Admin has no tenant: the table needs one, the settings let them pick it.
  const superAdmin = user?.role === 'super_admin';
  const settingsViewer = superAdmin || editable;
  // Brochures follow the /api/v1/scheduling rules: Tenant Admins upload, Managers view, Sales Reps don't see them.
  const showBrochures = editable;
  const brochureAdmin = user?.role === 'tenant_admin';
  const [brochureVersion, setBrochureVersion] = useState(0);
  const [data, setData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [inactive, setInactive] = useState(false);
  // Matching columns and stock that none of the tenant's products uses (car columns for a textile shop).
  const [showUnused, setShowUnused] = useState(false);
  const [report, setReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fieldDialog, setFieldDialog] = useState({ open: false, field: null });
  // What the last field or settings change did (notes, and `agents` from the response).
  const [change, setChange] = useState(null);
  const [settingsKey, setSettingsKey] = useState(null);
  const settingsColumn = data.columns.find((c) => c.key === settingsKey) || null;
  const [ordering, setOrdering] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    if (superAdmin) { setLoading(false); return; }
    try {
      const res = await getCatalogTable(inactive ? { include_inactive: true } : {});
      setData(res?.data || { columns: [], rows: [] });
    } catch (e) {
      toast.error(errorText(e, 'Failed to load the catalog'));
    } finally {
      setLoading(false);
    }
  }, [inactive, superAdmin]);
  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => (showUnused ? data.columns
    : data.columns.filter((c) => !(c.matching && c.in_use === false))), [data.columns, showUnused]);
  const unusedCount = data.columns.filter((c) => c.matching && c.in_use === false).length
    + (data.stock?.in_use === false ? 1 : 0);
  const showStock = showUnused || data.stock?.in_use !== false;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.rows.filter((r) => `${r.name} ${r.category}`.toLowerCase().includes(q)) : data.rows;
  }, [data.rows, query]);

  const save = async (row, column, value) => {
    try {
      const res = await updateCatalogItem(row.id, changeFor(column, value));
      setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === row.id ? res.data : r)) }));
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Failed to save'));
      return false;
    }
  };

  const setActive = async (row, active) => {
    if (!active && !window.confirm(`Deactivate "${row.name}"? The agent stops offering it.`)) return;
    try {
      await updateCatalogItem(row.id, { active });
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Failed to update the product'));
    }
  };

  const setVisibility = async (key, label, visible) => {
    try {
      await setCatalogVisibility(key, visible);
      toast.success(visible ? `The agent now sees ${label}` : `${label} is hidden from the agent`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Failed to change what the agent sees'));
    }
  };

  /** After a change: show its notes and what it means for the agents, then reload the table. */
  const changed = async (data, notes = []) => {
    setChange(data?.agents || notes.some(Boolean) ? { notes, agents: data?.agents } : null);
    await load();
  };

  const toggleMatching = async (column) => {
    const on = !column.matchable;
    try {
      const res = await updateCatalogField(column.key, { matchable: on });
      toast.success(on ? `The agent can now filter by ${column.label}` : `The agent no longer filters by ${column.label}`);
      await changed(res?.data, [on ? matchingNote(column, res?.data || {}) : null]);
    } catch (e) {
      toast.error(errorText(e, 'Failed to change matching'));
    }
  };

  const removeField = async (column) => {
    if (!window.confirm(`Remove the field "${column.label}"? Its values are deleted from every product.`)) return;
    try {
      const res = await deleteCatalogField(column.key);
      toast.success('Field removed');
      await changed(res?.data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to remove the field'));
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await importCatalog(file);
      setReport(res.data);
      toast.success('Catalog imported');
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Failed to import the catalog'));
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv(columns)], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'catalog-template.csv' });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The products your voice agents can suggest. Prices, stock and details come only from here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settingsViewer && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="w-4 h-4 mr-1" /> Catalog settings
            </Button>
          )}
          {!superAdmin && (
            <Button variant="outline" size="sm" onClick={() => setOrdering(true)} disabled={!data.columns.length}>
              <ListOrdered className="w-4 h-4 mr-1" /> Matching order
            </Button>
          )}
        {editable && (
          <>
            {/* Tenant Admins apply a preset; Managers see what one holds. */}
            <Button variant="outline" size="sm" onClick={() => setPresetsOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-1" /> Presets
            </Button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" aria-label="Catalog CSV file"
              onChange={(e) => upload(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={!data.columns.length}>
              <Download className="w-4 h-4 mr-1" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Import CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFieldDialog({ open: true, field: null })}>
              <Plus className="w-4 h-4 mr-1" /> Add field
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" /> Add product</Button>
          </>
        )}
        </div>
      </div>

      {report && <ImportReport report={report} onFieldSettings={setSettingsKey} />}

      {change && <ChangeNotice notes={change.notes} agents={change.agents} onDismiss={() => setChange(null)} />}

      {showBrochures && <CompanyBrochure canEdit={brochureAdmin} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="pl-8 h-8 text-sm"
            aria-label="Search products" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Show inactive
        </label>
        {unusedCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground"
            title="Columns none of your products has a value in, such as the agent's car matching columns">
            <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} />
            Show unused columns ({unusedCount})
          </label>
        )}
        <span className="text-xs text-muted-foreground">{rows.length} product{rows.length === 1 ? '' : 's'}</span>
      </div>

      {superAdmin ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Products belong to a tenant. Open Catalog settings to pick a tenant and view or change its settings.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : data.rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          No products yet. {editable ? 'Import a CSV or add a product.' : 'Ask a Tenant Admin or Manager to add them.'}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Eye className="w-3 h-3 text-primary" /> the agent can see and share it
          <EyeOff className="w-3 h-3 ml-2" /> hidden from the agent: it is never told this (a hidden price still filters by budget).
          {editable ? ' Click the eye on a column to change it.' : ''}
        </p>
      )}
      {!superAdmin && !loading && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm" aria-label="Catalog">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <span className={c.agent_visible ? '' : 'line-through decoration-muted-foreground/60'}>{c.label}</span>
                      <AgentToggle label={c.label} column={c} editable={editable}
                        onToggle={(visible) => setVisibility(c.key, c.label, visible)} />
                      {c.matching && <Badge variant="outline" className="text-[10px] px-1 py-0" title="The agent can filter by this">match</Badge>}
                      {/* Every field has the menu, matched on or not; name, category and price are fixed. */}
                      {!CORE_KEYS.includes(c.key) && editable && (
                        <FieldMenu column={c} onToggleMatching={toggleMatching} onRemove={removeField}
                          onSettings={(field) => setSettingsKey(field.key)}
                          onRename={(field) => setFieldDialog({ open: true, field })} />
                      )}
                    </span>
                  </th>
                ))}
                {showStock && <th scope="col" className="px-3 py-2 text-left font-medium">
                  <span className="inline-flex items-center gap-1">
                    <span className={data.stock?.agent_visible === false ? 'line-through decoration-muted-foreground/60' : ''}>Stock</span>
                    {data.stock && (
                      <AgentToggle label="Stock" column={data.stock} editable={editable}
                        onToggle={(visible) => setVisibility('stock', 'Stock', visible)} />
                    )}
                  </span>
                </th>}
                {showBrochures && <th scope="col" className="px-3 py-2 text-left font-medium">Brochure</th>}
                <th scope="col" className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} data-testid={`catalog-row-${row.id}`} className={row.active ? '' : 'opacity-60'}>
                  {columns.map((c) => <Cell key={c.key} row={row} column={c} editable={editable} onSave={save} />)}
                  {showStock && (
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {row.stock?.length ? row.stock.map((s) => `${s.location}: ${s.units}`).join(', ') : '—'}
                    </td>
                  )}
                  {showBrochures && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <BrochureControl productId={row.brochure_product_id} brochure={row.brochure} canEdit={brochureAdmin}
                        inputLabel={`Brochure for ${row.name}`} fallbackNote="Uses the company brochure"
                        removeNote="Leads asking for it will get the company brochure."
                        onUpload={(file) => uploadCatalogItemBrochure(row.id, file)}
                        onChanged={async () => { await load(); setBrochureVersion((v) => v + 1); }} />
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {editable ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setActive(row, !row.active)}>
                        {row.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : (
                      <span className="text-xs">{row.active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBrochures && <CatalogBrochures key={brochureVersion} canEdit={brochureAdmin} />}

      <FieldSettingsDialog open={Boolean(settingsColumn)} column={settingsColumn} onSaved={changed}
        onOpenChange={(open) => { if (!open) setSettingsKey(null); }} />
      <MatchingOrderSheet open={ordering} onOpenChange={setOrdering} columns={data.columns} editable={editable}
        onSaved={changed} />
      <PresetPicker open={presetsOpen} onOpenChange={setPresetsOpen} columns={data.columns} canApply={user?.role === 'tenant_admin'}
        onApplied={changed} />
      {settingsViewer && (
        <CatalogSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} user={user} onSaved={(res) => changed(res)} />
      )}
      <AddProductDialog open={adding} onOpenChange={setAdding} onAdded={load} />
      <FieldDialog open={fieldDialog.open} field={fieldDialog.field} onSaved={(data) => changed(data)}
        onOpenChange={(open) => setFieldDialog((s) => ({ ...s, open }))} />
    </div>
  );
}
