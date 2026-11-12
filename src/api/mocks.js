/**
 * Mock data that matches the shapes the NVIP backend is expected to return.
 * Delete freely once the real endpoints are live (set REACT_APP_NVIP_USE_MOCKS=false).
 */
import { AGENT_TYPES } from '../config/agents';

export const mockTenant = {
  id: 'tnt_beta_staffing',
  name: 'Beta Staffing',
  parent: { id: 'tnt_apex_msp', name: 'Apex MSP' },
  isMspParent: false,
};

export const mockMyAgents = [
  {
    id: 'ai_hiring_wh',
    type: AGENT_TYPES.HIRING,
    name: 'Hiring — Warehouse Associate',
    phoneNumber: '+1 212-555-0102',
    lifecycle: 'active',
    calls7d: 86,
    configVersion: 4,
    updatedAt: '2026-11-10T14:20:00Z',
  },
  {
    id: 'ai_sdr_inbound',
    type: AGENT_TYPES.SDR,
    name: 'Inbound SDR',
    phoneNumber: '+1 212-555-0110',
    lifecycle: 'active',
    calls7d: 41,
    configVersion: 7,
    updatedAt: '2026-11-08T09:02:00Z',
  },
  {
    id: 'ai_outbound_spring',
    type: AGENT_TYPES.OUTBOUND,
    name: 'Outbound — Spring campaign',
    phoneNumber: '+1 212-555-0118',
    lifecycle: 'testing',
    calls7d: 15,
    configVersion: 2,
    updatedAt: '2026-11-11T17:45:00Z',
  },
  {
    id: 'ai_re_inquiries',
    type: AGENT_TYPES.REAL_ESTATE,
    name: 'Real Estate inquiries',
    phoneNumber: null,
    lifecycle: 'paused',
    calls7d: 0,
    configVersion: 1,
    updatedAt: '2026-10-30T11:00:00Z',
  },
];

export const mockDashboard = {
  callsToday: 142,
  usage: { used: 6800, included: 10000, unit: 'minutes' },
  openProvisioningJobs: 0,
  alerts: [{ id: 'al_1', severity: 'warning', message: '1 candidate declined recording — routed to human' }],
};

export const mockOrders = [
  { id: 'ord_1042', agentType: AGENT_TYPES.HIRING, tier: 'Growth', status: 'active', billingSource: 'direct', placedAt: '2026-08-02', renewsAt: '2027-08-02', priceSnapshot: '$399 / mo' },
  { id: 'ord_1057', agentType: AGENT_TYPES.SDR, tier: 'Starter', status: 'active', billingSource: 'pax8', placedAt: '2026-09-14', renewsAt: '2026-12-14', priceSnapshot: '$299 / mo' },
  { id: 'ord_1081', agentType: AGENT_TYPES.OUTBOUND, tier: 'Starter', status: 'provisioning', billingSource: 'direct', placedAt: '2026-11-09', renewsAt: null, priceSnapshot: '$349 / mo' },
];

export const mockUsage = {
  period: { start: '2026-11-01', end: '2026-11-30' },
  lines: [
    { metric: 'Call minutes', used: 6800, included: 10000, unit: 'min' },
    { metric: 'SMS sent', used: 412, included: 1000, unit: 'sms' },
    { metric: 'Emails sent', used: 230, included: 2000, unit: 'email' },
  ],
  overage: [],
};

export const mockTeam = [
  { id: 'u_1', name: 'Dana Whitfield', email: 'dana@betastaffing.example', role: 'tenant_admin', status: 'active' },
  { id: 'u_2', name: 'Marco Ruiz', email: 'marco@betastaffing.example', role: 'agent_user', status: 'active' },
  { id: 'u_3', name: 'Priya Natarajan', email: 'priya@betastaffing.example', role: 'reporting', status: 'invited' },
];

export const mockIntegrations = [
  { id: 'calendar', name: 'Calendar & email (Nylas)', kind: 'oauth', status: 'connected', detail: 'Google Workspace' },
  { id: 'crm', name: 'CRM', kind: 'oauth', status: 'connected', detail: 'HubSpot' },
  { id: 'ats', name: 'ATS', kind: 'oauth', status: 'error', detail: 'Token expired — reconnect' },
  { id: 'property', name: 'Property / MLS feed', kind: 'api_key', status: 'not_connected', detail: null },
];
