/**
 * Where each catalog agent lives in the app.
 *
 * The backend decides which agents a user may use (`GET /api/v1/agents/available`); this only says which
 * screen opens an agent. An agent with no entry here is listed but cannot be opened yet, so a newly added
 * agent never produces a broken link.
 */
export const AGENT_ROUTES = Object.freeze({
  sdr: '/voice_agent',
});

export const agentRoute = (agent) => AGENT_ROUTES[agent?.key] || null;

export const AGENT_STATUS_LABELS = Object.freeze({ draft: 'Draft', active: 'Active', retired: 'Retired' });

/** What a Super Admin may change a status to; an agent only reaches tenants while it is active. */
export const AGENT_STATUS_ACTIONS = Object.freeze({
  draft: ['active'],
  active: ['draft', 'retired'],
  retired: ['active'],
});

export const accessSummary = (agent) => (agent?.access_scope === 'all' ? 'All organisations' : 'Selected organisations');
