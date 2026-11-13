import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getConversionHistory } from '@/lib/api';
import { humanize } from '@/lib/leadScoreLabels';

// The lead's latest qualification result (GET /api/ai/conversion/prospects/{id}/history):
// the policy outcome, and each criterion (budget, business need, ...) as the evaluation saw it.

const OUTCOME = {
  QUALIFIED: { text: 'Qualified', color: 'text-[hsl(173,80%,36%)]' },
  NOT_QUALIFIED: { text: 'Not qualified', color: 'text-[hsl(0,72%,52%)]' },
  INSUFFICIENT_EVIDENCE: { text: 'Needs more evidence', color: 'text-[hsl(38,92%,65%)]' },
  REVIEW_REQUIRED: { text: 'Review required', color: 'text-[hsl(38,92%,65%)]' },
};

const CRITERION = {
  PASS: { icon: '✔', text: 'verified' },
  FAIL: { icon: '✖', text: 'not met' },
  EXPIRED: { icon: '⌛', text: 'evidence expired' },
  CONTRADICTED: { icon: '⚠', text: 'conflicting evidence' },
  UNVERIFIED: { icon: '?', text: 'not verified yet' },
  UNKNOWN: { icon: '?', text: 'no evidence' },
};

const CRITERION_LABEL = { BUDGET_CONFIRMED: 'Budget', BUSINESS_NEED: 'Business need' };

const DECISION = {
  PENDING_APPROVAL: 'waiting for approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTED: 'applied',
};

const lower = (value) => humanize(value).toLowerCase();

export default function QualificationCard({ prospectId }) {
  const [item, setItem] = useState(undefined); // undefined: loading, null: none
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setItem(undefined);
    setFailed(false);
    getConversionHistory(prospectId, { page: 1, page_size: 1 })
      .then((r) => { if (live) setItem(r.data.items?.[0] || null); })
      .catch(() => { if (live) { setItem(null); setFailed(true); } });
    return () => { live = false; };
  }, [prospectId]);

  const outcome = item && (OUTCOME[item.qualification_status] || { text: humanize(item.qualification_status || 'not evaluated'), color: '' });
  const target = item?.target_stage && item.target_stage !== item.current_stage ? ` to ${lower(item.target_stage)}` : '';
  const decision = item && (DECISION[item.decision_status] || lower(item.decision_status));

  return (
    <section className="mb-5 rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3" aria-label="Qualification" data-testid="qualification-card">
      <p className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="w-3 h-3" /> Qualification</p>
      {item === undefined ? (
        <p className="text-xs text-muted-foreground">Loading qualification...</p>
      ) : !item ? (
        <p className="text-xs text-muted-foreground">
          {failed ? 'Could not load the qualification result.' : 'Not evaluated yet: no qualification has been run for this lead.'}
        </p>
      ) : (
        <div className="space-y-1.5 text-xs">
          <p>
            <span className={`font-semibold ${outcome.color}`}>{outcome.text}</span>
            <span className="text-muted-foreground"> · evaluated {new Date(item.created_at).toLocaleDateString()}</span>
          </p>
          {item.criteria?.length > 0 && (
            <ul className="space-y-0.5">
              {item.criteria.map((c) => {
                const state = CRITERION[c.status] || { icon: '?', text: lower(c.status) };
                return (
                  <li key={c.code} data-testid={`criterion-${c.code}`}>
                    <span className="mr-1" aria-hidden="true">{state.icon}</span>
                    <span className="font-medium">{CRITERION_LABEL[c.code] || humanize(c.code)}</span>
                    <span className="text-muted-foreground">: {state.text}{c.source_type ? ` (${lower(c.source_type)})` : ''}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {item.decision_type === 'ADVANCE_STAGE' && (
            <p className="text-muted-foreground">Proposed stage change{target}: {decision}.</p>
          )}
          {item.reason_codes?.length > 0 && (
            <p className="text-muted-foreground">Reasons: {item.reason_codes.map(lower).join(', ')}.</p>
          )}
        </div>
      )}
    </section>
  );
}
