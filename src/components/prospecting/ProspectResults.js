import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import ProspectResultRow from '@/components/prospecting/ProspectResultRow';
import { MAX_PAGE_SIZE, SORT_OPTIONS } from '@/components/prospecting/filterUtils';

const PAGE_SIZES = [10, 25, 50, MAX_PAGE_SIZE];

/**
 * The prospects a search returned, with sorting and paging.
 *
 * `results` is the /search response. Its total, page and total_pages drive
 * everything here; `sort` and `pageSize` are what the user last chose.
 * `selection` (optional, see ProspectResultRow) adds checkboxes and a select-this-page control
 * with `onTogglePage(items, checked)`. `idPrefix` keeps form ids unique when two lists are open.
 */
export default function ProspectResults({
  results, loading, sort, pageSize, onSortChange, onPageSizeChange, onPageChange, selection = null, idPrefix = 'ai-filter',
}) {
  const SORT_ID = `${idPrefix}-sort`;
  const PAGE_SIZE_ID = `${idPrefix}-page-size`;
  if (!results) {
    if (!loading) return null;
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <span className="sr-only">Searching prospects…</span>
        {[0, 1, 2].map((key) => <Skeleton key={key} className="h-24 w-full" />)}
      </div>
    );
  }

  const items = results.items || [];
  const total = results.total ?? 0;
  const page = results.page ?? 1;
  const totalPages = Math.max(results.total_pages ?? 1, 1);
  const first = total === 0 ? 0 : (page - 1) * (results.page_size ?? pageSize) + 1;
  const last = first === 0 ? 0 : first + items.length - 1;
  const selectableOnPage = selection ? items.filter((item) => !selection.disabledReason(item)) : [];
  const pageSelected = selectableOnPage.length > 0 && selectableOnPage.every((item) => selection.isSelected(item.prospect_id));
  const pageCheckboxId = `${idPrefix}-select-page`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" role="status" aria-live="polite">
          <span className="font-semibold">{total.toLocaleString()}</span> matching {total === 1 ? 'prospect' : 'prospects'}
          {items.length > 0 && <span className="text-muted-foreground"> · showing {first.toLocaleString()}–{last.toLocaleString()}</span>}
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor={SORT_ID} className="text-xs text-muted-foreground font-normal">Sort by</Label>
          <Select value={sort} onValueChange={onSortChange} disabled={loading}>
            <SelectTrigger id={SORT_ID} className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selection && items.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={pageCheckboxId}
            checked={pageSelected}
            disabled={loading || selectableOnPage.length === 0}
            onCheckedChange={(checked) => selection.onTogglePage(items, checked === true)}
          />
          <Label htmlFor={pageCheckboxId} className="text-xs font-normal">
            Select everyone on this page who can be called ({selectableOnPage.length})
          </Label>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          {total === 0
            ? 'No prospects match this filter. Try removing a condition or widening a value.'
            : 'There are no prospects on this page.'}
        </div>
      ) : (
        <ul className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          {items.map((prospect) => <ProspectResultRow key={prospect.prospect_id} prospect={prospect} selection={selection} />)}
        </ul>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor={PAGE_SIZE_ID} className="text-xs text-muted-foreground font-normal">Per page</Label>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))} disabled={loading}>
              <SelectTrigger id={PAGE_SIZE_ID} className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Pagination className="mx-0 w-auto sm:justify-end" aria-label="Search results pages">
            <PaginationContent className="gap-2">
              <PaginationItem>
                <Button type="button" size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
              </PaginationItem>
              <PaginationItem className="text-xs text-muted-foreground px-1" aria-current="page">
                Page {page.toLocaleString()} of {totalPages.toLocaleString()}
              </PaginationItem>
              <PaginationItem>
                <Button type="button" size="sm" variant="outline" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
