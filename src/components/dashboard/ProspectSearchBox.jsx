import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Notice from '@/components/prospecting/Notice';
import ProspectResultRow from '@/components/prospecting/ProspectResultRow';
import { MAX_PARSE_TEXT_LENGTH, describeApiError, isAiUnavailable } from '@/components/prospecting/filterUtils';
import { parseFilterText, searchProspectsByFilter } from '@/lib/api';

// The top matches shown on the dashboard; the Prospecting page has the full list.
export const PREVIEW_SIZE = 5;
// Reported in rules_applied while synthetic prospects are shown (development only).
const SYNTHETIC_SHOWN_RULE = 'include_simulated_development';
const INPUT_ID = 'dashboard-prospect-search';

/**
 * Dashboard Search Box (spec: Rep Dashboard, "Search Box").
 *
 * The sentence goes to POST /api/ai/filter/parse, and the filter it returns to
 * POST /api/ai/filter/search, so the backend applies the caller's tenant, ownership
 * scope and system exclusions exactly as on the Prospecting page. Nothing here
 * widens a search: a sentence that gives no conditions is not run as "everyone".
 */
export default function ProspectSearchBox() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // { results, notUnderstood } after a search; { empty, notUnderstood } when the sentence gave no conditions.
  const [outcome, setOutcome] = useState(null);
  // { message, aiDown }
  const [error, setError] = useState(null);
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const trimmed = text.trim();
  const canSearch = trimmed.length > 0 && !busy;

  const search = async (event) => {
    event.preventDefault();
    if (!canSearch) return;
    latest.current += 1;
    const run = latest.current;
    const isLatest = () => mounted.current && run === latest.current;
    setBusy(true);
    setError(null);
    try {
      const { data: parsed } = await parseFilterText(trimmed);
      if (!isLatest()) return;
      const notUnderstood = parsed?.not_understood || [];
      if (!(parsed?.filter?.conditions || []).length) {
        setOutcome({ empty: true, notUnderstood });
        return;
      }
      const { data: results } = await searchProspectsByFilter(parsed.filter, { page: 1, pageSize: PREVIEW_SIZE, sort: 'score_desc' });
      if (!isLatest()) return;
      setOutcome({ results, notUnderstood });
    } catch (searchError) {
      if (!isLatest()) return;
      setOutcome(null);
      setError({ message: describeApiError(searchError, 'Could not search prospects.'), aiDown: isAiUnavailable(searchError) });
    } finally {
      if (isLatest()) setBusy(false);
    }
  };

  const results = outcome?.results;
  const items = results?.items || [];
  const total = results?.total ?? 0;

  return (
    <Card className="card-base p-4 space-y-3" data-testid="prospect-search-box">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Find prospects</h2>
        <p className="text-xs text-muted-foreground">Describe who you want in plain English; we turn it into filters and search your prospects.</p>
      </div>

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={INPUT_ID} className="sr-only">Describe the prospects you want</label>
        <Input
          id={INPUT_ID}
          value={text}
          maxLength={MAX_PARSE_TEXT_LENGTH}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Decision makers in automotive in India"
          disabled={busy}
        />
        <Button type="submit" disabled={!canSearch} className="bg-primary text-primary-foreground sm:w-auto w-full">
          {busy ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Searching…</> : <><Search className="w-4 h-4 mr-1.5" /> Search</>}
        </Button>
      </form>

      {error && (
        <div role="alert">
          <Notice tone="warning" title={error.aiDown ? 'The AI search is unavailable right now' : 'The search could not be completed'}>
            <p className="text-muted-foreground break-words">{error.message}</p>
            {error.aiDown && <p className="text-muted-foreground">You can still build the filter by hand on the Prospecting page.</p>}
          </Notice>
        </div>
      )}

      {outcome?.empty && (
        <Notice tone="warning" title="No filter could be built from that sentence">
          <p className="text-muted-foreground">Try naming a country, industry, job title or seniority.</p>
        </Notice>
      )}

      {outcome?.notUnderstood?.length > 0 && (
        <p className="text-xs text-muted-foreground break-words">Not used: {outcome.notUnderstood.join(', ')}</p>
      )}

      {results && (
        <div className="space-y-2">
          <p className="text-sm" role="status" aria-live="polite">
            <span className="font-semibold">{total.toLocaleString()}</span> matching {total === 1 ? 'prospect' : 'prospects'}
            {total > items.length && <span className="text-muted-foreground"> · top {items.length} by score</span>}
          </p>
          {(results.rules_applied || []).includes(SYNTHETIC_SHOWN_RULE) && (
            <Notice tone="warning" title="Development data is shown">
              <p className="text-muted-foreground">Synthetic test prospects are included. They can't be called or added to a campaign.</p>
            </Notice>
          )}
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((prospect) => <ProspectResultRow key={prospect.prospect_id} prospect={prospect} />)}
            </ul>
          )}
        </div>
      )}

      <Button asChild variant="link" className="px-0 h-auto text-xs">
        <Link to="/prospecting">Open Prospecting for the full list and saved searches <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
      </Button>
    </Card>
  );
}
