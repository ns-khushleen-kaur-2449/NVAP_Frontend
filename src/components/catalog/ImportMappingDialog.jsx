import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { columnUseGroups, mappingProblems, suggestedMapping } from '@/lib/catalogImportMapping';

/**
 * Say what each column of a CSV is before importing it (POST /api/v1/catalog/import/preview gave `preview`).
 * Each column starts at the import's own guess; `onImport(mapping)` imports with the user's choices.
 */
export default function ImportMappingDialog({ open, onOpenChange, fileName, preview, importing, onImport }) {
  const [mapping, setMapping] = useState({});
  useEffect(() => { if (open) setMapping(suggestedMapping(preview)); }, [open, preview]);

  const groups = useMemo(() => columnUseGroups(preview), [preview]);
  const options = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const blocked = Boolean(preview?.blocked);
  const problems = blocked ? [] : mappingProblems(mapping, options);
  const columns = preview?.columns || [];
  const set = (column, use) => setMapping((current) => ({ ...current, [column]: use }));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!importing) onOpenChange(next); }}>
      <DialogContent className="max-w-[760px] w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{blocked ? 'This file can’t go into the Catalog' : 'Match your columns'}</DialogTitle>
          <DialogDescription>
            {fileName ? `${fileName}: ` : ''}{(preview?.row_count ?? 0).toLocaleString()} rows, {columns.length} columns.
            {blocked ? '' : ' Tell us which catalog field each column is. Only the product name is required.'}
          </DialogDescription>
        </DialogHeader>

        {blocked && (
          <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p>{preview.message}</p>
          </div>
        )}

        {!blocked && (
        <div className="divide-y divide-border rounded-lg border border-border" role="list" aria-label="Columns">
          {columns.map((c) => (
            <div key={c.column} role="listitem" className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium break-words" dir="auto">{c.column}</p>
                <p className="text-xs text-muted-foreground truncate" dir="auto">
                  {c.samples.length ? `e.g. ${c.samples.join(', ')}` : 'Empty in this file'}
                </p>
              </div>
              <Select value={mapping[c.column] || 'new'} onValueChange={(use) => set(c.column, use)} disabled={importing}>
                <SelectTrigger className="w-full sm:w-60 shrink-0" aria-label={`Use of column ${c.column}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs text-muted-foreground">{group.label}</SelectLabel>
                      {group.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        )}

        {problems.length > 0 && (
          <ul className="space-y-0.5 text-sm text-red-700" aria-label="Fix before importing">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>{blocked ? 'Close' : 'Cancel'}</Button>
          {!blocked && (
            <Button onClick={() => onImport(mapping)} disabled={importing || problems.length > 0}>
              {importing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing…</> : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
