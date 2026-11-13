import { useEffect, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getShareTargets, shareProspects } from '@/lib/api';
import { describeApiError } from '@/components/prospecting/filterUtils';

const ROLE_LABEL = { manager: 'Manager', rep: 'Sales Rep' };

/**
 * Share the ticked prospects with chosen people on your team. Those people can then see
 * them in Prospecting and Leads and put them in their own campaigns.
 *
 * The list comes from the backend (a Tenant Admin gets the tenant's Managers and Sales Reps,
 * a Manager their own Sales Reps), and it checks everything again on share.
 */
export default function ShareProspectsDialog({ open, onOpenChange, prospectIds, onShared }) {
  const [targets, setTargets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [chosen, setChosen] = useState(() => new Set());
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setChosen(new Set());
    setLoadError(null);
    getShareTargets()
      .then(({ data }) => { if (live) setTargets(data?.users || []); })
      .catch((error) => { if (live) { setTargets([]); setLoadError(describeApiError(error, 'Could not load your team.')); } });
    return () => { live = false; };
  }, [open]);

  const toggle = (id) => setChosen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChosen = targets?.length > 0 && targets.every((t) => chosen.has(t.user_id));
  const count = prospectIds.length;

  const submit = async () => {
    if (chosen.size === 0 || sharing) return;
    setSharing(true);
    try {
      const { data } = await shareProspects(prospectIds, Array.from(chosen));
      const people = `${chosen.size} ${chosen.size === 1 ? 'person' : 'people'}`;
      toast.success(data?.shared === 0
        ? `Already shared with ${people}.`
        : `Shared ${count.toLocaleString()} prospect${count === 1 ? '' : 's'} with ${people}.`);
      onShared?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, 'Could not share the prospects.'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !sharing && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" /> Share with your team</DialogTitle>
          <DialogDescription>
            Only the people you tick get access to these {count.toLocaleString()} prospect{count === 1 ? '' : 's'}: they can
            see them and call them in their own campaigns. The owner does not change.
          </DialogDescription>
        </DialogHeader>

        {targets === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your team…
          </p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-600">{loadError}</p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">There is nobody on your team to share with.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox id="share-all" checked={allChosen}
                onCheckedChange={(checked) => setChosen(checked === true ? new Set(targets.map((t) => t.user_id)) : new Set())} />
              <Label htmlFor="share-all" className="text-sm font-medium">Everyone ({targets.length})</Label>
            </div>
            <ul className="max-h-64 overflow-y-auto space-y-1.5" aria-label="Team members">
              {targets.map((target) => (
                <li key={target.user_id} className="flex items-center gap-2">
                  <Checkbox id={`share-${target.user_id}`} checked={chosen.has(target.user_id)} onCheckedChange={() => toggle(target.user_id)} />
                  <Label htmlFor={`share-${target.user_id}`} className="text-sm font-normal">
                    {target.name} <span className="text-xs text-muted-foreground">· {ROLE_LABEL[target.role] || target.role}</span>
                  </Label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={chosen.size === 0 || sharing} className="bg-primary text-primary-foreground">
            {sharing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sharing…</> : `Share with ${chosen.size || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
