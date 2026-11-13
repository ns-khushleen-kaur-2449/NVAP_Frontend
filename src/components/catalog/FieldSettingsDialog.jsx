import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagInput } from '@/components/voice/builder/BuilderFields';
import { getCatalogSettings, setCatalogVisibility, updateCatalogField } from '@/lib/api';
import {
  FIELD_TYPE_OPTIONS, IMPORTANCE, MODE_LABELS, MODES_BY_TYPE, PLAIN_WORD_LANGUAGE, fieldChanges, hasOptions,
  importanceLabel, modeFor, refusalText, takesSynonyms, wordLanguages,
} from '@/lib/catalogFields';

const formFrom = (column) => ({
  label: column.label || '',
  labels: { ...(column.labels || {}) },  // per language; ``label`` is the plain (English) name
  type: column.type,
  matchable: Boolean(column.matchable),
  match_mode: column.match_mode || 'exact',
  allowed_values: [...(column.allowed_values || [])],
  // `meant` stays as stored (a list for several options) until someone edits it.
  synonyms: Object.entries(column.synonyms || {}).map(([said, meant]) => ({ said, meant })),
  aliases: [...(column.aliases || [])],
  ask_lead: Boolean(column.ask_lead),
  agent_visible: column.agent_visible !== false,
  weight: column.weight ?? 2,
});

function Toggle({ id, label, hint, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function Labelled({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const selectClass = 'block h-9 w-full rounded-md border border-border bg-background px-2 text-sm';

/**
 * Every setting of one field, in plain words (PATCH /api/v1/catalog/fields/{key}; "Agent can mention this" is
 * PATCH /visibility). Only what changed is sent. onSaved(data, notes) gets the response, with `agents`.
 */
export default function FieldSettingsDialog({ open, onOpenChange, column, onSaved }) {
  const [form, setForm] = useState(() => formFrom(column || {}));
  const [showLanguages, setShowLanguages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Languages a field name may be given in (GET /api/v1/catalog/settings ``options.language_names``).
  const [languages, setLanguages] = useState([]);
  useEffect(() => {
    if (!open) return;
    Promise.resolve(getCatalogSettings())
      .then((res) => setLanguages(wordLanguages(res?.data).filter((l) => l.code !== PLAIN_WORD_LANGUAGE)))
      .catch(() => setLanguages([]));  // Sales Reps may not read settings: no other-language names then
  }, [open]);
  useEffect(() => {
    if (open && column) {
      setForm(formFrom(column));
      setShowLanguages(Object.values(column.labels || {}).some(Boolean));
      setError('');
    }
  }, [open, column]);
  if (!column) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const modes = MODES_BY_TYPE[form.type] || ['exact'];
  const mode = modeFor(form.type, form.match_mode);
  const options = hasOptions(form.type);
  const weightChoices = IMPORTANCE.some((i) => i.value === Number(form.weight))
    ? IMPORTANCE : [...IMPORTANCE, { value: Number(form.weight), label: importanceLabel(form.weight) }];
  const setSynonym = (index, change) => set('synonyms', form.synonyms.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = fieldChanges(column, form);
      let data = null;
      if (Object.keys(body).length) data = (await updateCatalogField(column.key, body))?.data;
      if (form.agent_visible !== (column.agent_visible !== false)) await setCatalogVisibility(column.key, form.agent_visible);
      onOpenChange(false);
      await onSaved?.(data, data?.note ? [`${data.label}: ${data.note}.`] : []);
    } catch (e) {
      setError(refusalText(e, 'Failed to save the field'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-[640px] w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Field settings: {column.label}</DialogTitle>
          <DialogDescription>How this column is named, what it holds, and how your agent uses it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Labelled label="Name">
            <Input dir="auto" aria-label="Name in English" value={form.label} maxLength={100}
              onChange={(e) => set('label', e.target.value)} />
            <button type="button" className="text-xs text-primary hover:underline" aria-expanded={showLanguages}
              onClick={() => setShowLanguages((s) => !s)}>
              {showLanguages ? 'Hide other languages' : 'Names in other languages'}
            </button>
            {showLanguages && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {languages.map((l) => (
                  <Input key={l.code} dir="auto" aria-label={`Name in ${l.name}`} placeholder={l.name} maxLength={100}
                    value={form.labels[l.code] || ''} onChange={(e) => set('labels', { ...form.labels, [l.code]: e.target.value })} />
                ))}
              </div>
            )}
          </Labelled>

          <Labelled label="Type">
            <select aria-label="Type" value={form.type} className={selectClass}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, match_mode: modeFor(e.target.value, f.match_mode) }))}>
              {FIELD_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Labelled>

          {options && (
            <Labelled label="Allowed options" hint="Every product's value must be one of these. Enter or a comma adds one.">
              <TagInput ariaLabel="Add an option" values={form.allowed_values} placeholder="e.g. navy"
                onChange={(values) => set('allowed_values', values.map((v) => v.trim().toLowerCase()))} />
            </Labelled>
          )}

          <div className="rounded-lg border border-border p-3 space-y-3">
            <Toggle id={`matchable-${column.key}`} label="Agent can filter by this" checked={form.matchable}
              hint="The agent narrows products by what the lead says about it." onChange={(v) => set('matchable', v)} />
            {form.matchable && (
              <>
                <Labelled label="How to match">
                  <select aria-label="How to match" value={mode} className={selectClass} onChange={(e) => set('match_mode', e.target.value)}>
                    {modes.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </Labelled>
                <Labelled label="Importance" hint="Products that match more important fields come first.">
                  <select aria-label="Importance" value={Number(form.weight)} className={selectClass}
                    onChange={(e) => set('weight', Number(e.target.value))}>
                    {weightChoices.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </Labelled>
                {takesSynonyms(form.type) && (
                  <Labelled label="Other words leads use" hint={'For example "poly" means polyester.'}>
                    {form.synonyms.map((s, index) => (
                      <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <Input dir="auto" aria-label={`Word leads use ${index + 1}`} value={s.said} placeholder="e.g. poly"
                          className="sm:w-40" onChange={(e) => setSynonym(index, { said: e.target.value })} />
                        <span className="text-xs text-muted-foreground">means</span>
                        {options ? (
                          <select aria-label={`Means ${index + 1}`} value={Array.isArray(s.meant) ? s.meant[0] || '' : s.meant} className={`${selectClass} sm:flex-1`}
                            onChange={(e) => setSynonym(index, { meant: e.target.value })}>
                            <option value="">Pick an option</option>
                            {[...new Set([...form.allowed_values, ...[].concat(s.meant || [])])].map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <Input dir="auto" aria-label={`Means ${index + 1}`} value={[].concat(s.meant).join(', ')} className="sm:flex-1"
                            onChange={(e) => setSynonym(index, { meant: e.target.value })} />
                        )}
                        <button type="button" aria-label={`Remove word ${index + 1}`}
                          onClick={() => set('synonyms', form.synonyms.filter((_, i) => i !== index))}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => set('synonyms', [...form.synonyms, { said: '', meant: '' }])}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add a word
                    </Button>
                  </Labelled>
                )}
              </>
            )}
            <Toggle id={`ask-${column.key}`} label="Agent asks the lead about this" checked={form.ask_lead}
              hint="Asked before it searches, in the order set under Matching order." onChange={(v) => set('ask_lead', v)} />
            <Toggle id={`visible-${column.key}`} label="Agent can mention this" checked={form.agent_visible}
              hint="Off: the agent still filters by it but never says it." onChange={(v) => set('agent_visible', v)} />
          </div>

          <Labelled label="Other column headers" hint="Names this column may have in an imported file.">
            <TagInput ariaLabel="Add a column header" values={form.aliases} placeholder="e.g. shade"
              onChange={(values) => set('aliases', values.slice(0, 20))} />
          </Labelled>

          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" dir="auto">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.label.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
