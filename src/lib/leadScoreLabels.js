// Words for the lead score explanation.  The backend sends stable keys and the numbers
// (GET /api/lead-scores/{id}: explanation, data_completeness, recalculation); this file
// only names them.  An unknown key falls back to a readable form of itself, so a new
// factor never breaks the card.  Numbers are never changed here.

export const humanize = (key) => {
  const text = String(key ?? '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const FEATURE_LABELS = {
  seniority: 'Seniority',
  company_employee_count: 'Company size',
  department: 'Department',
  intent_customer_status: 'Call intent',
  company_industry: 'Industry',
  company_country: 'Country',
  company_annual_revenue: 'Annual revenue',
};

export const GROUP_LABELS = { fit: 'Fit', engagement: 'Engagement' };

const VALUE_LABELS = {
  'owner/founder': 'Owner/Founder',
  'c-level': 'C-level',
  vp: 'VP',
  director: 'Director',
  manager: 'Manager',
  senior: 'Senior',
  entry: 'Entry',
  it: 'IT',
  hr: 'HR',
  high_intent: 'High intent',
  medium_intent: 'Medium intent',
  nurture: 'Nurture',
  low_intent: 'Low intent',
  unknown: 'Inconclusive',
  no_intent: 'Not interested',
  disqualified: 'Disqualified',
};

export const featureLabel = (feature) => FEATURE_LABELS[feature] || humanize(feature);
export const groupLabel = (group) => GROUP_LABELS[group] || humanize(group);

// Methodology band labels, as the backend writes them: "50 to < 1000", "< 10", ">= 1000".
const bandLabel = (value) => {
  const range = /^(\d+(?:\.\d+)?) to < (\d+(?:\.\d+)?)$/.exec(value);
  if (range) return `${range[1]}–${Number(range[2]) - 1}`;
  const below = /^< (\d+(?:\.\d+)?)$/.exec(value);
  if (below) return `under ${below[1]}`;
  const atLeast = /^>= (\d+(?:\.\d+)?)$/.exec(value);
  if (atLeast) return `${atLeast[1]}+`;
  return null;
};

export const valueLabel = (feature, value) => {
  if (value == null || value === '') return null;
  const text = String(value);
  if (feature === 'company_employee_count') {
    const band = bandLabel(text);
    if (band) return `${band} employees`;
  }
  return VALUE_LABELS[text.toLowerCase()] || humanize(text);
};

// How a factor without a value was counted (explanation factor "treatment").
export const TREATMENT_TEXT = {
  left_out_rescaled: 'Left out: the other factors in this group share its points.',
  zero_below_coverage: 'Counted as 0: less than half of this group is known.',
  zero: 'Counted as 0. This is not evidence of low interest.',
};

export const INDICATORS = {
  strong: { icon: '✔', label: 'Strong' },
  partial: { icon: '◐', label: 'Partial' },
  weak: { icon: '✖', label: 'Weak' },
  unavailable: { icon: '?', label: 'Information unavailable' },
  inconclusive: { icon: '?', label: 'Inconclusive' },
  turned_off: { icon: '⊘', label: 'Turned off' },
};

export const COMPLETENESS_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
export const COMPLETENESS_DOTS = { high: '●●●', medium: '●●○', low: '●○○' };
export const COMPLETENESS_HELP =
  'How much of the scoring information was available. It does not predict whether the lead will convert.';

export const RECALCULATION_REASONS = {
  settings_changed: 'scoring settings changed',
  methodology_changed: 'the scoring method changed',
  new_intent: 'a newer call was assessed',
  intent_aged: 'the call intent has aged',
  details_changed: 'lead details changed',
  demo_score: 'demo score with no recorded calculation',
};

export const PROVISIONAL_REASONS = {
  not_contacted: 'No calls yet.',
  not_assessed: 'No call could be assessed yet.',
  inconclusive_assessment: 'The latest accepted assessment was inconclusive.',
  assessment_pending: 'An assessment is still pending.',
  no_result_recorded: 'No assessment result has been recorded yet; this is not a confirmed failure.',
  assessment_failed: 'The latest assessment failed. This is not the lead saying no.',
  assessment_status_unavailable: 'The assessment status could not be checked.',
};

// The nine assessment categories (engagement_label), in the order they are decided.
export const ENGAGEMENT_LABELS = {
  assessed: { icon: '✔', label: 'Assessed', help: 'A definite call assessment from the last 90 days.' },
  aged: { icon: '◷', label: 'Aged', help: 'A definite call assessment 91–180 days old.' },
  outdated: { icon: '⌛', label: 'Outdated', help: 'The last definite call assessment is more than 180 days old.' },
  assessed_unknown: { icon: '?', label: 'Assessed — Unknown',
    help: 'The latest accepted assessment was inconclusive: not evidence of buying interest.' },
  not_contacted: { icon: '○', label: 'Not contacted', help: 'No calls and no assessment yet.' },
  pending: { icon: '⏳', label: 'Pending', help: 'The latest call is being assessed or waiting for review.' },
  no_result_recorded: { icon: '⧗', label: 'No result recorded yet',
    help: 'The call ended more than {T} minutes ago and no assessment result has been recorded. '
      + 'This is not a confirmed failure; the result may still arrive.' },
  failed: { icon: '⚠', label: 'Failed',
    help: 'The assessment of the latest call failed and the failure was recorded. This is not the lead saying no.' },
  not_assessed: { icon: '–', label: 'Not assessed',
    help: 'Calls were made but none could be assessed (not answered, rejected in review, or assessment off).' },
};
export const ENGAGEMENT_ORDER = Object.keys(ENGAGEMENT_LABELS);

// Secondary badges: what the primary category does not show.  Never a category of its own.
const LATEST_CALL_STATES = {
  pending: 'Pending',
  no_result_recorded: 'No result recorded yet',
  failed: 'Failed',
  rejected: 'Rejected',
  skipped: 'Not assessed',
  unrecognized: 'Unrecognised result',
};
const EARLIER_STATES = { outdated: 'Outdated', unknown: 'Unknown', unrecognized: 'Unrecognised' };

// Why a call was not assessed, as its attempt recorded it (intent_assessment_attempts.reason).
export const SKIP_REASONS = {
  disabled_by_config: 'assessment turned off',
  call_not_answered: 'not answered',
  missing_transcript: 'no transcript',
  missing_verified_prospect: 'no verified lead',
  shared_identity_prospect_mismatch: 'linked to another lead',
  already_reviewed: 'already reviewed',
};

export const latestCallLabel = (state, reason) => {
  if (state === 'skipped') {
    const why = SKIP_REASONS[reason] || (reason ? humanize(reason).toLowerCase() : null);
    return why ? `Not assessed (${why})` : 'Not assessed';
  }
  return LATEST_CALL_STATES[state] || humanize(state);
};
export const earlierAssessmentLabel = (state) => EARLIER_STATES[state] || humanize(state);

// `reason`: the latest attempt's reason, which names why a skipped call was not assessed.
export const secondaryBadgeText = (badge, reason) => {
  if (!badge) return null;
  if (badge.kind === 'latest_call') return `Latest call: ${latestCallLabel(badge.state, reason)}`;
  const days = badge.age_days != null && badge.state === 'outdated' ? ` (${badge.age_days} days)` : '';
  return `Earlier assessment: ${earlierAssessmentLabel(badge.state)}${days}`;
};

export const FRESHNESS = {
  recalculation_due: { label: 'RECALCULATION DUE', help: 'The stored score no longer reflects the current details or settings.' },
  out_of_date: { label: 'OUT OF DATE', help: 'A historical value, not a current score: the lead has no Fit data to rescore it.' },
};

export const CLASSIFICATION_LABELS = {
  classified: { label: 'Classified', help: 'Current score with a temperature (HOT, WARM or COLD).' },
  provisional: { label: 'Provisional', help: 'Current score, but not enough reliable conversation information to rate it.' },
  stale: { label: 'Stale', help: 'A historical score value, not a current score: the lead no longer has the Fit data needed.' },
  pending_calculation: { label: 'Pending Calculation', help: 'Can be scored; not calculated yet.' },
  no_score_recorded: { label: 'No Score Recorded',
    help: "Can't be scored until seniority, department or company size is added." },
};

export const PROVISIONAL_HELP =
  'Not enough reliable conversation information to rate this lead yet. The number is mainly based on fit.';

// Recalculation reasons and cap reasons as one readable sentence.
export const describeReasons = (reasons = []) =>
  reasons.map((reason) => RECALCULATION_REASONS[reason] || humanize(reason)).join('; ');

// Why Data Completeness is shown at most Medium (data_completeness.cap_reason).
const CAP_ATTEMPT = {
  processing: 'is still being assessed',
  pending_review: 'is waiting for review',
  no_result_recorded: 'has no recorded result yet',
  failed: 'could not be assessed',
  unrecognized: 'has an unrecognised assessment',
};
const CAP_ENGAGEMENT = {
  not_contacted: 'not contacted',
  not_assessed: 'not assessed',
  assessed_unknown: 'inconclusive assessment',
  pending: 'assessment pending',
  no_result_recorded: 'no assessment result yet',
  failed: 'assessment failed',
};

export const describeCap = (capReason) => {
  if (!capReason) return null;
  if (capReason.startsWith('latest_attempt_')) {
    const state = capReason.slice('latest_attempt_'.length);
    return `shown as Medium at most while the latest call ${CAP_ATTEMPT[state] || humanize(state).toLowerCase()}`;
  }
  if (capReason.startsWith('engagement_')) {
    const label = capReason.slice('engagement_'.length);
    return `shown as Medium at most: ${CAP_ENGAGEMENT[label] || humanize(label).toLowerCase()}`;
  }
  return humanize(capReason);
};
