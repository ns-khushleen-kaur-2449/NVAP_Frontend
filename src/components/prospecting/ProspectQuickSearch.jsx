import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, MapPin, Phone, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getProspects } from '@/lib/api';
import { describeApiError } from '@/components/prospecting/filterUtils';

export const MIN_CHARS = 2;
export const RESULT_LIMIT = 10;
const DEBOUNCE_MS = 300;

const stageLabel = (stage) => (stage ? stage.charAt(0) + stage.slice(1).toLowerCase().replace(/_/g, ' ') : '');

/**
 * Find a prospect by name, email or phone number (GET /api/v1/prospects?search=). The backend applies
 * the caller's tenant and prospect visibility, and matches a number in any formatting.
 */
export default function ProspectQuickSearch() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { items, total, query }
  const [error, setError] = useState(null);
  const latest = useRef(0);
  const query = text.trim();

  useEffect(() => {
    if (query.length < MIN_CHARS) {
      latest.current += 1;
      setResult(null);
      setError(null);
      setBusy(false);
      return undefined;
    }
    const run = ++latest.current;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await getProspects({ search: query, limit: RESULT_LIMIT });
        if (run !== latest.current) return;
        setResult({ items: data?.prospects || [], total: data?.total ?? 0, query });
        setError(null);
      } catch (e) {
        if (run !== latest.current) return;
        setResult(null);
        setError(describeApiError(e, 'Could not search prospects.'));
      } finally {
        if (run === latest.current) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const items = result?.items || [];

  return (
    <div className="space-y-2" data-testid="prospect-quick-search">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setText(''); }}
          placeholder="Search prospects by name, phone number or email"
          aria-label="Search prospects"
          maxLength={200}
          className="h-10 pl-9 pr-9 bg-card [&::-webkit-search-cancel-button]:hidden"
        />
        {busy ? (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />
        ) : text && (
          <button type="button" onClick={() => setText('')} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query.length > 0 && query.length < MIN_CHARS && (
        <p className="text-xs text-muted-foreground">{`Type at least ${MIN_CHARS} characters.`}</p>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-border bg-card">
          <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border" role="status" aria-live="polite">
            {result.total === 0
              ? `No prospects match “${result.query}”.`
              : `${result.total.toLocaleString()} ${result.total === 1 ? 'match' : 'matches'}`
                + (result.total > items.length ? ` · showing the newest ${items.length}` : '')}
          </p>
          {items.length > 0 && (
            <ul className="divide-y divide-border max-h-96 overflow-y-auto" aria-label="Matching prospects">
              {items.map((p) => (
                <li key={p.prospect_id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 hover:bg-muted/50">
                  <div className="min-w-0 sm:w-56 shrink-0">
                    <Link to={`/leads?prospect=${encodeURIComponent(p.prospect_id)}`}
                      className="block text-sm font-medium truncate hover:text-primary hover:underline">
                      {p.full_name || 'Unnamed prospect'}
                    </Link>
                    {p.job_title && <p className="text-[11px] text-muted-foreground truncate">{p.job_title}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground flex-1 min-w-0">
                    {p.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" aria-hidden="true" />{p.phone}</span>}
                    {p.email && <span className="inline-flex items-center gap-1 min-w-0"><Mail className="w-3 h-3 shrink-0" aria-hidden="true" /><span className="truncate">{p.email}</span></span>}
                    {p.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" aria-hidden="true" />{p.city}</span>}
                  </div>
                  {p.stage && <Badge variant="outline" className="self-start sm:self-auto text-[10px] shrink-0">{stageLabel(p.stage)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
