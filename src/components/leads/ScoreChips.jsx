import TemperatureChip from './TemperatureChip';
import ScoreFreshnessChip from './ScoreFreshnessChip';
import EngagementBadge from './EngagementBadge';

/**
 * The three chips beside a lead score in lists (AI Filter rows, campaign contacts), from the
 * backend's display fields: `temperature_display`, `freshness_indicator` and `assessment`
 * ({ engagement_label, latest_attempt_state, latest_attempt_confirmed, latest_attempt_reason,
 * secondary_badge }).  Display only: the number, filters, sorting and selection are unchanged.
 */
export default function ScoreChips({ chips, className = '' }) {
  if (!chips) return null;
  const assessment = chips.assessment;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} data-testid="score-chips">
      <TemperatureChip display={chips.temperature_display} />
      <ScoreFreshnessChip indicator={chips.freshness_indicator} />
      {assessment && (
        <EngagementBadge compact label={assessment.engagement_label}
          latestAttempt={{ state: assessment.latest_attempt_state, confirmed: assessment.latest_attempt_confirmed,
            reason: assessment.latest_attempt_reason }}
          secondaryBadge={assessment.secondary_badge} />
      )}
    </div>
  );
}
