import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Package, Pencil, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { createProduct, getAppointmentRules, listProducts, updateAppointmentRules, updateProduct } from '@/lib/api';
import { BrochureControl, DescriptionEditor, errorList } from './brochureControls';

const NO_SENDER = 'none';
const MAX_ALIASES = 20;

/** Add or edit a product: its name and the other ways people say it. */
function ProductDialog({ open, onOpenChange, product, onSaved }) {
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  useEffect(() => {
    if (!open) return;
    setName(product?.name || '');
    setAliases(product?.aliases || []);
    setDraft('');
    setErrors([]);
  }, [open, product]);

  const addAlias = () => {
    const value = draft.trim();
    if (value && aliases.length < MAX_ALIASES && !aliases.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setAliases([...aliases, value]);
    }
    setDraft('');
  };
  const save = async () => {
    const all = draft.trim() ? [...aliases, draft.trim()] : aliases;
    setBusy(true);
    try {
      if (product) await updateProduct(product.id, { name: name.trim(), aliases: all });
      else await createProduct({ name: name.trim(), aliases: all });
      toast.success(product ? 'Product saved' : 'Product added');
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      setErrors(errorList(e, 'Failed to save the product'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
          <DialogDescription>
            What leads ask for a brochure about. Aliases are other ways people say it; the agent matches them exactly,
            and close spellings too.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Name
            <Input dir="auto" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nexon EV"
              className="mt-1" aria-label="Product name" />
          </label>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Aliases</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {aliases.map((a) => (
                <Badge key={a} variant="secondary" className="gap-1 pr-1">
                  <span dir="auto">{a}</span>
                  <button type="button" aria-label={`Remove alias ${a}`} onClick={() => setAliases(aliases.filter((x) => x !== a))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input dir="auto" value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} aria-label="New alias"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
              placeholder="e.g. Nexon electric (press Enter)" className="mt-1.5" />
          </div>
          {errors.map((m) => <p key={m} role="alert" className="text-xs text-red-600">{m}</p>)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who brochure emails go from when the lead's owner has no connected mailbox (appointment rule). */
function SenderPicker({ candidates, canEdit }) {
  const [rules, setRules] = useState(null);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    getAppointmentRules().then((res) => setRules(res?.data?.rules || null)).catch(() => setRules(null));
  }, []);
  if (!rules) return null;
  const connected = candidates.filter((c) => c.calendar_connected);
  const current = rules.brochure_sender_user_id ? String(rules.brochure_sender_user_id) : NO_SENDER;
  const save = async (reason) => {
    try {
      const res = await updateAppointmentRules({ ...rules, brochure_sender_user_id: pending === NO_SENDER ? null : Number(pending), reason });
      setRules(res.data.rules);
      toast.success('Brochure sender saved');
      return true;
    } catch (e) {
      toast.error(errorList(e, 'Failed to save the sender')[0]);
      return false;
    }
  };
  const label = (value) => (value === NO_SENDER ? 'Nobody (no email; the team is told)'
    : connected.find((c) => String(c.user_id) === value)?.name || `User ${value}`);
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-muted-foreground">Sent from the lead owner's mailbox, else:</span>
      <div className="w-64">
        <Select value={current} onValueChange={setPending} disabled={!canEdit}>
          <SelectTrigger className="h-8 text-xs" aria-label="Brochure sender"><SelectValue>{label(current)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SENDER}>{label(NO_SENDER)}</SelectItem>
            {connected.map((c) => <SelectItem key={c.user_id} value={String(c.user_id)}>{c.name} ({c.email})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ReasonDialog open={pending !== null && pending !== current} onOpenChange={(open) => !open && setPending(null)}
        title="Change the brochure sender" changes={[`Brochure emails will go from: ${label(pending || current)}`]}
        confirmLabel="Save" onConfirm={async (reason) => { const ok = await save(reason); if (ok) setPending(null); return ok; }} />
    </div>
  );
}

/**
 * Products leads can ask for a brochure about, each with its own brochure (else the company brochure goes),
 * and who sends them. Saving a product re-publishes the agents that use send_brochure.
 */
export default function BrochureProducts({ canEdit, candidates = [] }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await listProducts();
      setProducts(res?.data || []);
    } catch (e) {
      toast.error(errorList(e, 'Failed to load products')[0]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setActive = async (product, active) => {
    if (!active && !window.confirm(`Deactivate "${product.name}"? Leads asking for it get the company brochure.`)) return;
    setBusy(product.id);
    try {
      await updateProduct(product.id, { is_active: active });
      toast.success(active ? 'Product reactivated' : 'Product deactivated');
      await load();
    } catch (e) {
      toast.error(errorList(e, 'Failed to update the product')[0]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-2" aria-labelledby="brochure-products">
      <div className="flex items-center justify-between">
        <h3 id="brochure-products" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Products and brochures
        </h3>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: null })}>
            <Plus className="w-4 h-4 mr-1" /> Add product
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        When a lead asks for a brochure on a call, the agent emails the brochure for the product they name; if it has
        none, or the name isn't clear, the company brochure goes instead. Agents that send brochures are updated with
        this list whenever it changes.
      </p>
      <SenderPicker candidates={candidates} canEdit={canEdit} />
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-5 text-center">
          No products yet: every brochure request gets the company brochure.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border" role="list" aria-label="Products">
          {products.map((p) => (
            <div key={p.id} role="listitem" className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span dir="auto" className="text-sm font-medium">{p.name}</span>
                  {p.aliases.map((a) => <Badge key={a} variant="secondary" className="text-[11px]" dir="auto">{a}</Badge>)}
                  {!p.is_active && <Badge variant="outline" className="text-[11px]">Inactive</Badge>}
                </div>
                <BrochureControl productId={p.id} brochure={p.brochure} canEdit={canEdit} onChanged={load}
                  fallbackNote="No brochure: leads asking for it get the company brochure"
                  removeNote="Leads asking for it will get the company brochure." />
                <DescriptionEditor brochure={p.brochure} canEdit={canEdit} onChanged={load} />
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" aria-label={`Edit ${p.name}`}
                    onClick={() => setDialog({ open: true, item: p })}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8" disabled={busy === p.id} onClick={() => setActive(p, !p.is_active)}>
                    {p.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ProductDialog open={dialog.open} product={dialog.item} onSaved={load}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} />
    </section>
  );
}
