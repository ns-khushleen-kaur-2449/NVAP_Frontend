import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Loader2, Pencil, Play, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteSavedFilter, listSavedFilters, updateSavedFilter } from '@/lib/api';
import SaveFilterDialog from '@/components/prospecting/SaveFilterDialog';
import { describeApiError } from '@/components/prospecting/filterUtils';

const conditionCount = (saved) => {
  const count = saved.filter?.conditions?.length ?? 0;
  return `${count} ${count === 1 ? 'condition' : 'conditions'}`;
};

/**
 * The caller's saved searches: their own plus those shared with their organisation.
 *
 * `refreshKey` reloads the list when it changes (the page bumps it after a filter is
 * saved or updated in Search leads). Rename, share and delete are only offered where
 * the backend says `can_edit`; the backend enforces it either way. `onDeleted`
 * receives the id of a search that was deleted here.
 */
export default function SavedFiltersPanel({ refreshKey, canShare, disabled, selectedId, onShowResults, onEdit, onDeleted }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const mounted = useRef(true);
  const latestLoad = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    latestLoad.current += 1;
    const run = latestLoad.current;
    const isLatest = () => mounted.current && run === latestLoad.current;
    setLoading(true);
    setError(null);
    try {
      const { data } = await listSavedFilters();
      if (isLatest()) setItems(data?.items || []);
    } catch (loadError) {
      if (isLatest()) setError(describeApiError(loadError, 'Could not load your saved filters.'));
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, []);

  // Once when the panel appears, and again whenever the parent asks for a refresh.
  useEffect(() => { load(); }, [load, refreshKey]);

  const submitEdit = async ({ name, description, isShared }) => {
    // Send only what changed.
    const changes = {};
    if (name !== editing.name) changes.name = name;
    if (description !== (editing.description || '')) changes.description = description;
    if (isShared !== Boolean(editing.is_shared)) changes.is_shared = isShared;
    if (Object.keys(changes).length === 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateSavedFilter(editing.filter_id, changes);
      if (!mounted.current) return;
      toast.success('Saved search updated');
      setEditing(null);
      load();
    } catch (updateError) {
      if (mounted.current) setEditError(describeApiError(updateError, 'Could not update the saved search.'));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteSavedFilter(deleting.filter_id);
      if (!mounted.current) return;
      toast.success('Saved search deleted');
      onDeleted?.(deleting.filter_id);
      setDeleting(null);
      load();
    } catch (deleteError) {
      if (!mounted.current) return;
      toast.error(describeApiError(deleteError, 'Could not delete the saved search.'));
      setDeleting(null);
      // It may already be gone, or no longer editable: show the current list.
      load();
    } finally {
      if (mounted.current) setDeleteBusy(false);
    }
  };

  return (
    <Card className="card-base p-4 space-y-3" aria-label="Saved filters">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" /> Saved searches
          {items && items.length > 0 && <span className="text-muted-foreground font-normal">({items.length})</span>}
        </h3>
        <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-destructive break-words">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>Try again</Button>
        </div>
      )}

      {!items && loading && (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Loading saved filters…</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {items && items.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          No saved searches yet. Build a filter in Search leads and select Save filter to keep it here.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          {items.map((saved) => (
            <li key={saved.filter_id} aria-current={saved.filter_id === selectedId ? 'true' : undefined}
              className={`border rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${saved.filter_id === selectedId ? 'border-primary' : 'border-border'}`}>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium break-words">{saved.name}</p>
                {saved.description && <p className="text-xs text-muted-foreground break-words">{saved.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={saved.is_shared ? 'secondary' : 'outline'} className="text-[10px]">{saved.is_shared ? 'Shared' : 'Private'}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {/* The backend names the creator of shared searches only. */}
                    {saved.is_owner ? 'Yours' : saved.created_by_name ? `Shared by ${saved.created_by_name}` : 'From a colleague'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{conditionCount(saved)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onShowResults(saved)}
                  aria-label={`Show results for saved search ${saved.name}`}>
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Show results
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(saved)}
                  aria-label={`Edit the conditions of saved search ${saved.name} in Search leads`}>
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Edit in Search leads
                </Button>
                {saved.can_edit && (
                  <>
                    <Button type="button" size="icon" variant="ghost" onClick={() => { setEditError(null); setEditing(saved); }}
                      aria-label={`Rename or share saved search ${saved.name}`} title="Rename or share">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setDeleting(saved)}
                      aria-label={`Delete saved search ${saved.name}`} title="Delete">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SaveFilterDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        savedFilter={editing}
        canShare={canShare}
        saving={saving}
        error={editError}
        onSubmit={submitEdit}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved search?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” will be removed{deleting?.is_shared ? ' for everyone it is shared with' : ''}. This cannot be undone.
              No prospects are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(event) => { event.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Deleting…</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
