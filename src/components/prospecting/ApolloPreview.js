import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getApolloStatus, searchApolloPreview } from '@/lib/api';
import ApolloResultRow from '@/components/prospecting/ApolloResultRow';
import FilterBuilder from '@/components/prospecting/FilterBuilder';
import Notice from '@/components/prospecting/Notice';
import useFilterBuilder from '@/components/prospecting/useFilterBuilder';
import { describeApiError, formatConditionValue, operatorLabel } from '@/components/prospecting/filterUtils';

// Backend limits for POST /api/apollo/search: page size 1-25, page 1-20.
const PAGE_SIZES = [10, 25];
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_ID = 'apollo-preview-page-size';

// GET /api/apollo/status reasons, in words. Anything unknown gets the last one.
const STATUS_MESSAGES = {
  integration_disabled: ['Apollo Preview is switched off', 'An administrator has not turned the Apollo integration on for this environment.'],
  not_configured: ['Apollo Preview is not set up yet', 'The Apollo integration is on but has not been given its settings. Please contact your administrator.'],
  role_not_allowed: ['Apollo Preview is not available for your role', 'It is open to Tenant Admins, Managers and Sales Reps.'],
  tenant_not_allowed: ['Apollo Preview is not enabled for your organisation', 'Please contact your administrator if you need it.'],
  unknown: ['Apollo Preview is not available right now', 'Please try again later.'],
};

/** Notes the backend returned about single conditions, shown against the filter that was sent. */
function ConditionNotes({ notes, request, fieldsByKey }) {
  return (
    <ul className="list-disc pl-4 text-muted-foreground">
      {notes.map((note, index) => {
        const sent = request?.payload?.conditions?.[note.condition];
        const value = sent ? formatConditionValue(sent.op, sent.value) : '';
        const what = [fieldsByKey[note.field]?.label || note.field, operatorLabel(note.op), value].filter(Boolean).join(' ');
        return (
          <li key={`${note.condition}-${note.field}-${index}`} className="break-words">
            <span className="font-medium text-foreground">{what}</span>: {note.reason}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Apollo Preview: a temporary, live look at who Apollo has for a filter.
 *
 * It has its own filter, separate from Search leads. Results come straight from
 * Apollo through our backend, are masked, and are never saved or imported. The
 * backend decides who may use it; this screen only reports what it answers.
 */
export default function ApolloPreview() {
  const builder = useFilterBuilder();
  const { conditions, incomplete, parsing, fieldsByKey } = builder;

  // null while loading; { enabled, reason } once known; { failed: message } when the check itself failed.
  const [status, setStatus] = useState(null);

  // The last search. `searched` is the filter that was sent, so paging reuses it unchanged.
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [searching, setSearching] = useState(false);
  // { title, message, notTranslated?, retryAfter? }
  const [searchError, setSearchError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const latestSearch = useRef(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadStatus = useCallback(async () => {
    setStatus(null);
    try {
      const { data } = await getApolloStatus();
      if (mounted.current) setStatus({ enabled: data?.enabled === true, reason: data?.reason || null });
    } catch (error) {
      if (mounted.current) setStatus({ failed: describeApiError(error, 'Could not check whether Apollo Preview is available.') });
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const runSearch = async (request, { page = 1, nextPageSize = pageSize } = {}) => {
    latestSearch.current += 1;
    const run = latestSearch.current;
    const isLatest = () => mounted.current && run === latestSearch.current;
    setSearching(true);
    setSearchError(null);
    builder.clearConditionErrors();
    try {
      const { data } = await searchApolloPreview(request.payload, { page, pageSize: nextPageSize });
      if (!isLatest()) return;
      setResults(data);
      setSearched(request);
      setPageSize(nextPageSize);
    } catch (error) {
      if (!isLatest()) return;
      const code = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const message = describeApiError(error, 'Could not search Apollo.');
      if (code === 429) {
        // The backend passes on how long Apollo asks us to wait. Nothing is retried automatically.
        const retryAfter = Number.isFinite(detail?.retry_after) ? detail.retry_after : null;
        setSearchError({ title: "Apollo's request limit has been reached", message, retryAfter });
      } else if (code === 400 && Array.isArray(detail?.not_translated)) {
        // location_only: Apollo could apply nothing but the location, so the backend did not search.
        const title = detail.code === 'location_only'
          ? 'Apollo would only search by location, so nothing was searched'
          : 'Apollo cannot search with this filter';
        setSearchError({ title, message, hint: detail.hint, notTranslated: detail.not_translated, request });
      } else if (code === 400) {
        builder.showConditionIssues(error, request);
        setSearchError({ title: 'This filter is not valid', message });
      } else if (code === 403 || code === 503) {
        setSearchError({ title: 'Apollo Preview is not available', message });
        // Access or setup may have changed since the tab opened.
        loadStatus();
      } else {
        setSearchError({ title: 'The Apollo search could not be completed', message });
      }
    } finally {
      if (isLatest()) setSearching(false);
    }
  };

  const canSearch = conditions.length > 0 && !incomplete && !searching && !parsing;
  const searchNow = () => {
    if (!canSearch) return;
    runSearch(builder.buildRequest());
  };
  const changePage = (page) => searched && runSearch(searched, { page });
  const changePageSize = (nextPageSize) => searched && runSearch(searched, { nextPageSize });

  const header = (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" /> Apollo Preview
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">Demo</span>
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        A temporary, live look at who Apollo has for a filter. These people are not in your prospects, their
        details are masked, and nothing shown here is saved or imported.
      </p>
    </div>
  );

  if (status === null) {
    return (
      <div className="space-y-4">
        {header}
        <div className="space-y-3" role="status" aria-live="polite">
          <span className="sr-only">Checking whether Apollo Preview is available…</span>
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!status.enabled) {
    const [title, explanation] = status.failed
      ? ['Could not check Apollo Preview', status.failed]
      : STATUS_MESSAGES[status.reason] || STATUS_MESSAGES.unknown;
    return (
      <div className="space-y-4">
        {header}
        <div role="status">
          <Notice tone="warning" title={title}>
            <p className="text-muted-foreground break-words">{explanation}</p>
            <p className="text-muted-foreground">Search leads still works as usual.</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={loadStatus}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check again
            </Button>
          </Notice>
        </div>
      </div>
    );
  }

  const items = results?.items || [];
  const total = results?.total ?? 0;
  const page = results?.page ?? 1;
  const shownPageSize = results?.page_size ?? pageSize;
  const totalPages = Math.max(results?.total_pages ?? 1, 1);
  const first = items.length === 0 ? 0 : (page - 1) * shownPageSize + 1;
  const reachable = totalPages * shownPageSize;
  const filterChanged = builder.differsFrom(searched);

  return (
    <div className="space-y-4">
      {header}

      <FilterBuilder builder={builder} idPrefix="apollo-filter" matchLabel="People must match">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={searchNow} disabled={!canSearch} className="bg-primary text-primary-foreground sm:w-auto w-full">
            {searching
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Searching Apollo…</>
              : <><Search className="w-4 h-4 mr-1.5" /> Search Apollo</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            {conditions.length === 0
              ? 'Add at least one condition. Apollo can use job title, seniority, location, company size, revenue and verified email.'
              : 'Each search and each page uses one request from a shared daily limit.'}
          </p>
        </div>
      </FilterBuilder>

      {(results || searching || searchError) && (
        <section className="space-y-3" aria-label="Apollo preview results">
          <h3 className="text-sm font-semibold">Apollo preview results</h3>

          {searchError && (
            <div role="alert">
              <Notice tone="warning" title={searchError.title}>
                <p className="text-muted-foreground break-words">{searchError.message}</p>
                {searchError.retryAfter !== undefined && (
                  <p className="text-muted-foreground">
                    {searchError.retryAfter !== null
                      ? `Apollo asks us to wait about ${searchError.retryAfter} seconds before searching again.`
                      : 'Please wait a while before searching again.'}
                  </p>
                )}
                {searchError.notTranslated?.length > 0 && (
                  <>
                    <p className="text-muted-foreground">Apollo cannot apply:</p>
                    <ConditionNotes notes={searchError.notTranslated} request={searchError.request} fieldsByKey={fieldsByKey} />
                  </>
                )}
                {searchError.hint && <p className="text-muted-foreground break-words">{searchError.hint}</p>}
                <p className="text-muted-foreground">Your filter has been kept{results ? ', and the results below are from your last successful search' : ''}.</p>
              </Notice>
            </div>
          )}

          {!results && searching && (
            <div className="space-y-2" role="status" aria-live="polite">
              <span className="sr-only">Searching Apollo…</span>
              {[0, 1, 2].map((key) => <Skeleton key={key} className="h-20 w-full" />)}
            </div>
          )}

          {results && (
            <>
              {filterChanged && !searching && (
                <Notice title="The filter has changed since this search">
                  <p className="text-muted-foreground">Select Search Apollo to update the results.</p>
                </Notice>
              )}

              {results.not_translated?.length > 0 && (
                <Notice tone="warning" title="Apollo did not apply these conditions">
                  <p className="text-muted-foreground">
                    The results below ignore them, so they include people who do not match these conditions.
                  </p>
                  <ConditionNotes notes={results.not_translated} request={searched} fieldsByKey={fieldsByKey} />
                </Notice>
              )}

              {results.approximate?.length > 0 && (
                <Notice title="Apollo matches these conditions loosely">
                  <p className="text-muted-foreground">The results may be broader than you asked for.</p>
                  <ConditionNotes notes={results.approximate} request={searched} fieldsByKey={fieldsByKey} />
                </Notice>
              )}

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm" role="status" aria-live="polite">
                  <span className="font-semibold">{total.toLocaleString()}</span> {total === 1 ? 'person' : 'people'} in Apollo
                  {items.length > 0 && (
                    <span className="text-muted-foreground"> · showing {first.toLocaleString()}–{(first + items.length - 1).toLocaleString()}</span>
                  )}
                </p>
                {Number.isFinite(results.requests_left_today) && (
                  <p className="text-xs text-muted-foreground">{results.requests_left_today.toLocaleString()} Apollo requests left today</p>
                )}
              </div>
              {total > reachable && (
                <p className="text-xs text-muted-foreground">This preview can page through the first {reachable.toLocaleString()} of them.</p>
              )}

              {items.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                  {total === 0 ? 'Apollo has nobody matching this filter. Try widening a condition.' : 'There is nobody on this page.'}
                </div>
              ) : (
                <ul className={`space-y-2 transition-opacity ${searching ? 'opacity-50' : ''}`} aria-busy={searching}>
                  {items.map((person, index) => <ApolloResultRow key={person.apollo_person_id || index} person={person} />)}
                </ul>
              )}

              {total > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={PAGE_SIZE_ID} className="text-xs text-muted-foreground font-normal">Per page</Label>
                    <Select value={String(pageSize)} onValueChange={(value) => changePageSize(Number(value))} disabled={searching}>
                      <SelectTrigger id={PAGE_SIZE_ID} className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination className="mx-0 w-auto sm:justify-end" aria-label="Apollo preview pages">
                    <PaginationContent className="gap-2">
                      <PaginationItem>
                        <Button type="button" size="sm" variant="outline" disabled={searching || page <= 1} onClick={() => changePage(page - 1)}>
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </Button>
                      </PaginationItem>
                      <PaginationItem className="text-xs text-muted-foreground px-1" aria-current="page">
                        Page {page.toLocaleString()} of {totalPages.toLocaleString()}
                      </PaginationItem>
                      <PaginationItem>
                        <Button type="button" size="sm" variant="outline" disabled={searching || page >= totalPages} onClick={() => changePage(page + 1)}>
                          Next <ChevronRight className="w-4 h-4" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
