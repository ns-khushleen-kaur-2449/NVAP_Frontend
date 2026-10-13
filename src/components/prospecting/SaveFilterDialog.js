import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Backend limits for a saved filter's name and description.
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Name, describe and optionally share a saved filter.
 *
 * With `savedFilter` it edits that filter; without, it saves a new one. The
 * parent does the API call in `onSubmit({ name, description, isShared, replaceFilter })`
 * and passes back `saving` and `error`. `canShare` only decides whether the
 * sharing box is offered; the backend still enforces who may share.
 */
export default function SaveFilterDialog({ open, onOpenChange, savedFilter, canShare, canReplaceFilter, saving, error, onSubmit }) {
  const editing = Boolean(savedFilter);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [replaceFilter, setReplaceFilter] = useState(false);

  // Start from the saved filter's values (or blank) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(savedFilter?.name || '');
    setDescription(savedFilter?.description || '');
    setIsShared(Boolean(savedFilter?.is_shared));
    setReplaceFilter(false);
  }, [open, savedFilter]);

  const trimmedName = name.trim();
  // A filter that is already shared can always be made private again by someone who may edit it.
  const showSharing = canShare || Boolean(savedFilter?.is_shared);

  const submit = (event) => {
    event.preventDefault();
    if (!trimmedName || saving) return;
    onSubmit({ name: trimmedName, description: description.trim(), isShared, replaceFilter });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit saved filter' : 'Save filter'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Change its name, description or sharing.'
                : 'Save the conditions on screen so you can load or run them again later.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="saved-filter-name">Name</Label>
            <Input id="saved-filter-name" value={name} maxLength={MAX_NAME_LENGTH} required autoFocus disabled={saving}
              onChange={(event) => setName(event.target.value)} placeholder="e.g. Decision makers in India" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saved-filter-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="saved-filter-description" value={description} maxLength={MAX_DESCRIPTION_LENGTH} rows={2} disabled={saving}
              onChange={(event) => setDescription(event.target.value)} />
          </div>

          {showSharing && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={isShared} disabled={saving || (!canShare && !isShared)}
                onCheckedChange={(checked) => setIsShared(checked === true)} />
              <span>
                Share with everyone in my organisation
                <span className="block text-xs text-muted-foreground">
                  Each person who runs it sees only the prospects they are allowed to see.
                </span>
              </span>
            </label>
          )}

          {editing && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={replaceFilter} disabled={saving || !canReplaceFilter}
                onCheckedChange={(checked) => setReplaceFilter(checked === true)} />
              <span>
                Replace its conditions with the filter on screen
                <span className="block text-xs text-muted-foreground">
                  {canReplaceFilter
                    ? 'Leave this off to keep the saved conditions as they are.'
                    : 'Not available: the filter on screen is empty or unfinished.'}
                </span>
              </span>
            </label>
          )}

          {error && <p className="text-xs text-destructive break-words" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={!trimmedName || saving} className="bg-primary text-primary-foreground">
              {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Save filter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
