import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bookmark, Loader2, RefreshCw, Search, Share2, Sparkles, Users } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { createSavedFilter, searchProspectsByFilter, updateSavedFilter } from '@/lib/api';
import FilterBuilder from '@/components/prospecting/FilterBuilder';
import Notice from '@/components/prospecting/Notice';
import ProspectResults from '@/components/prospecting/ProspectResults';
import SaveFilterDialog from '@/components/prospecting/SaveFilterDialog';
import ShareProspectsDialog from '@/components/prospecting/ShareProspectsDialog';
import useFilterBuilder from '@/components/prospecting/useFilterBuilder';
import { DEFAULT_PAGE_SIZE, buildFilterPayload, describeApiError } from '@/components/prospecting/filterUtils';
import {
  MAX_CAMPAIGN_CONTACTS, addProspects, removeIds, toggleProspect, unselectableReason,
} from '@/lib/prospectSelection';

/**
 * Search leads: build a filter and search the prospects already in the database.
 *
 * Saved filters are listed in the Saved searches tab. `loadRequest` ({ saved }, a new
 * object each time) puts one of them into the builder here for editing, and
 * `onSaved` tells the page that the saved list has changed.
 *
 * Every prospect the user may see is listed as soon as the tab opens (a search with no
 * conditions). With `onUseSelected`, results get checkboxes and the ticked prospects
 * ([{ id, name, phone }], picked across pages) are handed to it, e.g. to the
 * Lead-to-Campaign Builder. The campaign API re-checks every id; this only guides.
 * `canShareProspects` (Tenant Admin, Manager) adds "Share with team" for the ticked prospects.
 */
export default function AiFilterSearch({
  savedFiltersAvailable = true, canShare = false, loadRequest = null, onSaved, onUseSelected = null, canShareProspects = false,
}) {
  const builder = useFilterBuilder();
  const { conditions, incomplete, parsing } = builder;

  // The last search. `searched` is the filter that was sent, kept so paging and sorting
  // reuse it even while the conditions above are being edited.
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [sort, setSort] = useState('score_desc');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Only the newest search may update the screen.
  const latestSearch = useRef(0);
  // Prospects ticked for a campaign: prospect_id -> { id, name, phone } (lib/prospectSelection).
  const [selection, setSelection] = useState(() => new Map());
  const [shareOpen, setShareOpen] = useState(false);

  // Saving the filter on screen.
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [updating, setUpdating] = useState(false);
  // The filter on screen as it was last loaded from, or stored as, a saved filter. Anything
  // different from it is unsaved work that loading another saved filter would replace.
  const [savedBaseline, setSavedBaseline] = useState(null);
  // The saved filter that was loaded for editing, so its conditions can be updated in place.
  const [loadedSaved, setLoadedSaved] = useState(null);
  // The saved filter waiting for the user to confirm that unsaved work may be replaced.
  const [pendingLoad, setPendingLoad] = useState(null);

  // Guards against setting state after the tab unmounts mid-request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // `request` is { payload, ids }: the filter to send and the on-screen id of each of its conditions.
  const runSearch = async (request, { page = 1, nextSort = sort, nextPageSize = pageSize } = {}) => {
    latestSearch.current += 1;
    const run = latestSearch.current;
    const isLatest = () => mounted.current && run === latestSearch.current;
    setSearching(true);
    setSearchError(null);
    builder.clearConditionErrors();
    try {
      const { data } = await searchProspectsByFilter(request.payload, { page, pageSize: nextPageSize, sort: nextSort });
      if (!isLatest()) return;
      // Only the results are taken from the response; its echoed filter is not used.
      setResults(data);
      setSearched(request);
      setSort(nextSort);
      setPageSize(nextPageSize);
    } catch (error) {
      if (!isLatest()) return;
      // A 400 names the conditions at fault by position; show each message on its row.
      builder.showConditionIssues(error, request);
      const message = describeApiError(error, 'Could not search prospects.');
      setSearchError(message);
      toast.error(message);
    } finally {
      if (isLatest()) setSearching(false);
    }
  };

  // Show everything the user may see straight away; a filter then narrows it.
  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;
  useEffect(() => {
    runSearchRef.current({ payload: buildFilterPayload('all', []), ids: [] });
  }, []);

  const canSearch = !incomplete && !searching && !parsing;
  const searchNow = () => {
    if (!canSearch) return;
    runSearch(builder.buildRequest());
  };
  const changePage = (page) => searched && runSearch(searched, { page });
  const changeSort = (nextSort) => searched && runSearch(searched, { nextSort });
  const changePageSize = (nextPageSize) => searched && runSearch(searched, { nextPageSize });

  const filterChanged = builder.differsFrom(searched);
  const showingAll = Boolean(searched) && (searched.payload?.conditions || []).length === 0;

  const capMessage = `A campaign can have at most ${MAX_CAMPAIGN_CONTACTS.toLocaleString()} contacts.`;
  const selectable = Boolean(onUseSelected) || canShareProspects;
  const rowSelection = selectable ? {
    isSelected: (id) => selection.has(id),
    disabledReason: unselectableReason,
    onToggle: (prospect) => {
      const result = toggleProspect(selection, prospect);
      if (result.capped) toast.error(capMessage);
      setSelection(result.selection);
    },
    onTogglePage: (items, checked) => {
      if (!checked) {
        setSelection(removeIds(selection, items.map((item) => item.prospect_id)));
        return;
      }
      const result = addProspects(selection, items);
      if (result.capped) toast.error(`${capMessage} ${result.capped} not added.`);
      setSelection(result.selection);
    },
  } : null;
  const selectedCount = selection.size;

  // Loading puts the saved conditions into the builder to edit; nothing is searched yet.
  const loadSaved = (saved) => {
    setSavedBaseline(builder.loadFilter(saved.filter));
    setLoadedSaved(saved);
    toast.success(`Loaded “${saved.name}”. Edit it or select Search prospects.`);
  };

  // True when putting `saved` into the builder would throw away something the user has not saved.
  const wouldLoseUnsavedWork = (saved) => {
    const unsaved = savedBaseline
      ? builder.differsFrom(savedBaseline)
      : conditions.length > 0 || builder.match !== 'all';
    // Nothing is lost when the saved filter is the same as what is already on screen.
    const same = !builder.differsFrom({ payload: buildFilterPayload(saved.filter?.match, saved.filter?.conditions) });
    return unsaved && !same;
  };
  const requestLoad = (saved) => {
    if (wouldLoseUnsavedWork(saved)) setPendingLoad(saved);
    else loadSaved(saved);
  };
  const confirmLoad = () => {
    const saved = pendingLoad;
    setPendingLoad(null);
    loadSaved(saved);
  };

  // The Saved searches tab asks for a filter to be loaded by passing a new request object.
  const requestLoadRef = useRef(requestLoad);
  requestLoadRef.current = requestLoad;
  useEffect(() => {
    if (loadRequest?.saved) requestLoadRef.current(loadRequest.saved);
  }, [loadRequest]);

  const canSave = conditions.length > 0 && !incomplete && !parsing;
  const submitSave = async ({ name, description, isShared }) => {
    const request = builder.buildRequest();
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await createSavedFilter({ name, description: description || null, filter: request.payload, is_shared: isShared });
      if (!mounted.current) return;
      toast.success('Saved. Find it in Saved searches.');
      setSaveOpen(false);
      setSavedBaseline(request);
      setLoadedSaved(data || null);
      onSaved?.();
    } catch (error) {
      if (!mounted.current) return;
      // An invalid filter is shown on its rows as well as in the dialog.
      builder.showConditionIssues(error, request);
      setSaveError(describeApiError(error, 'Could not save the filter.'));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  // A saved filter loaded for editing can take the changed conditions, if the backend says it is editable.
  const canUpdate = Boolean(loadedSaved?.can_edit) && canSave && builder.differsFrom(savedBaseline) && !updating;
  const updateLoaded = async () => {
    if (!canUpdate) return;
    const request = builder.buildRequest();
    setUpdating(true);
    try {
      const { data } = await updateSavedFilter(loadedSaved.filter_id, { filter: request.payload });
      if (!mounted.current) return;
      toast.success(`Updated “${loadedSaved.name}”.`);
      setSavedBaseline(request);
      setLoadedSaved(data || loadedSaved);
      onSaved?.();
    } catch (error) {
      if (!mounted.current) return;
      builder.showConditionIssues(error, request);
      toast.error(describeApiError(error, 'Could not update the saved search.'));
    } finally {
      if (mounted.current) setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> AI Filtering
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe who you are looking for in plain English and we turn it into filter conditions, or build the
          conditions yourself. Either way you can edit them below.
        </p>
      </div>

      {loadedSaved && (
        <Notice title={`Editing saved search “${loadedSaved.name}”`}>
          <p className="text-muted-foreground">
            {loadedSaved.can_edit
              ? 'Change the conditions, then select Update saved search to keep the changes, or Save filter to keep them as a new search.'
              : 'You cannot change this shared search, but you can select Save filter to keep your changes as your own.'}
          </p>
          {/* Detaches the builder from the saved search, so Update cannot overwrite it by mistake. */}
          <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => setLoadedSaved(null)}>
            Stop editing this saved search
          </Button>
        </Notice>
      )}

      <FilterBuilder builder={builder} idPrefix="ai-filter">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <Button type="button" onClick={searchNow} disabled={!canSearch} className="bg-primary text-primary-foreground sm:w-auto w-full">
            {searching
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Searching…</>
              : <><Search className="w-4 h-4 mr-1.5" /> Search prospects</>}
          </Button>
          {savedFiltersAvailable && (
            <Button type="button" variant="outline" disabled={!canSave} className="sm:w-auto w-full"
              onClick={() => { setSaveError(null); setSaveOpen(true); }}>
              <Bookmark className="w-4 h-4 mr-1.5" /> Save filter
            </Button>
          )}
          {savedFiltersAvailable && loadedSaved?.can_edit && (
            <Button type="button" variant="outline" disabled={!canUpdate} className="sm:w-auto w-full" onClick={updateLoaded}>
              {updating
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Updating…</>
                : <><RefreshCw className="w-4 h-4 mr-1.5" /> Update saved search</>}
            </Button>
          )}
          {conditions.length === 0 && (
            <p className="text-xs text-muted-foreground">With no conditions, the search returns every prospect you have access to.</p>
          )}
        </div>
      </FilterBuilder>

      {(results || searching || searchError) && (
        <section className="space-y-3" aria-label="Search results">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">{showingAll ? 'All prospects' : 'Results'}</h3>
            {selectable && (
              <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
                <span className="text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span><span className="font-semibold">{selectedCount.toLocaleString()}</span> selected</span>
                </span>
                {selectedCount > 0 && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setSelection(new Map())}>
                    Clear
                  </Button>
                )}
                {canShareProspects && (
                  <Button type="button" size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setShareOpen(true)}>
                    <Share2 className="w-4 h-4 mr-1.5" /> Share with team
                  </Button>
                )}
                {onUseSelected && (
                  <Button type="button" size="sm" disabled={selectedCount === 0} className="bg-primary text-primary-foreground"
                    onClick={() => onUseSelected(Array.from(selection.values()))}>
                    Add to Lead-to-Campaign Builder <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {searchError && (
            <div role="alert">
              <Notice tone="warning" title="The search could not be completed">
                <p className="text-muted-foreground break-words">{searchError}</p>
                <p className="text-muted-foreground">Your filter has been kept{results ? ', and the results below are from your last successful search' : ''}.</p>
              </Notice>
            </div>
          )}

          {results && filterChanged && !searching && (
            <Notice title="The filter has changed since this search">
              <p className="text-muted-foreground">Select Search prospects to update the results.</p>
            </Notice>
          )}

          <ProspectResults
            results={results}
            loading={searching}
            sort={sort}
            pageSize={pageSize}
            onSortChange={changeSort}
            onPageSizeChange={changePageSize}
            onPageChange={changePage}
            selection={rowSelection}
          />
        </section>
      )}

      <AlertDialog open={Boolean(pendingLoad)} onOpenChange={(open) => !open && setPendingLoad(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your unsaved filter?</AlertDialogTitle>
            <AlertDialogDescription>
              Loading “{pendingLoad?.name}” will replace the conditions on screen, which have not been saved.
              Cancel to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my filter</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad}>Replace and load</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canShareProspects && (
        <ShareProspectsDialog open={shareOpen} onOpenChange={setShareOpen} prospectIds={Array.from(selection.keys())} />
      )}

      {savedFiltersAvailable && (
        <SaveFilterDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          canShare={canShare}
          saving={saving}
          error={saveError}
          onSubmit={submitSave}
        />
      )}
    </div>
  );
}
