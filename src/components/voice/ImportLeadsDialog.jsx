import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { importLeads, previewLeadImport } from '@/lib/api';

// The uses a column can have (backend prospects/csv_import.py).
export const LEAD_USES = [
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'phone', label: 'Phone number (required)' },
  { value: 'email', label: 'Email' },
  { value: 'job_title', label: 'Job title' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'source', label: 'Lead source' },
  { value: 'stage', label: 'SDR stage' },
  { value: 'detail', label: 'Keep as a lead detail' },
  { value: 'ignore', label: 'Don’t import' },
];
// SmartSDR's stages (prospects.current_status), in pipeline order.
export const STAGE_OPTIONS = [
  { value: 'NEW', label: 'New' }, { value: 'CONTACTED', label: 'Contacted' }, { value: 'ENGAGED', label: 'Engaged' },
  { value: 'MEETING', label: 'Meeting' }, { value: 'QUALIFIED', label: 'Qualified' }, { value: 'CONVERTED', label: 'Converted' },
  { value: 'DISQUALIFIED', label: 'Disqualified' }, { value: 'DO_NOT_CONTACT', label: 'Do not contact' },
];
const stageLabel = (value) => STAGE_OPTIONS.find((s) => s.value === value)?.label || value;

/** The suggested stage for each value of a column (from the preview), as { value: STAGE }. */
export const suggestedStages = (column) =>
  Object.fromEntries((column?.values || []).map((v) => [v.value, v.suggested_stage]));

const SINGLE = new Set(LEAD_USES.map((u) => u.value).filter((u) => u !== 'detail' && u !== 'ignore'));
const NAME_USES = ['full_name', 'first_name', 'last_name'];

/** What stops this mapping being imported (empty when it can be). `columns` are the preview's. */
export function leadMappingProblems(mapping, columns = []) {
  const uses = Object.values(mapping);
  const problems = [];
  const stageColumn = columns.find((c) => mapping[c.column] === 'stage');
  if (stageColumn && !stageColumn.values) {
    problems.push(`${stageColumn.column} has too many different values to be the SDR stage; keep it as a lead detail.`);
  }
  if (!uses.includes('phone')) problems.push('Choose the column with the phone number.');
  if (!uses.some((u) => NAME_USES.includes(u))) problems.push('Choose the column with the name (full name, or first/last name).');
  const byUse = {};
  Object.entries(mapping).forEach(([column, use]) => { if (SINGLE.has(use)) (byUse[use] = byUse[use] || []).push(column); });
  Object.entries(byUse).forEach(([use, columns]) => {
    if (columns.length > 1) problems.push(`${columns.join(' and ')} are all set to “${LEAD_USES.find((u) => u.value === use).label}”; choose one.`);
  });
  return problems;
}

const errorText = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

/**
 * Import leads from a CSV: choose a file, say what each column is, import. Each row becomes a lead you own
 * (stage New), ready to tick and launch. `onImported(result)` gets { created, prospect_ids, ... }.
 */
export default function ImportLeadsDialog({ open, onOpenChange, onImported }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  // For the column mapped to "SDR stage": each of its values -> one of SmartSDR's stages.
  const [stageValues, setStageValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFile(null); setPreview(null); setMapping({}); setStageValues({}); setError(''); setResult(null);
  }, [open]);

  const choose = async (chosen) => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await previewLeadImport(chosen);
      setFile(chosen);
      setPreview(data);
      setMapping(Object.fromEntries((data?.columns || []).map((c) => [c.column, c.suggested])));
      setStageValues(suggestedStages((data?.columns || []).find((c) => c.suggested === 'stage')));
    } catch (e) {
      setError(errorText(e, 'Could not read that file.'));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const stageColumn = preview.columns.find((c) => mapping[c.column] === 'stage');
      const { data } = await importLeads(file, mapping, stageColumn ? stageValues : undefined);
      setResult(data);
      await onImported?.(data);
    } catch (e) {
      setError(errorText(e, 'Could not import the leads.'));
    } finally {
      setBusy(false);
    }
  };

  const problems = preview && !result ? leadMappingProblems(mapping, preview.columns) : [];
  const setUse = (column, use) => {
    setMapping((current) => {
      // Only one column is the stage: choosing another one moves it.
      const next = use === 'stage'
        ? Object.fromEntries(Object.entries(current).map(([c, u]) => [c, u === 'stage' ? 'detail' : u]))
        : { ...current };
      return { ...next, [column.column]: use };
    });
    if (use === 'stage') setStageValues(suggestedStages(column));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-[720px] w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV with one person per row. Each row becomes a lead you own, ready to add to a campaign.
            A name and a phone number are required.
          </DialogDescription>
        </DialogHeader>

        <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" aria-label="Leads CSV file"
          onChange={(e) => choose(e.target.files?.[0])} />

        {result ? (
          <div role="status" aria-label="Lead import result" className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
              {result.created.toLocaleString()} lead{result.created === 1 ? '' : 's'} added
              {result.created > 0 ? ' and ticked in the list' : ''}.
            </p>
            {Object.keys(result.stages || {}).length > 0 && (
              <p className="text-muted-foreground">
                By stage: {STAGE_OPTIONS.filter((s) => result.stages[s.value]).map((s) => `${s.label} ${result.stages[s.value]}`).join(', ')}.
              </p>
            )}
            {result.skipped_existing > 0 && <p>{result.skipped_existing} skipped: a lead with that phone number already exists.</p>}
            {result.skipped_duplicate_in_file > 0 && <p>{result.skipped_duplicate_in_file} skipped: the number appears earlier in the file.</p>}
            {result.rejected > 0 && (
              <div>
                <p>{result.rejected} not imported:</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {result.errors.slice(0, 10).map((e) => <li key={e.row}>Row {e.row}: {e.reason}</li>)}
                  {result.errors.length > 10 && <li>and {result.errors.length - 10} more</li>}
                </ul>
              </div>
            )}
          </div>
        ) : !preview ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Columns such as Name, Phone, Email and City are recognised; you can change any of them next.</p>
            <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} Choose CSV file
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{file?.name}: {preview.row_count.toLocaleString()} rows. Tell us what each column holds.</p>
            <div className="divide-y divide-border rounded-lg border border-border" role="list" aria-label="Columns">
              {preview.columns.map((c) => (
                <div key={c.column} role="listitem" className="p-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words" dir="auto">{c.column}</p>
                    <p className="text-xs text-muted-foreground truncate" dir="auto">{c.samples.length ? `e.g. ${c.samples.join(', ')}` : 'Empty in this file'}</p>
                  </div>
                  <Select value={mapping[c.column] || 'ignore'} onValueChange={(use) => setUse(c, use)} disabled={busy}>
                    <SelectTrigger className="w-full sm:w-56 shrink-0" aria-label={`Use of column ${c.column}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_USES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {mapping[c.column] === 'stage' && c.values && (
                  <div className="rounded-md bg-muted/40 p-2 space-y-1.5" aria-label={`Stages for ${c.column}`}>
                    <p className="text-xs text-muted-foreground">Match each {c.column} in your file to a SmartSDR stage. Empty cells start at New.</p>
                    {c.values.map((v) => (
                      <div key={v.value} className="flex items-center justify-between gap-2">
                        <span className="text-sm min-w-0 truncate" dir="auto">{v.value} <span className="text-xs text-muted-foreground">({v.count})</span></span>
                        <Select value={stageValues[v.value] || 'NEW'} onValueChange={(stage) => setStageValues((s) => ({ ...s, [v.value]: stage }))} disabled={busy}>
                          <SelectTrigger className="w-44 h-8 shrink-0" aria-label={`Stage for ${v.value}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {Object.values(stageValues).includes('DO_NOT_CONTACT') && (
                      <p className="text-xs text-muted-foreground">Leads at “{stageLabel('DO_NOT_CONTACT')}” are never called by campaigns.</p>
                    )}
                  </div>
                )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Lead details (like budget or the product they want) are kept on the lead, and your agent can use them on the call.
              Each stage change is recorded on the lead with the value from your file. A number SmartSDR already has is skipped, never merged.
            </p>
            {problems.length > 0 && (
              <ul className="space-y-0.5 text-sm text-red-700" aria-label="Fix before importing">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{result ? 'Done' : 'Cancel'}</Button>
          {preview && !result && (
            <Button onClick={submit} disabled={busy || problems.length > 0} className="bg-[#F87217] hover:bg-[#C2560E] text-white">
              {busy ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing…</> : `Import ${preview.row_count.toLocaleString()} rows`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
