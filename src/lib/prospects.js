// Prospects are the only person record.  Older screens render "lead" rows, so these
// helpers turn a prospect (GET /api/v1/prospects) into that row shape.

export const toLeadRow = (p) => ({
  ...(p.custom_fields || {}),
  ...p,
  id: p.prospect_id,
  name: p.full_name || '',
  stage: (p.stage || '').toLowerCase(),
  status: p.is_lead ? 'lead' : 'prospect',
});

// prospect_stage_events -> the Timeline component's event shape.
export const stageEventsToTimeline = (events = []) =>
  events.map((e) => ({
    id: e.id,
    event_type: 'stage_change',
    title: e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `Created as ${e.to_stage}`,
    description: e.reason,
    created_at: e.created_at,
  }));
