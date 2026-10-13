import { useEffect, useRef, useState } from 'react';
import { Bookmark, Loader2, Search, Sparkles } from 'lucide-react';
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
import { createSavedFilter, runSavedFilter, searchProspectsByFilter } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import FilterBuilder from '@/components/prospecting/FilterBuilder';
import Notice from '@/components/prospecting/Notice';
import ProspectResults from '@/components/prospecting/ProspectResults';
import SaveFilterDialog from '@/components/prospecting/SaveFilterDialog';
import SavedFiltersPanel from '@/components/prospecting/SavedFiltersPanel';
import useFilterBuilder from '@/components/prospecting/useFilterBuilder';
import { DEFAULT_PAGE_SIZE, buildFilterPayload, describeApiError } from '@/components/prospecting/filterUtils';

export default function AiFilterSearch() {
  const builder = useFilterBuilder();
  const { conditions, incomplete, parsing } = builder;

  // Roles as the backend sends them at login. These only decide what is offered on
  // screen; the backend enforces who may use, share and edit saved filters.
  const role = useAuth().user?.role;
  const savedFiltersAvailable = role !== 'super_admin';
  const canShare = role === 'tenant_admin' || role === 'manager';

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

  // Saving the filter on screen. `savedListVersion` changes whenever the saved-filter list should reload.
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedListVersion, setSavedListVersion] = useState(0);
  // The filter on screen as it was last loaded from, or stored as, a saved filter. Anything
  // different from it is unsaved work that loading another saved filter would replace.
  const [savedBaseline, setSavedBaseline] = useState(null);
  // { action: 'load' | 'run', saved } while the user is asked whether to replace unsaved work.
  const [pendingReplace, setPendingReplace] = useState(null);

  // Guards against setting state after the tab unmounts mid-request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // `request` is { payload, ids }: the filter to send and the on-screen id of each of its conditions.
  // With `saved` ({ filter_id, name }) the backend runs that saved filter as it is stored.
  const runSearch = async (request, { page = 1, nextSort = sort, nextPageSize = pageSize } = {}) => {
    latestSearch.current += 1;
    const run = latestSearch.current;
    const isLatest = () => mounted.current && run === latestSearch.current;
    setSearching(true);
    setSearchError(null);
    builder.clearConditionErrors();
    try {
      const options = { page, pageSize: nextPageSize, sort: nextSort };
      const { data } = request.saved
        ? await runSavedFilter(request.saved.filter_id, options)
        : await searchProspectsByFilter(request.payload, options);
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
      // A saved filter that could not be run may have been deleted or unshared: show the current list.
      if (request.saved) setSavedListVersion((version) => version + 1);
    } finally {
      if (isLatest()) setSearching(false);
    }
  };

  const canSearch = !incomplete && !searching && !parsing;
  const searchNow = () => {
    if (!canSearch) return;
    runSearch(builder.buildRequest());
  };
  const changePage = (page) => searched && runSearch(searched, { page });
  const changeSort = (nextSort) => searched && runSearch(searched, { nextSort });
  const changePageSize = (nextPageSize) => searched && runSearch(searched, { nextPageSize });

  const filterChanged = builder.differsFrom(searched);

  // Loading puts the saved conditions into the builder to edit; nothing is searched yet.
  const loadSaved = (saved) => {
    setSavedBaseline(builder.loadFilter(saved.filter));
    toast.success(`Loaded “${saved.name}”. Edit it or select Search prospects.`);
  };
  // Running shows the saved conditions in the builder and has the backend run the stored filter.
  const runSaved = (saved) => {
    if (searching) return;
    const request = builder.loadFilter(saved.filter);
    setSavedBaseline(request);
    runSearch({ ...request, saved: { filter_id: saved.filter_id, name: saved.name } });
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
  const replaceWithSaved = (action, saved) => (action === 'run' ? runSaved(saved) : loadSaved(saved));
  const requestSaved = (action, saved) => {
    if (action === 'run' && searching) return;
    if (wouldLoseUnsavedWork(saved)) setPendingReplace({ action, saved });
    else replaceWithSaved(action, saved);
  };
  const confirmReplace = () => {
    const { action, saved } = pendingReplace;
    setPendingReplace(null);
    replaceWithSaved(action, saved);
  };

  const canSave = conditions.length > 0 && !incomplete && !parsing;
  const submitSave = async ({ name, description, isShared }) => {
    const request = builder.buildRequest();
    setSaving(true);
    setSaveError(null);
    try {
      await createSavedFilter({ name, description: description || null, filter: request.payload, is_shared: isShared });
      if (!mounted.current) return;
      toast.success('Filter saved');
      setSaveOpen(false);
      setSavedBaseline(request);
      setSavedListVersion((version) => version + 1);
    } catch (error) {
      if (!mounted.current) return;
      // An invalid filter is shown on its rows as well as in the dialog.
      builder.showConditionIssues(error, request);
      setSaveError(describeApiError(error, 'Could not save the filter.'));
    } finally {
      if (mounted.current) setSaving(false);
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

      {savedFiltersAvailable && (
        <SavedFiltersPanel
          refreshKey={savedListVersion}
          canShare={canShare}
          currentFilter={canSave ? builder.buildRequest().payload : null}
          disabled={searching || parsing || builder.fieldsLoading || Boolean(builder.fieldsError)}
          onLoad={(saved) => requestSaved('load', saved)}
          onRun={(saved) => requestSaved('run', saved)}
        />
      )}

      <FilterBuilder builder={builder} idPrefix="ai-filter">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          {conditions.length === 0 && (
            <p className="text-xs text-muted-foreground">With no conditions, the search returns every prospect you have access to.</p>
          )}
        </div>
      </FilterBuilder>

      {(results || searching || searchError) && (
        <section className="space-y-3" aria-label="Search results">
          <h3 className="text-sm font-semibold">
            {searched?.saved && results ? `Results for saved filter “${searched.saved.name}”` : 'Results'}
          </h3>

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
          />
        </section>
      )}

      <AlertDialog open={Boolean(pendingReplace)} onOpenChange={(open) => !open && setPendingReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your unsaved filter?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReplace?.action === 'run' ? 'Running' : 'Loading'} “{pendingReplace?.saved.name}” will replace the
              conditions on screen, which have not been saved. Cancel to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my filter</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>
              {pendingReplace?.action === 'run' ? 'Replace and run' : 'Replace and load'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
