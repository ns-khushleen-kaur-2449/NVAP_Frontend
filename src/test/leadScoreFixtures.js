// API responses for the lead score explanation tests, shaped as the backend returns them
// (GET /api/lead-scores/{id} and its history; numbers from the shipped methodology's own output).

export const HASH = 'b9c23b9a1c7fab83c360ee0761919cf53b3b15a2fe1cca746675dbf574025fab';

export const BANDS = [
  { label: 'HOT', min: 70, max: 100 },
  { label: 'WARM', min: 40, max: 69 },
  { label: 'COLD', min: 0, max: 39 },
];

// S7: Director, 120 employees, department unknown, medium intent 45 days ago.
export const S7_EXPLANATION = {
  available: true,
  snapshot_version: 1,
  methodology_version: 'fit-engagement-v2',
  calculated_at: '2026-11-02T10:14:00Z',
  formula: 'round(sum over groups ...)',
  unrounded: 71.6,
  rounded: 72,
  temperature_at_calculation: 'HOT',
  turned_off: [],
  not_scored: { verified_email: false, has_email: true, has_phone: false },
  configuration: {
    config_hash: HASH, tenant_override: false, disabled: [], base_weights: null,
    effective_weights: { seniority: 30, company_employee_count: 15, department: 15, intent_customer_status: 40 },
    group_weights: { fit: 60, engagement: 40 },
    recorded_in_full: true, configuration_schema_version: 1, hash_algorithm: 'sha256-canonical-json-v1',
    hash: HASH, hash_verified: true, temperature_bands: BANDS,
    freshness_bands: {
      intent_customer_status: [
        { max_days: 30, multiplier: 1 }, { max_days: 90, multiplier: 0.7 }, { max_days: 180, multiplier: 0.4 },
        { multiplier: 0.2 },
      ],
    },
  },
  data_completeness: { recorded: true, level: 'medium', evidence_points: 73, fit_known_weight: 45, engagement_evidence: 28 },
  assessment_state: { recorded: true, engagement_label: 'assessed' },
  groups: [
    {
      group: 'fit', earned: 52, possible: 60, coverage: 0.75, min_coverage: 0.5, below_min_coverage: false,
      rescaled: true, scored_weight: 45,
      factors: [
        { feature: 'seniority', status: 'matched', value: 'director', indicator: 'strong', earned: 32, possible: 40,
          weight: 30, rating: 0.8, treatment: null },
        { feature: 'company_employee_count', status: 'matched', value: '50 to < 1000', indicator: 'strong', earned: 20,
          possible: 20, weight: 15, rating: 1, treatment: null },
        { feature: 'department', status: 'missing', value: null, indicator: 'unavailable', earned: null, possible: null,
          weight: 15, rating: null, treatment: 'left_out_rescaled',
          note: 'Department is not known; this is not evidence of poor fit.' },
      ],
    },
    {
      group: 'engagement', earned: 19.6, possible: 40, coverage: 1, min_coverage: 0.5, below_min_coverage: false,
      rescaled: false, scored_weight: 40,
      factors: [
        { feature: 'intent_customer_status', status: 'matched', value: 'medium_intent', indicator: 'partial', earned: 19.6,
          possible: 40, weight: 40, rating: 0.7, treatment: null,
          freshness: { age_days: 45, status: 'known', band: '31 to 90 days', multiplier: 0.7 } },
      ],
    },
  ],
};

// An engine score recorded before snapshots: only what it stored.
export const PRE_SNAPSHOT_EXPLANATION = {
  ...S7_EXPLANATION,
  snapshot_version: null,
  configuration: {
    config_hash: HASH, tenant_override: false, disabled: [],
    effective_weights: S7_EXPLANATION.configuration.effective_weights,
    group_weights: S7_EXPLANATION.configuration.group_weights,
    recorded_in_full: false, temperature_bands: null, freshness_bands: null,
  },
  data_completeness: { recorded: false },
  assessment_state: { recorded: false },
};

// Manager, 20 employees, IT, accepted "unknown" intent: 39.5 rounds to 40.
export const UNKNOWN_EXPLANATION = {
  ...S7_EXPLANATION,
  unrounded: 39.5,
  rounded: 40,
  temperature_at_calculation: 'WARM',
  data_completeness: { recorded: true, level: 'medium', evidence_points: 60 },
  groups: [
    {
      group: 'fit', earned: 31.5, possible: 60, coverage: 1, min_coverage: 0.5, below_min_coverage: false,
      rescaled: false, scored_weight: 60,
      factors: [
        { feature: 'seniority', value: 'manager', indicator: 'partial', earned: 15, possible: 30, weight: 30, rating: 0.5 },
        { feature: 'company_employee_count', value: '10 to < 50', indicator: 'partial', earned: 7.5, possible: 15,
          weight: 15, rating: 0.5 },
        { feature: 'department', value: 'it', indicator: 'partial', earned: 9, possible: 15, weight: 15, rating: 0.6 },
      ],
    },
    {
      group: 'engagement', earned: 8, possible: 40, coverage: 1, min_coverage: 0.5, below_min_coverage: false,
      rescaled: false, scored_weight: 40,
      factors: [
        { feature: 'intent_customer_status', value: 'unknown', indicator: 'inconclusive', earned: 8, possible: 40,
          weight: 40, rating: 0.2, freshness: { age_days: 3, status: 'known', multiplier: 1 } },
      ],
    },
  ],
};

export const currentScore = (overrides = {}) => ({
  score_id: 's1', tenant_id: 't1', prospect_id: 'p1', lead_score: 72, scoring_method: 'fit_engagement',
  temperature: 'HOT', status: 'current', stale_reason: null, calculated_at: '2026-11-02T10:14:00Z',
  temperature_display: { label: 'HOT', provisional: false, reason: null },
  data_completeness: { recorded: true, stored_level: 'medium', display_level: 'medium', evidence_points: 73, cap_reason: null },
  recalculation: { due: false, reasons: [] },
  freshness_indicator: null,
  score_history_id: 'h-current',
  explanation: S7_EXPLANATION,
  eligibility: null,
  ...overrides,
});

export const historyItem = (id, explanation, overrides = {}) => ({
  score_history_id: id, prospect_id: 'p1', lead_score: explanation.rounded, temperature: explanation.temperature_at_calculation,
  calculated_at: explanation.calculated_at, explanation_view: explanation, ...overrides,
});
