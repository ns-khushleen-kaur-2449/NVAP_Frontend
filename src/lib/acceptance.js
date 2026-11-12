/**
 * Pre-activation acceptance checklist (architecture doc §18).
 * An agent cannot move Testing → Ready until every applicable item passes.
 * Item ids are stable so the backend can report pass/fail per id.
 */
import { AGENT_TYPES } from '../config/agents';

const ALL_AGENTS = [
  { id: 'e2e_call', label: 'Test call completes end-to-end through Twilio → Vapi → ElevenLabs' },
  { id: 'transcript_disposition', label: 'Transcript and disposition are recorded correctly' },
  { id: 'human_handoff', label: 'Human handoff works and carries a correct context summary' },
  { id: 'tenant_isolation', label: "Tenant isolation verified — no access to another tenant's data" },
  { id: 'consent_disclosure', label: 'Consent disclosure plays correctly for the configured jurisdiction' },
];

const BY_TYPE = {
  [AGENT_TYPES.RECEPTIONIST]: [
    { id: 'intent_routing', label: 'Unclear intent asks a clarifying question or routes to a human' },
  ],
  [AGENT_TYPES.OUTBOUND]: [
    { id: 'dnc_block', label: 'Consent / DNC check blocks a flagged test contact' },
    { id: 'calling_hours', label: 'Calling-hour window blocks a call outside the configured window' },
    { id: 'crm_disposition', label: 'CRM disposition update confirmed on a test contact' },
  ],
  [AGENT_TYPES.SDR]: [
    { id: 'crm_dedupe', label: 'CRM lookup matches an existing test contact instead of duplicating' },
    { id: 'live_slot', label: 'Booking only succeeds against a real, live calendar slot' },
  ],
  [AGENT_TYPES.HIRING]: [
    { id: 'screening_order', label: 'Screening questions run in configured order with correct scoring' },
    { id: 'ats_update', label: 'ATS record updates correctly' },
    { id: 'consent_decline', label: 'Declining recording consent routes to the non-recorded human path' },
  ],
  [AGENT_TYPES.REAL_ESTATE]: [
    { id: 'live_listing', label: 'Listing price / status / availability pulled live, not cached' },
    { id: 'fair_housing', label: 'Scripting reviewed for fair-housing compliance' },
    { id: 'escalate_pricing', label: 'Pricing / legal questions escalate to a human' },
  ],
};

export function checklistFor(type) {
  return [...ALL_AGENTS, ...(BY_TYPE[type] || [])];
}
