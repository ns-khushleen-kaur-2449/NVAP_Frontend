// Prospects are the only person record.  Older screens render "lead" rows, so these
// helpers turn a prospect (GET /api/v1/prospects) into that row shape.

// The score comes from lead_score_summary (GET /api/v1/prospects?include=score_summary, or
// the prospect detail); its temperature and assessment are read from the summaries, never
// from the number.
const scoreOf = (p) => p.lead_score_summary?.lead_score ?? p.lead_score;

export const toLeadRow = (p) => ({
  ...(p.custom_fields || {}),
  ...p,
  id: p.prospect_id,
  name: p.full_name || '',
  stage: (p.stage || '').toLowerCase(),
  status: p.is_lead ? 'lead' : 'prospect',
  ai_score: scoreOf(p) == null ? null : Math.round(scoreOf(p)),
});

// What the Leads list asks the prospect API to add to each row.
export const LIST_INCLUDE = 'score_summary,assessment_status';

// prospect_stage_events -> the Timeline component's event shape.
export const stageEventsToTimeline = (events = []) =>
  events.map((e) => ({
    id: e.id,
    event_type: 'stage_change',
    title: e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `Created as ${e.to_stage}`,
    description: e.reason,
    created_at: e.created_at,
  }));
