import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { runSavedFilter } from '@/lib/api';
import Notice from '@/components/prospecting/Notice';
import ProspectResults from '@/components/prospecting/ProspectResults';
import SavedFiltersPanel from '@/components/prospecting/SavedFiltersPanel';
import { DEFAULT_PAGE_SIZE, describeApiError } from '@/components/prospecting/filterUtils';

/**
 * Saved searches: the caller's saved filters and those shared with their organisation,
 * with the results of whichever one is chosen.
 *
 * Results come from POST /api/ai/filter/saved/{id}/search, so the backend runs the
 * filter as stored, with the access rules of the person running it. `onEdit` hands a
 * saved filter to Search leads for its conditions to be changed.
 */
export default function SavedSearches({ refreshKey, canShare, onEdit }) {
  // Bumped here when a run fails, since the search may have been deleted or unshared meanwhile.
  const [ownRefresh, setOwnRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('score_desc');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const latestRun = useRef(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (saved, { page = 1, nextSort = sort, nextPageSize = pageSize } = {}) => {
    latestRun.current += 1;
    const current = latestRun.current;
    const isLatest = () => mounted.current && current === latestRun.current;
    if (saved.filter_id !== selected?.filter_id) setResults(null);
    setSelected(saved);
    setSearching(true);
    setError(null);
    try {
      const { data } = await runSavedFilter(saved.filter_id, { page, pageSize: nextPageSize, sort: nextSort });
      if (!isLatest()) return;
      setResults(data);
      setSort(nextSort);
      setPageSize(nextPageSize);
    } catch (runError) {
      if (!isLatest()) return;
      const message = describeApiError(runError, 'Could not run this saved search.');
      setError(message);
      toast.error(message);
      setOwnRefresh((value) => value + 1);
    } finally {
      if (isLatest()) setSearching(false);
    }
  };

  const clearIfSelected = (filterId) => {
    if (filterId !== selected?.filter_id) return;
    latestRun.current += 1;
    setSelected(null);
    setResults(null);
    setError(null);
    setSearching(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" /> Saved searches
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Filters you saved in Search leads, and those your colleagues shared. Each one is run fresh, so the results are always
          up to date and only include prospects you are allowed to see.
        </p>
      </div>

      <SavedFiltersPanel
        refreshKey={`${refreshKey}-${ownRefresh}`}
        canShare={canShare}
        disabled={searching}
        selectedId={selected?.filter_id}
        onShowResults={(saved) => run(saved)}
        onEdit={onEdit}
        onDeleted={clearIfSelected}
      />

      {selected && (
        <section className="space-y-3" aria-label="Saved search results">
          <h3 className="text-sm font-semibold">Results for “{selected.name}”</h3>

          {error && (
            <div role="alert">
              <Notice tone="warning" title="This saved search could not be run">
                <p className="text-muted-foreground break-words">{error}</p>
                <p className="text-muted-foreground">The list above has been refreshed in case it was changed or removed.</p>
              </Notice>
            </div>
          )}

          <ProspectResults
            results={results}
            loading={searching}
            sort={sort}
            pageSize={pageSize}
            onSortChange={(nextSort) => run(selected, { nextSort })}
            onPageSizeChange={(nextPageSize) => run(selected, { nextPageSize })}
            onPageChange={(page) => run(selected, { page })}
          />
        </section>
      )}
    </div>
  );
}
