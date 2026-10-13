import { AlertTriangle, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import FilterConditionRow from '@/components/prospecting/FilterConditionRow';
import Notice from '@/components/prospecting/Notice';
import {
  MAX_CONDITIONS,
  MAX_PARSE_TEXT_LENGTH,
  formatConditionValue,
  operatorLabel,
} from '@/components/prospecting/filterUtils';

/**
 * The sentence box and the editable conditions for one filter.
 *
 * `builder` is what useFilterBuilder() returned. `idPrefix` keeps form ids
 * unique when two builders are on the page. `children` is rendered under the
 * conditions, for the screen's own Search button. Nothing is rendered below the
 * field list until it has loaded, so `children` only appears with a usable filter.
 */
export default function FilterBuilder({ builder, idPrefix, matchLabel = 'Prospects must match', children }) {
  const {
    fields, fieldsLoading, fieldsError, loadFields, fieldsByKey,
    text, setText, parsing, parsed, parseError, canParse, runParse,
    match, setMatch, conditions, addCondition, changeCondition, removeCondition,
    atLimit, incomplete, conditionErrors,
  } = builder;
  const textId = `${idPrefix}-text`;
  const counterId = `${idPrefix}-text-counter`;
  const matchId = `${idPrefix}-match`;

  if (fieldsLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Loading filter fields…</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  if (fieldsError) {
    return (
      <Card className="card-base p-4 border-destructive/40" role="alert">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold">AI Filtering could not be loaded</p>
            <p className="text-xs text-muted-foreground break-words">{fieldsError}</p>
            <Button size="sm" variant="outline" onClick={loadFields}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={textId}>Describe your ideal prospects</Label>
        <Textarea
          id={textId}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_PARSE_TEXT_LENGTH))}
          onKeyDown={(event) => {
            // Enter adds a new line; Ctrl/Cmd+Enter parses.
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              runParse();
            }
          }}
          maxLength={MAX_PARSE_TEXT_LENGTH}
          rows={3}
          placeholder="e.g. Decision makers in India at companies with more than 500 employees"
          aria-describedby={counterId}
          disabled={parsing}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p id={counterId} className="text-xs text-muted-foreground" aria-live="polite">
            {text.length} / {MAX_PARSE_TEXT_LENGTH} characters
          </p>
          <Button onClick={runParse} disabled={!canParse} className="bg-primary text-primary-foreground sm:w-auto w-full">
            {parsing
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Parsing…</>
              : <><Sparkles className="w-4 h-4 mr-1.5" /> Parse</>}
          </Button>
        </div>
      </div>

      {parseError && (
        <div role="alert">
          <Notice tone="warning" title={parseError.aiDown ? 'The AI service is unavailable right now' : 'That sentence could not be parsed'}>
            <p className="text-muted-foreground break-words">{parseError.message}</p>
            {parseError.aiDown && (
              <p className="text-muted-foreground">Your sentence has been kept. You can try again in a moment.</p>
            )}
          </Notice>
        </div>
      )}

      {parsed && (parsed.empty || parsed.notUnderstood.length > 0 || parsed.dropped.length > 0) && (
        <section className="space-y-3" aria-label="Notes about your sentence">
          {parsed.empty && (
            <Notice tone="warning" title="No filter conditions could be built from that sentence">
              <p className="text-muted-foreground">Your filter below has not been changed. Try rewording it, or add conditions yourself.</p>
            </Notice>
          )}

          {parsed.notUnderstood.length > 0 && (
            <Notice tone="warning" title="Parts of your sentence were not used">
              <p className="text-muted-foreground">These do not match any field we can filter on:</p>
              <ul className="list-disc pl-4 text-muted-foreground">
                {parsed.notUnderstood.map((part, index) => <li key={`${part}-${index}`} className="break-words">{part}</li>)}
              </ul>
            </Notice>
          )}

          {parsed.dropped.length > 0 && (
            <Notice tone="warning" title="Some suggested conditions were left out">
              <ul className="list-disc pl-4 text-muted-foreground">
                {parsed.dropped.map((item, index) => {
                  const value = formatConditionValue(item.op, item.value);
                  const what = [fieldsByKey[item.field]?.label || item.field, item.op && operatorLabel(item.op), value]
                    .filter(Boolean).join(' ');
                  return (
                    <li key={`${item.field}-${item.op}-${index}`} className="break-words">
                      {what ? <><span className="font-medium text-foreground">{what}</span>: </> : null}{item.error}
                    </li>
                  );
                })}
              </ul>
            </Notice>
          )}
        </section>
      )}

      <section className="space-y-3" aria-label="Filter conditions">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">Filter conditions</h3>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor={matchId} className="text-muted-foreground font-normal">{matchLabel}</Label>
            <Select value={match} onValueChange={setMatch}>
              <SelectTrigger id={matchId} className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all of the conditions</SelectItem>
                <SelectItem value="any">any of the conditions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {conditions.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No conditions yet. Describe your prospects above and select Parse, or add a condition yourself.
          </div>
        ) : (
          <ul className="space-y-2">
            {conditions.map((condition, index) => (
              <FilterConditionRow
                key={condition.id}
                index={index}
                condition={condition}
                fields={fields}
                disabled={parsing}
                error={conditionErrors[condition.id]}
                onChange={(next) => changeCondition(condition.id, next)}
                onRemove={() => removeCondition(condition.id)}
              />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" size="sm" variant="outline" onClick={addCondition} disabled={atLimit || parsing || !fields?.length}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add condition
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {conditions.length} of {MAX_CONDITIONS} conditions{atLimit ? ' (the maximum)' : ''}
          </p>
        </div>

        {incomplete && (
          <Notice tone="warning" title="This filter is not ready yet">
            <p className="text-muted-foreground break-words">{incomplete}</p>
          </Notice>
        )}

        {children}
      </section>
    </>
  );
}
