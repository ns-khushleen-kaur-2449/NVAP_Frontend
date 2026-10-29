import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { orderCatalogFields } from '@/lib/api';
import { fieldColumns, refusalText } from '@/lib/catalogFields';
import ReorderList from './ReorderList';

const item = (c) => ({ key: c.key, label: c.label });
const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

/** The two orders as the table's columns hold them: questions by ask_order, relaxing by relax_priority. */
export function ordersFrom(columns) {
  const fields = fieldColumns(columns);
  const asked = fields.filter((c) => c.ask_lead).sort((a, b) => (a.ask_order == null) - (b.ask_order == null)
    || (a.ask_order ?? 0) - (b.ask_order ?? 0) || byPosition(a, b));
  const matchable = fields.filter((c) => c.matchable);
  const relax = matchable.filter((c) => c.relax_priority != null)
    .sort((a, b) => a.relax_priority - b.relax_priority || byPosition(a, b));
  const never = matchable.filter((c) => c.relax_priority == null).sort(byPosition);
  return { ask: asked.map(item), relax: relax.map(item), never: never.map(item) };
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** "Matching order": the questions' order and the relax order, saved together (PUT /api/v1/catalog/fields/order). */
export default function MatchingOrderSheet({ open, onOpenChange, columns, editable, onSaved }) {
  const [orders, setOrders] = useState(() => ordersFrom(columns));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setOrders(ordersFrom(columns)); setError(''); } }, [open, columns]);

  const set = (key, value) => setOrders((o) => ({ ...o, [key]: value }));
  const toNever = (field) => setOrders((o) => ({ ...o, relax: o.relax.filter((f) => f.key !== field.key), never: [...o.never, field] }));
  const toRelax = (field) => setOrders((o) => ({ ...o, never: o.never.filter((f) => f.key !== field.key), relax: [...o.relax, field] }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const keys = (list) => list.map((f) => f.key);
      const res = await orderCatalogFields({ ask_order: keys(orders.ask), relax_order: keys(orders.relax), never_relax: keys(orders.never) });
      onOpenChange(false);
      await onSaved?.(res?.data);
    } catch (e) {
      setError(refusalText(e, 'Failed to save the order'));
    } finally {
      setBusy(false);
    }
  };

  const small = 'text-xs text-primary hover:underline whitespace-nowrap';
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Matching order</SheetTitle>
          <SheetDescription>What the agent asks first, and what it drops first when no product fits.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <Section title="Questions the agent asks, in order"
            hint={editable ? 'Drag, or use the arrows. Turn asking on or off in a field’s settings.' : null}>
            <ReorderList label="Questions the agent asks" items={orders.ask} editable={editable}
              onChange={(list) => set('ask', list)} empty="The agent asks about no field. Turn it on in a field’s settings." />
          </Section>
          <Section title="If nothing matches, relax in this order" hint="The first one is dropped first.">
            <ReorderList label="Relax in this order" items={orders.relax} editable={editable}
              onChange={(list) => set('relax', list)} empty="No field is dropped when nothing matches."
              action={(field) => (
                <button type="button" className={small} aria-label={`Always require ${field.label}`} onClick={() => toNever(field)}>
                  Always required
                </button>
              )} />
          </Section>
          <Section title="Always required (never dropped)">
            {orders.never.length ? (
              <ul aria-label="Always required" className="space-y-1">
                {orders.never.map((field) => (
                  <li key={field.key} className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-sm">
                    <span className="flex-1 truncate" dir="auto">{field.label}</span>
                    {editable && (
                      <button type="button" className={small} aria-label={`Allow dropping ${field.label}`} onClick={() => toRelax(field)}>
                        Allow dropping
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground px-1">None.</p>}
          </Section>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{editable ? 'Cancel' : 'Close'}</Button>
            {editable && <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save order'}</Button>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
