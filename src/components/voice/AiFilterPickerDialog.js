import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listSavedFilters, searchProspectsByFilter } from '@/lib/api';
import FilterBuilder from '@/components/prospecting/FilterBuilder';
import Notice from '@/components/prospecting/Notice';
import ProspectResults from '@/components/prospecting/ProspectResults';
import useFilterBuilder from '@/components/prospecting/useFilterBuilder';
import { DEFAULT_PAGE_SIZE, describeApiError } from '@/components/prospecting/filterUtils';
import {
  MAX_CAMPAIGN_CONTACTS, addProspects, removeIds, selectedIds, toggleProspect, unselectableReason,
} from '@/lib/prospectSelection';

// Reported in rules_applied while synthetic prospects are shown (development only).
export const SYNTHETIC_SHOWN_RULE = 'include_simulated_development';
const ID_PREFIX = 'campaign-import';
const SAVED_ID = `${ID_PREFIX}-saved`;

/**
 * Pick campaign leads with AI Filtering: type a sentence or load a saved search, search,
 * and tick results across pages. "Use N prospects" hands the prospect ids to `onConfirm`.
 *
 * Nothing is trusted from here: the campaign API checks every id again (tenant, role,
 * deleted, synthetic) when the campaign is created.
 */
export default function AiFilterPickerDialog({ open, onOpenChange, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ops max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Import from AI Filtering</DialogTitle>
          <DialogDescription>
            Describe who to call, or load a saved search, then tick the prospects for this campaign.
            Only prospects with a phone number can be picked.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the field list and saved searches load when needed. */}
        {open && <PickerBody onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onCancel, onConfirm }) {
  const builder = useFilterBuilder();
  const [saved, setSaved] = useState([]);
  const [savedId, setSavedId] = useState('');

  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [sort, setSort] = useState('score_desc');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selection, setSelection] = useState(() => new Map());
  const latestSearch = useRef(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Saved searches are optional here: a Super Admin cannot use them (403), and a failure only hides the list.
  useEffect(() => {
    listSavedFilters()
      .then(({ data }) => { if (mounted.current) setSaved(data?.items || []); })
      .catch(() => { if (mounted.current) setSaved([]); });
  }, []);

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
      setResults(data);
      setSearched(request);
      setSort(nextSort);
      setPageSize(nextPageSize);
    } catch (error) {
      if (!isLatest()) return;
      builder.showConditionIssues(error, request);
      setSearchError(describeApiError(error, 'Could not search prospects.'));
    } finally {
      if (isLatest()) setSearching(false);
    }
  };

  const canSearch = !builder.incomplete && !searching && !builder.parsing;
  const searchNow = () => canSearch && runSearch(builder.buildRequest());
  const loadSaved = (filterId) => {
    setSavedId(filterId);
    const chosen = saved.find((item) => item.filter_id === filterId);
    if (chosen) runSearch(builder.loadFilter(chosen.filter));
  };

  const capMessage = `A campaign can have at most ${MAX_CAMPAIGN_CONTACTS.toLocaleString()} contacts.`;
  const rowSelection = {
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
  };

  const count = selection.size;
  const syntheticShown = (results?.rules_applied || []).includes(SYNTHETIC_SHOWN_RULE);

  return (
    <div className="space-y-4">
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={SAVED_ID} className="text-xs text-muted-foreground">Start from a saved search</Label>
          <Select value={savedId} onValueChange={loadSaved} disabled={searching}>
            <SelectTrigger id={SAVED_ID}><SelectValue placeholder="Choose a saved search" /></SelectTrigger>
            <SelectContent>
              {saved.map((item) => <SelectItem key={item.filter_id} value={item.filter_id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <FilterBuilder builder={builder} idPrefix={ID_PREFIX}>
        <Button type="button" onClick={searchNow} disabled={!canSearch} className="bg-primary text-primary-foreground sm:w-auto w-full">
          {searching
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Searching…</>
            : <><Search className="w-4 h-4 mr-1.5" /> Search prospects</>}
        </Button>
      </FilterBuilder>

      {syntheticShown && (
        <Notice tone="warning" title="Development data is shown">
          <p className="text-muted-foreground">
            Synthetic test prospects are included for this demo. They can't be added to a campaign or called.
          </p>
        </Notice>
      )}

      {searchError && (
        <div role="alert">
          <Notice tone="warning" title="The search could not be completed">
            <p className="text-muted-foreground break-words">{searchError}</p>
          </Notice>
        </div>
      )}

      <ProspectResults
        results={results}
        loading={searching}
        sort={sort}
        pageSize={pageSize}
        onSortChange={(nextSort) => searched && runSearch(searched, { nextSort })}
        onPageSizeChange={(nextPageSize) => searched && runSearch(searched, { nextPageSize })}
        onPageChange={(page) => searched && runSearch(searched, { page })}
        selection={rowSelection}
        idPrefix={ID_PREFIX}
      />

      <DialogFooter className="sm:items-center sm:justify-between gap-2">
        <p className="text-sm flex items-center gap-1.5" role="status" aria-live="polite">
          <Users className="w-4 h-4 text-primary" />
          <span><span className="font-semibold">{count.toLocaleString()}</span> selected</span>
          {count > 0 && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => setSelection(new Map())}>
              Clear
            </Button>
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={count === 0} className="bg-primary text-primary-foreground"
            onClick={() => onConfirm(selectedIds(selection))}>
            Use {count.toLocaleString()} prospect{count === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
