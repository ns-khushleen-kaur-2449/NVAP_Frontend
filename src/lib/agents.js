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

/** `GET /api/v1/agents/{id}/health` problem codes, in words.  An unknown code is shown as it is. */
export const AGENT_PROBLEM_LABELS = Object.freeze({
  no_code_pack: 'No code for this agent on this server',
  vapi_not_configured: 'Vapi is not configured',
  phone_number_not_configured: 'No calling phone number is configured',
  server_url_not_public_https: 'The server URL is not a public HTTPS address, so Vapi cannot reach it',
  webhook_secret_not_set: 'The Vapi webhook secret is not set',
  campaign_runner_disabled: 'Campaign runner is off on this server',
});

export const problemLabel = (code) => AGENT_PROBLEM_LABELS[code] || code;

/** One health answer as the catalog shows it: `ready`, `attention`, `no_code`, or `unknown` (the check failed). */
export const healthState = (health) => {
  if (!health) return 'unknown';
  if (!health.has_code) return 'no_code';
  return health.ok ? 'ready' : 'attention';
};

export const accessSummary =(agent) => (agent?.access_scope === 'all' ? 'All organisations' : 'Selected organisations');
