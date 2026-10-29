import { Card } from '@/components/ui/card';
import ChangeNotice from './ChangeNotice';

// ImportReport.columns[].used_as (backend catalog/importer.py).
export const COLUMN_USES = {
  id: 'Product id', name: 'Name', category: 'Category', price: 'Price', matching: 'Matching',
  stock: 'Stock', field: 'Your field', ignored: 'Ignored',
};

/** What each column of the imported file became, with the reason when it is not what its name suggests. */
export function ImportColumns({ columns }) {
  return (
    <details className="pt-1 text-xs">
      <summary className="cursor-pointer text-muted-foreground">How your {columns.length} columns were read</summary>
      <ul className="mt-1 space-y-0.5">
        {columns.map((c) => (
          <li key={c.column} dir="auto">
            <span className="font-medium">{c.column}</span>: {COLUMN_USES[c.used_as] || c.used_as}
            {c.note ? <span className="text-muted-foreground"> · {c.note}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

const SHOWN = 10;

/**
 * The result of POST /api/v1/catalog/import. A new list option close to an existing one (kind "similar_choice")
 * is a possible typo, listed apart with a link to that field's settings; the rest are cells left empty.
 */
export default function ImportReport({ report, onFieldSettings }) {
  const warnings = report.warnings || [];
  const typos = warnings.filter((w) => w.kind === 'similar_choice');
  const empty = warnings.filter((w) => w.kind !== 'similar_choice');
  return (
    <Card className="card-base p-4 text-sm space-y-1" role="status" aria-label="Import result">
      <p className="font-medium">
        Import: {report.imported} added, {report.updated} updated, {report.deactivated} no longer in the file
        (deactivated), {report.rejected} rejected.
      </p>
      {(report.errors || []).slice(0, SHOWN).map((e) => (
        <p key={`${e.row}-${e.reason}`} className="text-xs text-red-600">Row {e.row}: {e.reason}</p>
      ))}
      {report.errors?.length > SHOWN && <p className="text-xs text-red-600">…and {report.errors.length - SHOWN} more rows.</p>}
      {typos.length > 0 && (
        <div className="pt-1" aria-label="Possible typos">
          <p className="text-xs font-medium text-amber-700">
            Possible typos ({typos.length}): these new options were added but look like ones you already have.
          </p>
          {typos.slice(0, SHOWN).map((w) => (
            <p key={`${w.row}-${w.field}-${w.value}`} className="text-xs text-amber-700" dir="auto">
              Row {w.row}, {w.column}: “{w.value}” was added; it looks like “{w.similar_to}”.
              {onFieldSettings && w.field && (
                <>
                  {' '}
                  <button type="button" className="underline hover:no-underline" onClick={() => onFieldSettings(w.field)}>
                    Open {w.column} settings
                  </button>
                </>
              )}
            </p>
          ))}
          {typos.length > SHOWN && <p className="text-xs text-amber-700">…and {typos.length - SHOWN} more.</p>}
        </div>
      )}
      {empty.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-medium text-amber-700">Left empty ({empty.length}): these cells did not fit their column.</p>
          {empty.slice(0, SHOWN).map((w) => (
            <p key={`${w.row}-${w.column}`} className="text-xs text-amber-700" dir="auto">Row {w.row}, {w.column}: {w.reason}</p>
          ))}
          {empty.length > SHOWN && <p className="text-xs text-amber-700">…and {empty.length - SHOWN} more.</p>}
        </div>
      )}
      {report.columns?.length > 0 && <ImportColumns columns={report.columns} />}
      <p className="text-xs text-muted-foreground">Products you added on this page are never deactivated by an import.</p>
      {report.agents && <ChangeNotice agents={report.agents} />}
    </Card>
  );
}
