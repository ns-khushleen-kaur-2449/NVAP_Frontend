import RelativeTime from './RelativeTime';
import {
  CLASSIFICATION_LABELS, COMPLETENESS_HELP, COMPLETENESS_LABELS, ENGAGEMENT_LABELS, ENGAGEMENT_ORDER,
  RECALCULATION_REASONS, earlierAssessmentLabel, humanize, latestCallLabel,
} from '@/lib/leadScoreLabels';

const n = (value) => (value ?? 0).toLocaleString();

function Row({ label, count, help, indent = false, testId }) {
  return (
    <li className={`flex items-baseline justify-between gap-3 py-0.5 ${indent ? 'pl-4 text-xs text-muted-foreground' : 'text-sm'}`}
      data-testid={testId} title={help}>
      <span>{indent ? `of which ${label}` : label}</span>
      <span className="ops-num tabular-nums">{n(count)}</span>
    </li>
  );
}

function Panel({ title, total, note, children, testId }) {
  return (
    <div className="rounded-lg border border-border p-3" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1">{children}</ul>
      {total && <p className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground" data-testid={`${testId}-total`}>{total}</p>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// "Of which" counts of a secondary badge, under the categories they belong to; only those present.
const LATEST_CALL_PARENTS = 'Assessed, Aged, Outdated or Assessed — Unknown';

/**
 * Settings → Lead scoring overview (GET /api/lead-scoring/overview): four separate panels over
 * the tenant's prospects.  Each panel counts every prospect once; panels are never added
 * together, and "of which" lines are never categories.
 */
export default function LeadScoringOverview({ data }) {
  if (!data) return null;
  const { classification: c, score_freshness: f, assessment: a, data_completeness: d } = data;
  const due = f.recalculation_due;
  const reasons = Object.entries(due).filter(([key, value]) => key !== 'total' && value > 0);
  return (
    <section className="space-y-3" aria-labelledby="lead-overview" data-testid="lead-overview">
      <div>
        <h3 id="lead-overview" className="text-sm font-semibold">Lead overview</h3>
        <p className="text-xs text-muted-foreground">
          {n(data.population)} prospects (not deleted or simulated) as of{' '}
          <RelativeTime iso={data.as_of} mode="absolute" />.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Classification" testId="panel-classification"
          total={`5 categories = ${n(data.population)} prospects`}>
          {Object.entries(CLASSIFICATION_LABELS).map(([key, meta]) => (
            <li key={key}>
              <ul>
                <Row label={meta.label} count={c[key]} help={meta.help} testId={`classification-${key}`} />
                {key === 'classified' && ['HOT', 'WARM', 'COLD'].map((band) => (
                  <Row key={band} indent label={band} count={c.classified_by_temperature?.[band]} />
                ))}
              </ul>
            </li>
          ))}
        </Panel>

        <Panel title="Score freshness" testId="panel-freshness"
          note="Stale scores keep their last calculated value for history; they are not current scores.">
          <Row label="Current" count={f.current} help="Classified + Provisional" testId="freshness-current" />
          <Row indent label="recalculation due" count={due.total} testId="freshness-due" />
          {reasons.map(([key, value]) => (
            <li key={key} className="flex justify-between pl-8 text-xs text-muted-foreground">
              <span>{RECALCULATION_REASONS[key] || humanize(key)}</span><span className="tabular-nums">{n(value)}</span>
            </li>
          ))}
          {reasons.length > 1 && <li className="pl-8 text-[11px] text-muted-foreground">A lead can have several reasons.</li>}
          <Row label="Stale" count={f.stale} testId="freshness-stale" />
          <Row indent label="can be recalculated now (Fit data is back)" count={f.stale_recalculable} />
        </Panel>

        <Panel title="Assessment" testId="panel-assessment"
          total={a ? `9 categories = ${n(a.total)} prospects` : null}
          note={a ? null : 'The assessment status is not available.'}>
          {a && ENGAGEMENT_ORDER.map((key) => (
            <li key={key}>
              <ul>
                <Row label={`${ENGAGEMENT_LABELS[key].icon} ${ENGAGEMENT_LABELS[key].label}`} count={a.categories[key]}
                  help={ENGAGEMENT_LABELS[key].help.replace('{T}', data.thresholds?.pending_timeout_minutes ?? 15)}
                  testId={`assessment-${key}`} />
                {key === 'pending' && a.categories.pending > 0 && (
                  <>
                    <Row indent label="being assessed" count={a.pending_breakdown.being_assessed} />
                    <Row indent label="waiting for review" count={a.pending_breakdown.waiting_for_review} />
                  </>
                )}
              </ul>
            </li>
          ))}
          {a && Object.entries(a.of_which_latest_call).filter(([, v]) => v > 0).map(([key, value]) => (
            <Row key={`latest-${key}`} indent label={`latest call ${latestCallLabel(key)} (within ${LATEST_CALL_PARENTS})`}
              count={value} testId={`of-which-latest-${key}`} />
          ))}
          {a && Object.entries(a.of_which_earlier_assessment).filter(([, v]) => v > 0).map(([key, value]) => (
            <Row key={`earlier-${key}`} indent
              label={`earlier assessment ${earlierAssessmentLabel(key)} (within Pending, No result recorded yet or Failed)`}
              count={value} testId={`of-which-earlier-${key}`} />
          ))}
        </Panel>

        <Panel title="Data Completeness (current scores)" testId="panel-completeness"
          total={`= ${n(f.current)} current scores`} note={COMPLETENESS_HELP}>
          {[...Object.entries(COMPLETENESS_LABELS), ['not_recorded', 'Not recorded']].map(([key, label]) => (
            <Row key={key} label={label} count={d[key]} testId={`completeness-${key}`} />
          ))}
        </Panel>
      </div>
    </section>
  );
}
