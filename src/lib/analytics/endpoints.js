/**
 * Every Dashboard and Reports section, the GET endpoint that serves it, and where its data comes from today.
 *
 * One endpoint serves every role: the backend reads the caller's role and tenant from the token and scopes the
 * answer (a Sales Rep their own prospects, a Manager their team, a Tenant Admin the whole tenant). The frontend
 * never filters by role. Reports requests carry the selected filters as query parameters (see toParams).
 *
 * `source`:
 *   'live'        — call the backend.
 *   'mock'        — the endpoint is not built yet; analytics/mockData.js answers instead, same shape.
 *   'unavailable' — the data is not recorded at all yet (the specification's "Not have" / "Partial");
 *                   the section shows "Data not available yet" with `reason`.
 * Switching a section to the real API is a one-word change here: source: 'live'.
 */
const NO_SLA_TARGET = 'SLA targets are not configured in SmartSDR yet, so on-time shares cannot be calculated.';
const NO_AI_COST = 'AI usage and cost are not recorded per request yet.';
const NO_ADOPTION = 'Feature usage per user is not tracked yet.';
const NO_USAGE = 'Plan limits and metered usage are not tracked yet.';

export const ENDPOINTS = {
  // Dashboard (route /dashboard)
  kpis:               { path: '/api/v1/dashboard/kpis', source: 'mock' },
  actionItems:        { path: '/api/v1/dashboard/action-items', source: 'mock' },
  priorityProspects:  { path: '/api/v1/dashboard/priority-prospects', source: 'mock' },
  upcomingMeetings:   { path: '/api/v1/dashboard/upcoming-meetings', source: 'mock' },
  nextBestActions:    { path: '/api/v1/dashboard/next-best-actions', source: 'mock' },
  funnel:             { path: '/api/v1/dashboard/funnel', source: 'mock' },
  conversationFeed:   { path: '/api/v1/dashboard/conversation-feed', source: 'mock' },
  campaigns:          { path: '/api/v1/dashboard/campaigns', source: 'mock' },
  leaderboard:        { path: '/api/v1/dashboard/leaderboard', source: 'mock' },
  workload:           { path: '/api/v1/dashboard/workload', source: 'mock' },
  coaching:           { path: '/api/v1/dashboard/coaching', source: 'mock' },
  aiUsage:            { path: '/api/v1/dashboard/ai-usage', source: 'unavailable', reason: NO_AI_COST },
  integrationHealth:  { path: '/api/v1/dashboard/integration-health', source: 'mock' },
  featureAdoption:    { path: '/api/v1/dashboard/feature-adoption', source: 'unavailable', reason: NO_ADOPTION },
  modelHealth:        { path: '/api/v1/dashboard/model-health', source: 'mock' },
  compliance:         { path: '/api/v1/dashboard/compliance', source: 'mock' },
  aiFeatures:         { path: '/api/v1/dashboard/ai-features', source: 'mock' },
  subscriptionUsage:  { path: '/api/v1/dashboard/subscription-usage', source: 'unavailable', reason: NO_USAGE },
  auditActivity:      { path: '/api/v1/dashboard/audit-activity', source: 'mock' },

  // Reports & Analytics (route /reports); all take the filter query parameters
  reportKpis:         { path: '/api/v1/reports/kpis', source: 'mock' },
  slaTrend:           { path: '/api/v1/reports/sla-trend', source: 'unavailable', reason: NO_SLA_TARGET },
  lateItems:          { path: '/api/v1/reports/late-items', source: 'mock' },
  reportFunnel:       { path: '/api/v1/reports/funnel', source: 'mock' },
  scoreBands:         { path: '/api/v1/reports/score-bands', source: 'mock' },
  missedLeads:        { path: '/api/v1/reports/missed-leads', source: 'mock' },
  campaignPerformance:{ path: '/api/v1/reports/campaign-performance', source: 'mock' },
  channelPerformance: { path: '/api/v1/reports/channel-performance', source: 'mock' },
  meetingOutcomes:    { path: '/api/v1/reports/meeting-outcomes', source: 'mock' },
  dailyActivity:      { path: '/api/v1/reports/daily-activity', source: 'mock' },
  intentMix:          { path: '/api/v1/reports/intent-mix', source: 'mock' },
  responseByRep:      { path: '/api/v1/reports/response-by-rep', source: 'mock' },
  repConversion:      { path: '/api/v1/reports/rep-conversion', source: 'mock' },
  repActivity:        { path: '/api/v1/reports/rep-activity', source: 'mock' },
  repMeetingOutcomes: { path: '/api/v1/reports/rep-meeting-outcomes', source: 'mock' },
  repPerformance:     { path: '/api/v1/reports/rep-performance', source: 'mock' },
  teamPerformance:    { path: '/api/v1/reports/team-performance', source: 'mock' },
  aiCost:             { path: '/api/v1/reports/ai-cost', source: 'unavailable', reason: NO_AI_COST },
  scoringCalibration: { path: '/api/v1/reports/scoring-calibration', source: 'mock' },
  scoreFreshness:     { path: '/api/v1/reports/score-freshness', source: 'mock' },
  adoptionTrend:      { path: '/api/v1/reports/adoption-trend', source: 'unavailable', reason: NO_ADOPTION },
  integrationFailures:{ path: '/api/v1/reports/integration-failures', source: 'mock' },
  failureLog:         { path: '/api/v1/reports/failure-log', source: 'mock' },
  consentStatus:      { path: '/api/v1/reports/consent-status', source: 'mock' },
  auditLog:           { path: '/api/v1/reports/audit-log', source: 'mock' },
  planUsage:          { path: '/api/v1/reports/plan-usage', source: 'unavailable', reason: NO_USAGE },
  export:             { path: '/api/v1/reports/export', source: 'mock' },
};

// Individual KPI tiles whose number depends on data that does not exist yet; the KPI endpoints return them
// with `unavailable` set so the tile can say why.
export const UNAVAILABLE_REASON = { sla: NO_SLA_TARGET, aiCost: NO_AI_COST, adoption: NO_ADOPTION };
