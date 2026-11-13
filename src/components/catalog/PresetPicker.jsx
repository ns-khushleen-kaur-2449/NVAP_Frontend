import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyCatalogPreset, downloadBlob, downloadCatalogPresetTemplate, getCatalogPresets, getCatalogSettings } from '@/lib/api';
import { FIELD_TYPE_OPTIONS, WORD_LABELS, refusalText, wordText } from '@/lib/catalogFields';

const WORDS = { ...WORD_LABELS, default_category: 'New products’ category' };
const typeLabel = (type) => FIELD_TYPE_OPTIONS.find((t) => t.value === type)?.label || type;

/** What applying `preset` would do here: the fields it adds, those already here, and the words it fills in. */
export function presetPreview(preset, columns, settings) {
  const have = new Set(columns.map((c) => c.key));
  const own = settings?.words || {};
  return {
    adds: preset.fields.filter((f) => !have.has(f.key)),
    kept: preset.fields.filter((f) => have.has(f.key)),
    words: Object.entries(preset.words || {}).filter(([key]) => WORDS[key])
      .map(([key, value]) => ({ key, label: WORDS[key], text: wordText(value), yours: own[key] != null })),
    demo: preset.demo_label ? { text: wordText(preset.demo_label), yours: settings?.demo_label != null } : null,
  };
}

function Kept() {
  return <span className="text-xs text-muted-foreground"> (you have your own; it stays)</span>;
}

/**
 * Start from a preset (GET /api/v1/catalog/presets). Tenant Admins apply one (POST .../apply); Managers only look.
 * Nothing the tenant already has is changed: missing fields are added and unset words filled in.
 */
export default function PresetPicker({ open, onOpenChange, columns, canApply, onApplied }) {
  const [presets, setPresets] = useState(null);
  const [settings, setSettings] = useState(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError('');
    getCatalogPresets().then((r) => {
      const list = r?.data?.presets || [];
      setPresets(list);
      setChosen((c) => c || list[0]?.name || '');
    }).catch((e) => { setPresets([]); setError(refusalText(e, 'Failed to load the presets')); });
    // Only to say which words are already the tenant's own; the preview still works without it.
    getCatalogSettings().then((r) => setSettings(r?.data || null)).catch(() => setSettings(null));
  }, [open]);

  const preset = presets?.find((p) => p.name === chosen);
  const preview = useMemo(() => (preset ? presetPreview(preset, columns, settings) : null), [preset, columns, settings]);

  // Anyone who can open the picker may download a preset's template: its columns plus example products.
  const [downloading, setDownloading] = useState(false);
  const downloadTemplate = async () => {
    if (!preset) return;
    setDownloading(true);
    setError('');
    try {
      const res = await downloadCatalogPresetTemplate(preset.name);
      downloadBlob(res.data, `catalog_template_${preset.name}.csv`);
    } catch (e) {
      setError(refusalText(e, 'Failed to download the template'));
    } finally {
      setDownloading(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await applyCatalogPreset(chosen);
      const added = res?.data?.added || [];
      const labels = added.map((key) => preset.fields.find((f) => f.key === key)?.label || key);
      const note = added.length
        ? `Added ${added.length} field${added.length === 1 ? '' : 's'} from ${preset.label}: ${labels.join(', ')}.`
        : `You already had every field of ${preset.label}; nothing was added.`;
      setResult(note);
      await onApplied?.(res?.data, [note]);
    } catch (e) {
      setError(refusalText(e, 'Failed to apply the preset'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-[640px] w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from a preset</DialogTitle>
          <DialogDescription>
            A ready set of fields and words for a kind of business. Nothing you already have is changed or removed.
          </DialogDescription>
        </DialogHeader>

        {presets === null ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : result ? (
          <p role="status" aria-label="Preset result" className="text-sm">{result}</p>
        ) : (
          <div className="space-y-4 text-sm">
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="sr-only">Preset</legend>
              {presets.map((p) => (
                <label key={p.name} className="flex items-center gap-2">
                  <input type="radio" name="preset" value={p.name} checked={chosen === p.name} onChange={() => setChosen(p.name)} />
                  <span className="capitalize">{p.label}</span>
                </label>
              ))}
            </fieldset>
            {preview && (
              <div className="space-y-3 rounded-lg border border-border p-3" aria-label="What it adds">
                <div>
                  <p className="font-medium">Fields it adds</p>
                  {preview.adds.length ? (
                    <ul className="mt-1 list-disc pl-5">
                      {preview.adds.map((f) => <li key={f.key}>{f.label} <span className="text-xs text-muted-foreground">({typeLabel(f.type)})</span></li>)}
                    </ul>
                  ) : <p className="text-muted-foreground">None: you already have all of them.</p>}
                  {preview.kept.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Already yours, left as they are: {preview.kept.map((f) => f.label).join(', ')}.</p>
                  )}
                </div>
                {preview.words.length > 0 && (
                  <div>
                    <p className="font-medium">Words it fills in</p>
                    <ul className="mt-1 space-y-0.5">
                      {preview.words.map((w) => (
                        <li key={w.key}><span className="text-muted-foreground">{w.label}:</span> <span dir="auto">{w.text}</span>{w.yours && <Kept />}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.demo && (
                  <p><span className="font-medium">The visit is called:</span> <span dir="auto">{preview.demo.text}</span>{preview.demo.yours && <Kept />}</p>
                )}
              </div>
            )}
            {preset && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  A CSV with these columns and two example products. Replace the examples with yours, then use Import CSV.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading} className="shrink-0">
                  {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                  Download template
                </Button>
              </div>
            )}
            {!canApply && <p className="text-xs text-muted-foreground">Only a Tenant Admin can apply a preset.</p>}
          </div>
        )}
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{result || !canApply ? 'Close' : 'Cancel'}</Button>
          {canApply && !result && (
            <Button onClick={apply} disabled={busy || !preset}>{busy ? 'Applying…' : preview?.adds.length ? 'Add these fields' : 'Apply'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
