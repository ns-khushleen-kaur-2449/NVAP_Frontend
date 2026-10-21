import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CUSTOMER_STATUS_TONES, humanize, splitObjection } from '@/lib/intent';
import RelativeTime from './RelativeTime';
import StatusBadge from './StatusBadge';

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/**
 * One intent assessment (the API's IntentAssessmentResponse): intent, customer status,
 * confidence, recommended action, rationale, signals, objections and the evidence quotes.
 * Used by Intent review and the call log. Wrap it in `.ops` for the tone colours.
 *
 * `compact` (a narrow column): the four headline fields in two columns, and the rest
 * behind "Show details".
 */
export default function IntentAssessmentDetails({ assessment: a, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const full = !compact || expanded;
  return (
    <div className={compact ? 'space-y-3 text-sm' : 'space-y-4 text-sm'}>
      <dl className={compact ? 'grid grid-cols-2 gap-x-3 gap-y-2' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
        <Field label="Intent">
          <span className="font-medium">{humanize(a.primary_intent)}</span>
          {a.secondary_intents?.length > 0 && (
            <span className="block text-xs text-muted-foreground">Also: {a.secondary_intents.map(humanize).join(', ')}</span>
          )}
        </Field>
        <Field label="Customer status">
          <StatusBadge label={humanize(a.customer_status)} tone={CUSTOMER_STATUS_TONES[a.customer_status]} />
        </Field>
        <Field label="Confidence"><span className="ops-num">{a.confidence} / 100</span></Field>
        <Field label="Recommended action">{humanize(a.recommended_action)}</Field>
      </dl>

      {compact && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
          className="text-xs font-medium text-[color:var(--ops-accent-ink)] underline">
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}

      {full && a.rationale && <Field label="Why"><p className="text-foreground">{a.rationale}</p></Field>}

      {full && a.buying_signals?.length > 0 && (
        <Field label="Buying signals">
          <ul className="flex flex-wrap gap-1.5">
            {a.buying_signals.map((s) => <li key={s}><StatusBadge label={humanize(s)} tone="info" /></li>)}
          </ul>
        </Field>
      )}

      {full && a.objections?.length > 0 && (
        <Field label="Objections">
          <ul className="list-disc space-y-0.5 pl-5">
            {a.objections.map((text) => {
              const { label, detail } = splitObjection(text);
              return <li key={text}><span className="font-medium">{label}</span>{detail ? ` — ${detail}` : ''}</li>;
            })}
          </ul>
        </Field>
      )}

      {full && <Field label="Evidence from the call">
        {a.evidence?.length > 0 ? (
          <ul className="space-y-2">
            {a.evidence.map((e, i) => (
              <li key={`${e.label}-${i}`}>
                <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-[var(--ops-accent)] bg-[hsl(var(--surface-2))] px-3 py-2">
                  “{e.quote}”
                </blockquote>
                <span className="text-xs text-muted-foreground">Supports {humanize(e.supports).toLowerCase()}: {humanize(e.label)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">No quotes were extracted.</p>}
      </Field>}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Link to={`/leads?prospect=${a.prospect_id}`} className="font-medium text-[color:var(--ops-accent-ink)] underline">Open the lead</Link>
        <span>Assessed <RelativeTime iso={a.created_at} mode="absolute" /></span>
        {a.model_version && <span>Model {a.model_version}</span>}
        {a.prompt_version && <span>Prompt {a.prompt_version}</span>}
      </p>
    </div>
  );
}
