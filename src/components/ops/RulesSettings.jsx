import { useCallback, useEffect, useMemo, useState } from 'react';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import ReasonDialog from './ReasonDialog';
import RelativeTime from './RelativeTime';
import OpsButton from './OpsButton';
import { ErrorState, SkeletonRows } from './States';

/** Problems with the values, from each field's bounds as the backend sends them ({ key: message }). */
export function ruleErrors(values, fields) {
  const errors = {};
  Object.entries(fields || {}).forEach(([key, meta]) => {
    if (meta.type !== 'integer') return;
    const v = values[key];
    if (!Number.isInteger(v)) errors[key] = 'Enter a whole number.';
    else if (meta.min != null && v < meta.min) errors[key] = `At least ${meta.min}.`;
    else if (meta.max != null && v > meta.max) errors[key] = `At most ${meta.max}.`;
  });
  return errors;
}

const show = (v) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v ?? '—'));

/**
 * One tenant settings block (contact rules, appointment rules): fields, bounds and one-line
 * explanations all come from the API (`rules`, `defaults`, `fields`). Saving needs a reason and
 * shows what changes; the history lists every change. `groups` arranges the keys under headings.
 */
export default function RulesSettings({ title, intro, load, save, loadHistory, editable, groups, scopeKey }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await load();
      setData(res.data);
      setValues(res.data.rules);
      setError(null);
      if (loadHistory) setHistory((await loadHistory()).data.events);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, [load, loadHistory]);
  useEffect(() => { setData(null); fetchAll(); }, [fetchAll, scopeKey]);

  const fields = useMemo(() => data?.fields || {}, [data]);
  const errors = useMemo(() => ruleErrors(values, fields), [values, fields]);
  const changes = useMemo(() => Object.keys(values).filter((k) => data && values[k] !== data.rules[k])
    .map((k) => `${fields[k]?.title || k}: ${show(data.rules[k])} → ${show(values[k])}`), [values, data, fields]);
  const { run } = useApiAction((reason) => save({ ...values, reason }), { success: `${title} saved`, onSuccess: fetchAll, onConflict: fetchAll });

  const keys = Object.keys(fields);
  const sections = groups ? groups.map((g) => ({ ...g, keys: keys.filter(g.match) })).filter((g) => g.keys.length)
    : [{ title: null, keys }];
  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="ops ops-card space-y-4 p-5" aria-labelledby={`rules-${title}`}>
      <div>
        <h2 id={`rules-${title}`} className="text-sm font-semibold">{title}</h2>
        {intro && <p className="text-xs text-muted-foreground">{intro}</p>}
        {!editable && data && <p className="mt-1 text-xs text-muted-foreground">View only.</p>}
      </div>
      {error && <ErrorState message={error} onRetry={fetchAll} />}
      {!error && !data && <SkeletonRows rows={3} label={`Loading ${title}`} />}
      {data && sections.map((section) => (
        <fieldset key={section.title || 'all'} className="space-y-3">
          {section.title && <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</legend>}
          <div className="grid gap-4 sm:grid-cols-2">
            {section.keys.map((key) => {
              const meta = fields[key];
              const id = `rule-${key}`;
              if (meta.type === 'boolean') {
                return (
                  <div key={key} className="flex items-start gap-3 sm:col-span-2">
                    <input id={id} type="checkbox" checked={Boolean(values[key])} disabled={!editable}
                      onChange={(e) => set(key, e.target.checked)} className="mt-1 h-4 w-4" aria-describedby={`${id}-help`} />
                    <div>
                      <label htmlFor={id} className="text-sm font-medium">{meta.title}</label>
                      <p id={`${id}-help`} className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={key} className="space-y-1">
                  <label htmlFor={id} className="text-sm font-medium">{meta.title}</label>
                  <input id={id} type="number" min={meta.min ?? undefined} max={meta.max ?? undefined} value={values[key] ?? ''}
                    disabled={!editable} onChange={(e) => set(key, e.target.value === '' ? '' : Number(e.target.value))}
                    aria-invalid={Boolean(errors[key])} aria-describedby={`${id}-help`}
                    className="ops-num h-9 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-70" />
                  <p id={`${id}-help`} className="text-xs text-muted-foreground">
                    {meta.description} {meta.min != null && meta.max != null ? `(${meta.min}–${meta.max}; default ${data.defaults[key]})` : ''}
                  </p>
                  {errors[key] && <p className="text-xs font-semibold text-[color:var(--ops-bad)]">{errors[key]}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {data && editable && (
        <div className="flex flex-wrap items-center gap-3">
          <OpsButton variant="primary" disabled={!changes.length || Object.keys(errors).length > 0} onClick={() => setConfirming(true)}>Save</OpsButton>
          <OpsButton variant="quiet" disabled={!changes.length} onClick={() => setValues(data.rules)}>Undo changes</OpsButton>
        </div>
      )}
      {history && (
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Change history ({history.length})</summary>
          {history.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No changes yet.</p> : (
            <ul className="divide-y divide-border">
              {history.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <RelativeTime iso={e.created_at} mode="absolute" className="text-xs text-muted-foreground" />
                  <p>“{e.reason}”</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.keys({ ...(e.old_value || {}), ...(e.new_value || {}) }).map((k) =>
                      `${fields[k]?.title || k}: ${show((e.old_value || {})[k] ?? 'default')} → ${show((e.new_value || {})[k] ?? 'default')}`).join(' · ') || 'Back to the defaults'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title={`Save ${title.toLowerCase()}`} changes={changes}
        confirmLabel="Save" onConfirm={async (reason) => Boolean(await run(reason))} />
    </section>
  );
}
