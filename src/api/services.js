/**
 * NVIP platform services. One function per backend endpoint (architecture doc §9),
 * grouped by domain. Pages import from here — never call `http` directly — so
 * swapping a mock for the real endpoint is a one-line change in this file.
 *
 * Agent-specific endpoints (campaigns, leads, candidates, listings…) live with
 * their agent module in src/agents/<type>/api.js, not here.
 */
import { http, call } from './client';
import { AGENTS, TIERS } from '../config/agents';
import {
  mockTenant, mockMyAgents, mockDashboard, mockOrders, mockUsage, mockTeam, mockIntegrations,
} from './mocks';
import { ROLES } from '../config/roles';

export const marketplaceApi = {
  listAgents: () => call(() => http.get('/agents'), () => AGENTS),
  getAgent: (slug) => call(() => http.get(`/agents/${slug}`), () => AGENTS.find((a) => a.slug === slug) ?? null),
  getTiers: (type) => call(() => http.get(`/agents/${type}/tiers`), () => TIERS[type] ?? []),
};

export const accessApi = {
  /** kind: 'demo' | 'quote' — no account required (FR-PORTAL-03). */
  submitRequest: (kind, payload) =>
    call(() => http.post('/access-requests', { kind, ...payload }), { id: `req_${Date.now()}`, kind, status: 'received' }),
};

export const authApi = {
  /** Mock sign-in: the role picker on the sign-in page decides the role. */
  signIn: ({ email, password, role }) =>
    call(() => http.post('/auth/login', { email, password }), () => ({
      token: 'mock-token',
      user: { id: 'u_1', name: email.split('@')[0] || 'Demo user', email, role: role || ROLES.TENANT_ADMIN },
      tenant: role === ROLES.PLATFORM_ADMIN ? { id: 'tnt_netsmartz', name: 'Netsmartz', parent: null } : mockTenant,
    })),
};

export const workspaceApi = {
  dashboard: () => call(() => http.get('/dashboard'), mockDashboard),
  myAgents: () => call(() => http.get('/my-agents'), mockMyAgents),
  myAgent: (id) => call(() => http.get(`/my-agents/${id}`), () => {
    const agent = mockMyAgents.find((a) => a.id === id);
    return agent ? { ...agent } : null;
  }),
  transition: (id, to) => call(() => http.post(`/agents/${id}/lifecycle`, { to }), () => ({ id, lifecycle: to })),
  orders: () => call(() => http.get('/orders'), mockOrders),
  usage: () => call(() => http.get('/usage'), mockUsage),
  team: () => call(() => http.get('/team'), mockTeam),
  integrations: () => call(() => http.get('/integrations'), mockIntegrations),
};
