import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { getLeadScore, getLeadScoreHistory, calculateLeadScore, getProspectAssessmentStatus } from '@/lib/api';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import DataCompleteness from './DataCompleteness';
import WhyThisScore from './WhyThisScore';
import TemperatureChip, { FALLBACK_COLOR, TEMPERATURE_COLOR } from './TemperatureChip';
import EngagementBadge from './EngagementBadge';
import ScoreFreshnessChip from './ScoreFreshnessChip';
import { PROVISIONAL_HELP, PROVISIONAL_REASONS, describeReasons } from '@/lib/leadScoreLabels';

// The temperature to show comes from the backend (temperature_display): HOT / WARM / COLD,
// or PROVISIONAL when there is not enough reliable conversation information.

// "Assessed 46 days ago": the accepted intent's age, beside the assessment badge.
const intentAge = (accepted) => {
  if (!accepted || accepted.age_days == null) return null;
  return accepted.age_days === 0 ? 'Assessed today' : `Assessed ${accepted.age_days} day${accepted.age_days === 1 ? '' : 's'} ago`;
};

// The assessment status, shown for scored and unscored leads alike.
const AssessmentLine = ({ status }) => {
  if (!status?.engagement_label) return null;
  const age = intentAge(status.accepted_intent);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="assessment-status">
      <EngagementBadge label={status.engagement_label} latestAttempt={status.latest_attempt}
        secondaryBadge={status.secondary_badge} thresholds={status.thresholds} />
      {age && <span className="text-xs text-muted-foreground" data-testid="intent-age">{age}</span>}
    </div>
  );
};

const label = (s) => String(s ?? '').replace(/_/g, ' ');

// FastAPI errors: a string, or {message, missing_features} for 422.
const errorText = (e, fallback) => {
  const detail = e.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const missing = detail.missing_features?.length ? ` Missing: ${detail.missing_features.map(label).join(', ')}.` : '';
    return `${detail.message || fallback}${missing}`;
  }
  return fallback;
};

// The live layer: how the score reads now (separate from how it was calculated).
const NowLayer = ({ score }) => {
  const shown = score.temperature_display;
  const completeness = score.data_completeness;
  const recalculation = score.recalculation;
  return (
    <div className="mt-4 space-y-1.5 border-t border-border pt-3" data-testid="score-now">
      <p className="text-xs font-semibold">Now</p>
      {shown?.provisional && (
        <p className="text-xs text-muted-foreground" data-testid="provisional-reason">
          Provisional: {PROVISIONAL_REASONS[shown.reason] || label(shown.reason)} {PROVISIONAL_HELP}
        </p>
      )}
      {score.freshness_indicator === 'out_of_date' && (
        <p className="text-xs text-[hsl(38,92%,65%)]" data-testid="out-of-date">
          Out of date: this is the last calculated value, not a current score.
          {recalculation?.due ? ' Its details are back, so it can be recalculated.' : ' It cannot be recalculated until seniority, department or company size is known.'}
        </p>
      )}
      {score.freshness_indicator === 'recalculation_due' && (
        <p className="text-xs text-[hsl(38,92%,65%)]" data-testid="recalculation-due">
          Recalculation due: {describeReasons(recalculation?.reasons)}.
        </p>
      )}
      {completeness && (
        <DataCompleteness recorded={completeness.recorded} level={completeness.display_level}
          capReason={completeness.cap_reason} />
      )}
    </div>
  );
};

// One card: the lead's quick info (children), its current Fit + Engagement score and why.
const LeadScorePanel = ({ prospectId, onScored, children }) => {
  const [score, setScore] = useState(null);
  // For a lead without a score: its assessment status (GET /api/intent-assessment/prospects/{id}/status).
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [opened, setOpened] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setScore(null);
    setStatus(null);
    setEvents([]);
    setOpened(null);
    setMessage('');
    try {
      const r = await getLeadScore(prospectId);
      setScore(r.data);
      try {
        const h = await getLeadScoreHistory(prospectId, { page: 1, page_size: 5 });
        setEvents(h.data.items || []);
      } catch { /* the history list is optional */ }
    } catch (e) {
      if (e.response?.status !== 404) setMessage(errorText(e, 'Could not load the lead score.'));
      else {
        try { setStatus((await getProspectAssessmentStatus(prospectId)).data); } catch { /* optional */ }
      }
    }
    setLoading(false);
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  const calculate = async () => {
    setCalculating(true);
    try {
      const r = await calculateLeadScore(prospectId);
      setScore(r.data.current_score);
      setMessage('');
      onScored?.(r.data.current_score);
      if (r.data.is_current === false) toast.info('A newer score already exists; showing it.');
      else toast.success('Lead score updated');
      const h = await getLeadScoreHistory(prospectId, { page: 1, page_size: 5 }).catch(() => null);
      setEvents(h?.data.items || [r.data.calculation]);
      setOpened(null);
    } catch (e) {
      toast.error(errorText(e, 'Could not calculate a score for this lead.'));
    }
    setCalculating(false);
  };

  const shown = score?.temperature_display;
  const displayLabel = shown?.label || null;
  const color = TEMPERATURE_COLOR[displayLabel] || FALLBACK_COLOR;
  const rounded = score ? Math.round(score.lead_score) : null;
  const openedEvent = events.find((ev) => ev.score_history_id === opened);

  return (
    <section className="mb-5 w-full min-w-0 break-words rounded-xl border border-border bg-[hsl(var(--surface-2))] p-4" aria-label="Lead score">
      {children && <div className="mb-4 border-b border-border pb-4">{children}</div>}

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Lead Score</h4>
        <Button variant="outline" size="sm" onClick={calculate} disabled={calculating || loading} data-testid="calculate-score">
          <RefreshCw className={`w-3 h-3 mr-1 ${calculating ? 'animate-spin' : ''}`} />
          {score ? 'Recalculate' : 'Calculate score'}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading score...</p>
      ) : !score ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{message || 'This lead has not been scored yet.'}</p>
          <AssessmentLine status={status} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ScoreGauge score={rounded} size={100} color={color} label={displayLabel || 'Score'} />
            <div className="flex-1 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <TemperatureChip display={shown} />
                <span className="text-xs text-muted-foreground">out of 100</span>
                <span className="text-xs text-muted-foreground" data-testid="score-status">
                  · {score.status === 'stale' ? 'Stale'
                    : score.freshness_indicator === 'recalculation_due' ? 'Recalculation due' : 'Current'}
                </span>
                <ScoreFreshnessChip indicator={score.freshness_indicator} />
              </div>
              <AssessmentLine status={score} />
              {score.intent_level && <div><span className="text-muted-foreground">Intent:</span> <span className="capitalize">{label(score.intent_level)}</span></div>}
              {score.recommended_action && <div><span className="text-muted-foreground">Next action:</span> <span className="capitalize">{label(score.recommended_action)}</span></div>}
              <div className="text-xs text-muted-foreground">Scored {new Date(score.calculated_at).toLocaleString()}</div>
            </div>
          </div>

          <NowLayer score={score} />

          <div className="mt-4 border-t border-border pt-3" data-testid="score-calculation">
            <p className="text-xs font-semibold">How this score was calculated</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Calculated {new Date(score.calculated_at).toLocaleString()} with the settings in force then.
            </p>
            <WhyThisScore explanation={score.explanation} score={score} />
          </div>


          {events.length > 0 && (
            <div className="mt-4 border-t border-border pt-3" data-testid="score-history">
              <p className="text-xs text-muted-foreground mb-1.5">Recent scores (historical: as calculated then)</p>
              <ul className="space-y-1 text-xs">
                {events.map((ev) => (
                  <li key={ev.score_history_id}>
                    <button type="button" className="flex w-full justify-between text-muted-foreground hover:text-foreground"
                      aria-expanded={opened === ev.score_history_id}
                      onClick={() => setOpened(opened === ev.score_history_id ? null : ev.score_history_id)}>
                      <span>Historical · {new Date(ev.calculated_at).toLocaleDateString()}</span>
                      <span className="tabular-nums">{Math.round(ev.lead_score)}{ev.temperature ? ` · ${ev.temperature}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {openedEvent && (
                <div className="mt-2 rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Historical score calculated {new Date(openedEvent.calculated_at).toLocaleString()}; shown as recorded then.
                  </p>
                  <WhyThisScore explanation={openedEvent.explanation_view} historical />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default LeadScorePanel;
