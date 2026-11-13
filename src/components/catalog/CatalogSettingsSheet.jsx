import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { getCatalogPricePreview, getCatalogSettings, getCatalogSettingsHistory, updateCatalogSettings } from '@/lib/api';
import {
  PLAIN_WORD_LANGUAGE, WORD_LABELS, percent, refusalText, wordIn, wordLanguages, wordText, withWord,
} from '@/lib/catalogFields';

const EXAMPLE_PRICE = 1250000;
const FORMATS = { indian: 'Indian (lakh, crore)', international: 'International (thousand, million)' };
// The localized texts the agent says, in the order the form lists them; `setting` ones are their own keys.
const TEXTS = [
  { key: 'label', label: WORD_LABELS.label },
  { key: 'product', label: WORD_LABELS.product },
  { key: 'products', label: WORD_LABELS.products },
  { key: 'visit', label: WORD_LABELS.visit },
  { key: 'demo_label', label: 'The visit is called', setting: true, hint: 'e.g. Test drive, Site visit, Sample' },
  { key: 'stock_unit', label: 'Stock is counted in', setting: true, hint: 'e.g. units, metres' },
  { key: 'default_category', label: 'New products’ category' },
  { key: 'curiosity', label: WORD_LABELS.curiosity },
  { key: 'open_need', label: WORD_LABELS.open_need },
  { key: 'budget', label: WORD_LABELS.budget },
  { key: 'timeline', label: WORD_LABELS.timeline },
  { key: 'react_example', label: WORD_LABELS.react_example },
  { key: 'link_example', label: WORD_LABELS.link_example },
];
const TEXT_LABEL = Object.fromEntries(TEXTS.map((t) => [t.key, t.label]));
const SETTING_LABELS = {
  currency: 'Currency', price_format: 'Price format', budget_tolerance_up: 'Above the budget',
  budget_tolerance_down: 'Below the budget', demo_label: TEXT_LABEL.demo_label, stock_unit: TEXT_LABEL.stock_unit,
  words: 'Words',
};

const formFrom = (s) => ({
  currency: s.currency,
  price_format: s.price_format_set ? s.price_format : '',
  up: String(percent(s.budget_tolerance_up)),
  down: String(percent(s.budget_tolerance_down)),
  demo_label: s.demo_label ?? null,
  // The tenant's own unit only ("units" is the default the API fills in).
  stock_unit: s.overridden?.includes('stock_unit') ? s.stock_unit : null,
  words: { ...(s.words || {}) },
});

const text = (value) => (value == null || value === '' ? 'default' : typeof value === 'object' ? JSON.stringify(value) : String(value));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The PATCH body for what changed, and the same changes in words for the reason dialog. */
export function settingsChanges(settings, form) {
  const before = formFrom(settings);
  const body = {};
  const lines = [];
  if (form.currency !== before.currency) {
    body.currency = form.currency;
    lines.push(`Currency: ${before.currency} → ${form.currency}`);
  }
  if (form.price_format !== before.price_format) {
    body.price_format = form.price_format || null;
    lines.push(`Price format: ${FORMATS[before.price_format] || 'usual for the currency'} → ${FORMATS[form.price_format] || 'usual for the currency'}`);
  }
  for (const [key, field, words] of [['budget_tolerance_up', 'up', 'above'], ['budget_tolerance_down', 'down', 'below']]) {
    if (Number(form[field]) !== Number(before[field])) {
      body[key] = Math.round(Number(form[field]) * 10) / 1000;
      lines.push(`Up to ${before[field]}% ${words} the budget → ${form[field]}%`);
    }
  }
  for (const key of ['demo_label', 'stock_unit']) {
    if (!same(form[key], before[key])) {
      body[key] = form[key];
      lines.push(`${TEXT_LABEL[key]}: ${text(wordText(before[key]))} → ${text(wordText(form[key]))}`);
    }
  }
  const words = {};
  for (const key of new Set([...Object.keys(before.words), ...Object.keys(form.words)])) {
    if (!same(form.words[key], before.words[key])) {
      words[key] = form.words[key] ?? null;
      lines.push(`${TEXT_LABEL[key] || key}: ${text(wordText(before.words[key]))} → ${text(wordText(form.words[key]))}`);
    }
  }
  if (Object.keys(words).length) body.words = words;
  return { body, lines };
}

/** One history row's changes in words ("Currency: INR → AED"). */
export function historyLines(event) {
  const keys = new Set([...Object.keys(event.old || {}), ...Object.keys(event.new || {})]);
  return [...keys].flatMap((key) => {
    const before = event.old?.[key];
    const after = event.new?.[key];
    if (key === 'words') {
      const words = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
      return [...words].filter((w) => !same(before?.[w], after?.[w]))
        .map((w) => `${TEXT_LABEL[w] || w}: ${text(wordText(before?.[w]))} → ${text(wordText(after?.[w]))}`);
    }
    const show = (v) => (key.startsWith('budget_tolerance') && v != null ? `${percent(v)}%` : text(wordText(v)));
    return [`${SETTING_LABELS[key] || key}: ${show(before)} → ${show(after)}`];
  });
}

function Row({ label, hint, children }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const selectClass = 'block h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-70';

/**
 * Catalog settings (GET/PATCH /api/v1/catalog/settings, history from /settings/history). Tenant Admins (and a
 * change them with a reason; Managers only look.
 */
export default function CatalogSettingsSheet({ open, onOpenChange, user, onSaved }) {
  const editable = user?.role === 'tenant_admin';
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [language, setLanguage] = useState(PLAIN_WORD_LANGUAGE);
  const [spoken, setSpoken] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [view, setView] = useState('settings');
  const [history, setHistory] = useState(null);
  const params = undefined;
  const ready = true;

  const load = useCallback(async () => {
    if (!ready) return;
    setLoadError('');
    try {
      const res = await getCatalogSettings(params);
      setSettings(res.data);
      setForm(formFrom(res.data));
    } catch (e) {
      setSettings(null);
      setLoadError(refusalText(e, 'Failed to load the catalog settings'));
    }
  }, [params, ready]);
  useEffect(() => {
    if (open) { setView('settings'); setHistory(null); load(); }
  }, [open, load]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getCatalogSettingsHistory(params);
      setHistory(res.data.events || []);
    } catch (e) {
      setHistory([]);
      setLoadError(refusalText(e, 'Failed to load the history'));
    }
  }, [params]);
  useEffect(() => { if (open && view === 'history') loadHistory(); }, [open, view, loadHistory]);

  // How the agent would say an example price with the form's currency and format (the matcher's own wording).
  useEffect(() => {
    if (!open || !form?.currency) return undefined;
    const timer = setTimeout(() => {
      getCatalogPricePreview({ amount: EXAMPLE_PRICE, currency: form.currency, price_format: form.price_format || undefined, ...params })
        .then((r) => setSpoken(r?.data?.spoken || ''))
        .catch(() => setSpoken(''));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, form?.currency, form?.price_format, params]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setText = (item, value) => setForm((f) => (item.setting
    ? { ...f, [item.key]: withWord(f[item.key], language, value) }
    : { ...f, words: { ...f.words, [item.key]: withWord(f.words[item.key], language, value) } }));
  const changes = settings && form ? settingsChanges(settings, form) : { body: {}, lines: [] };
  const tolerances = form && [form.up, form.down].every((v) => v !== '' && Number(v) >= 0)
    && Number(form.up) <= 500 && Number(form.down) <= 100;

  const save = async (reason) => {
    setSaveError('');
    try {
      const res = await updateCatalogSettings({ ...changes.body, reason }, params);
      setSettings(res.data);
      setForm(formFrom(res.data));
      if (history) loadHistory();
      await onSaved?.(res.data);
      return true;
    } catch (e) {
      setSaveError(refusalText(e, 'Failed to save the catalog settings'));
      return false;
    }
  };

  const tab = (name, label) => (
    <button type="button" aria-pressed={view === name} onClick={() => setView(name)}
      className={`rounded-md px-3 py-1 text-sm ${view === name ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
      {label}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Catalog settings</SheetTitle>
          <SheetDescription>How your agent talks about prices, budgets and your products.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          <div className="flex gap-1">{tab('settings', 'Settings')}{tab('history', 'History')}</div>
          {loadError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

          {view === 'history' ? (
            history === null ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes yet.</p>
            ) : (
              <ol aria-label="Settings history" className="space-y-3">
                {history.map((event) => (
                  <li key={event.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()} · {event.actor_name || 'Unknown user'}
                    </p>
                    <p className="mt-1" dir="auto">“{event.reason}”</p>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {historyLines(event).map((line) => <li key={line} dir="auto">{line}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            )
          ) : !form ? (
            !loadError && <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <fieldset disabled={!editable} className="space-y-5">
              {!editable && <p className="text-xs text-muted-foreground">Only a Tenant Admin can change these.</p>}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Prices</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Row label="Currency">
                    <select aria-label="Currency" value={form.currency} className={selectClass} onChange={(e) => set('currency', e.target.value)}>
                      {(settings.options?.currencies || [form.currency]).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Row>
                  <Row label="Price format">
                    <select aria-label="Price format" value={form.price_format} className={selectClass} onChange={(e) => set('price_format', e.target.value)}>
                      <option value="">Usual for the currency</option>
                      {Object.entries(FORMATS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Row>
                </div>
                {spoken && (
                  <p role="note" aria-label="Spoken price" className="text-xs text-muted-foreground" dir="auto">
                    A price of {EXAMPLE_PRICE.toLocaleString('en-US')} will be spoken as “{spoken}”.
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Budget</h3>
                <p className="text-xs text-muted-foreground">How far a price may be from the lead’s budget and still count as within budget.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Row label="Above the budget (%)">
                    <Input type="number" min={0} max={500} aria-label="Above the budget (%)" value={form.up} onChange={(e) => set('up', e.target.value)} />
                  </Row>
                  <Row label="Below the budget (%)">
                    <Input type="number" min={0} max={100} aria-label="Below the budget (%)" value={form.down} onChange={(e) => set('down', e.target.value)} />
                  </Row>
                </div>
                <p className="text-xs text-muted-foreground">
                  A budget of 100 still counts prices from {Math.max(0, 100 - Number(form.down || 0))} to {100 + Number(form.up || 0)} as within budget.
                </p>
                {!tolerances && <p className="text-xs text-red-600">Use 0 to 500% above and 0 to 100% below.</p>}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Words the agent uses</h3>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Language">
                  {wordLanguages(settings).map((l) => (
                    <button key={l.code} type="button" aria-pressed={language === l.code} onClick={() => setLanguage(l.code)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${language === l.code ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      {l.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === PLAIN_WORD_LANGUAGE ? 'Leave one empty to use the default.'
                    : 'Empty: the agent uses the English word, unless its language needs its own (then saving the agent asks for it).'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TEXTS.map((item) => (
                    <Row key={item.key} label={item.label} hint={item.hint}>
                      <Input dir="auto" aria-label={item.label} maxLength={item.setting ? 60 : 300}
                        value={wordIn(item.setting ? form[item.key] : form.words[item.key], language)}
                        placeholder={language === PLAIN_WORD_LANGUAGE ? '' : wordText(item.setting ? form[item.key] : form.words[item.key])}
                        onChange={(e) => setText(item, e.target.value)} />
                    </Row>
                  ))}
                </div>
              </section>

              {editable && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setForm(formFrom(settings))} disabled={!changes.lines.length}>Reset</Button>
                  <Button type="button" onClick={() => { setSaveError(''); setConfirming(true); }} disabled={!changes.lines.length || !tolerances}>
                    Save
                  </Button>
                </div>
              )}
            </fieldset>
          )}
        </div>
        <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Save catalog settings" changes={changes.lines}
          description="The change and your reason are kept in the History."
          confirmLabel="Save" onConfirm={save}>
          {saveError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}
        </ReasonDialog>
      </SheetContent>
    </Sheet>
  );
}
