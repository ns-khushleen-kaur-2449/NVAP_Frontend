import axios from 'axios';
import { STEP_UP_REQUIRED, requestStepUp } from '@/lib/stepUp';

/**
 * All domains are served by the unified backend at REACT_APP_BACKEND_URL.
 */
const normalizeBase = (value) => (value || '').replace(/\/+$/, '');

/**
 * ONE base URL. Identity, CRM, Voice, Report and marketplace are all served by
 * the single backend (app.main:app) on one origin.
 *
 * REACT_APP_VOICE_AGENT_URL and REACT_APP_REPORT_AGENT_URL are deprecated.
 * They are still read so existing deployments keep booting, but they pointed at
 * the same monolith already. Set REACT_APP_BACKEND_URL only.
 */
const API_BASE = normalizeBase(
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_VOICE_AGENT_URL ||
  process.env.REACT_APP_REPORT_AGENT_URL ||
  'http://localhost:8000'
);

/**
 * ONE Axios client. Every request path below is absolute from the origin, so
 * Voice/CRM/auth paths carry their own `/api` prefix and Report paths
 * (`/audio`, `/call-analysis`, `/weights`) carry none — exactly the URLs the
 * backend has always served.
 */
const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

// Existing export names are preserved. They are all the same client now.
const authApi = http;
const voiceApi = http;
const api = http;
const reportApi = http;

const isValidToken = (token) => Boolean(token) && token !== 'undefined' && token !== 'null';

const _addAuthInterceptor = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('estateops_token');
    // Only login is anonymous; creating a user (/auth/register) needs the creator's token.
    const isLogin = config.url?.includes('/auth/login');
    if (!isLogin && isValidToken(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization && (isLogin || !config._explicitToken)) {
      delete config.headers.Authorization;
    }
    return config;
  });
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const action = error.response?.headers?.['x-auth-required-action'];
      // A high-risk action without a fresh step-up: ask for a code, then send the same request once more.
      if (error.response?.status === 403 && action === STEP_UP_REQUIRED && error.config && !error.config._steppedUp) {
        if (await requestStepUp()) return instance({ ...error.config, _steppedUp: true });
        return Promise.reject(error);
      }
      // A 403 the user must act on (temporary password, suspended organisation, MFA setup): AuthContext shows the screen.
      if (error.response?.status === 403 && action) {
        window.dispatchEvent(new CustomEvent('auth:required-action', { detail: action }));
      }
      if (error.response?.status === 401) {
        if (!window.location.pathname.includes('/login') && !error.config.url?.includes('/auth/')) {
          localStorage.removeItem('estateops_token');
          localStorage.removeItem('estateops_user');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

_addAuthInterceptor(http);

// ── Auth ──
export const authLogin = (data) => authApi.post('/api/auth/login', data);
export const authRegister = (data) => authApi.post('/api/auth/register', data);
// The logged-in user: role, tenant, team, permissions, creatable_roles, must_change_password.
export const getMe = () => authApi.get('/api/auth/me');
export const changePassword = (currentPassword, newPassword) =>
  authApi.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword });
// Super Admin two-factor sign-in, setup and step-up (app/features/auth/mfa.py).
export const authLoginMfa = (mfaToken, { code, recoveryCode } = {}) => authApi.post('/api/auth/login/mfa',
  recoveryCode ? { mfa_token: mfaToken, recovery_code: recoveryCode } : { mfa_token: mfaToken, code });
// Sent with the token being signed out explicitly: the stored copy is removed at the same moment.
export const authLogout = (token) => authApi.post('/api/auth/logout', null,
  { headers: { Authorization: `Bearer ${token}` }, _explicitToken: true });
export const getMfaStatus = () => authApi.get('/api/auth/mfa');
export const startMfaEnrollment = () => authApi.post('/api/auth/mfa/enroll');
export const verifyMfaEnrollment = (code) => authApi.post('/api/auth/mfa/enroll/verify', { code });
export const regenerateRecoveryCodes = () => authApi.post('/api/auth/mfa/recovery-codes');
export const verifyStepUp = (code) => authApi.post('/api/auth/step-up', { code });
export const listOwnSessions = () => api.get('/api/admin/security/sessions');
export const listUserSessions = (userId) => api.get(`/api/admin/users/${userId}/sessions`);
export const revokeSession = (sessionId, reason) => api.post(`/api/admin/security/sessions/${sessionId}/revoke`,
  reason ? { reason } : {});
export const resetUserMfa = (userId, reason) => api.post(`/api/admin/users/${userId}/mfa/reset`, { reason });

// ── Admin: users, teams, tenants, role dashboard ──
export const listAdminUsers = (params) => api.get('/api/users', { params });
export const updateAdminUser = (id, data) => api.patch(`/api/users/${id}`, data);
export const deactivateUser = (id) => api.post(`/api/users/${id}/deactivate`);
export const reactivateUser = (id) => api.post(`/api/users/${id}/reactivate`);
export const moveUserToTeam = (id, managerUserId) => api.put(`/api/users/${id}/team`, { manager_user_id: managerUserId });
export const listTeams = () => api.get('/api/teams');
export const listTenants = () => api.get('/api/admin/tenants/all');
export const listAdminTenants = (params) => api.get('/api/admin/tenants', { params });
export const createTenantWithAdmin = (data) => api.post('/api/admin/tenants/with-admin', data);
// A reason is required; it is kept in the admin audit trail.
export const suspendTenant = (id, reason) => api.post(`/api/admin/tenants/${id}/suspend`, { reason });
export const activateTenant = (id, reason) => api.post(`/api/admin/tenants/${id}/activate`, { reason });
export const initiateTenantOffboarding = (id, reason) => api.post(`/api/admin/tenants/${id}/offboarding`, { reason });
export const cancelTenantOffboarding = (id, reason) => api.post(`/api/admin/tenants/${id}/offboarding/cancel`, { reason });
// Grant (true) or revoke (false) a tenant's Apollo Preview access → the tenant, with apollo_access_enabled.
export const setTenantApolloAccess = (id, enabled, reason) => api.put(`/api/admin/tenants/${id}/apollo-access`, { enabled, reason });
// Super Admin only: the Vapi phone numbers a tenant may attach to its assistants (nothing is sent to Vapi).
export const listTenantPhoneNumbers = (tenantId) => api.get(`/api/admin/tenants/${tenantId}/phone-numbers`);
export const addTenantPhoneNumber = (tenantId, data) => api.post(`/api/admin/tenants/${tenantId}/phone-numbers`, data);
export const removeTenantPhoneNumber = (tenantId, numberId) => api.delete(`/api/admin/tenants/${tenantId}/phone-numbers/${numberId}`);
export const getRoleDashboard = () => api.get('/api/v1/dashboard');

// ── Agents (the platform catalog; backend app/api/v1/endpoints/agents.py) ──
// Everyone: the agents their organisation may use. Never includes Vapi details.
export const listAvailableAgents = () => api.get('/api/v1/agents/available');
// Super Admin only: author agents, decide who may use them, and register their shared assistants.
export const listAgents = () => api.get('/api/v1/agents');
export const createAgent = (data) => api.post('/api/v1/agents', data);
export const updateAgent = (id, data) => api.patch(`/api/v1/agents/${id}`, data);
export const getAgentAccess = (id) => api.get(`/api/v1/agents/${id}/access`);
export const setAgentAccess = (id, accessScope, tenantIds = []) =>
  api.put(`/api/v1/agents/${id}/access`, { access_scope: accessScope, tenant_ids: tenantIds });
export const listAgentAssistants = (id) => api.get(`/api/v1/agents/${id}/assistants`);
export const registerAgentAssistant = (id, data) => api.post(`/api/v1/agents/${id}/assistants`, data);
export const removeAgentAssistant = (id, rowId) => api.delete(`/api/v1/agents/${id}/assistants/${rowId}`);
// Super Admin only: a shared assistant's versions. Import reads Vapi; publish and restore change the assistant in Vapi.
const assistantVersions = (id, rowId) => `/api/v1/agents/${id}/assistants/${rowId}/versions`;
export const listAgentAssistantVersions = (id, rowId) => api.get(assistantVersions(id, rowId));
export const importAgentAssistantVersion = (id, rowId) => api.post(`${assistantVersions(id, rowId)}/import`);
export const createAgentAssistantDraft = (id, rowId, payload) => api.post(assistantVersions(id, rowId), { payload });
export const checkAgentAssistantVersion = (id, rowId, n) => api.post(`${assistantVersions(id, rowId)}/${n}/check`);
export const publishAgentAssistantVersion = (id, rowId, n) => api.post(`${assistantVersions(id, rowId)}/${n}/publish`);
export const rollbackAgentAssistantVersion = (id, rowId, n) => api.post(`${assistantVersions(id, rowId)}/${n}/rollback`);
// Whether this server has the agent's code and can run it: { key, has_code, contract_version, ok, problems }.
export const getAgentHealth = (id) => api.get(`/api/v1/agents/${id}/health`);
// Calls per agent for [from, to): { from, to, tenant_id? } (a Super Admin must name the tenant). Counts only.
export const getAgentMetrics = (params) => api.get('/api/v1/agents/metrics', { params });

// ── Hiring agent (backend app/agents/hiring/router.py) ──
// Every route checks the caller: hiring.view reads, hiring.manage changes records, hiring.call places calls, and
// the organisation must be allowed to use Hiring (403 otherwise). Responses never carry Vapi details.
const HIRING = '/api/v1/hiring';
export const listHiringJobs = (params) => api.get(`${HIRING}/jobs`, { params });
export const getHiringJob = (id) => api.get(`${HIRING}/jobs/${id}`);
export const createHiringJob = (data) => api.post(`${HIRING}/jobs`, data);
export const updateHiringJob = (id, data) => api.patch(`${HIRING}/jobs/${id}`, data);
export const replaceHiringQuestions = (id, questions) =>
  api.put(`${HIRING}/jobs/${id}/questions`, { questions: questions.map((text) => ({ question_text: text })) });
export const listHiringCandidates = (params) => api.get(`${HIRING}/candidates`, { params });
export const createHiringCandidate = (data) => api.post(`${HIRING}/candidates`, data);
export const updateHiringCandidate = (id, data) => api.patch(`${HIRING}/candidates/${id}`, data);
export const listHiringBookings = (params) => api.get(`${HIRING}/bookings`, { params });
export const getHiringBooking = (id) => api.get(`${HIRING}/bookings/${id}`);
// The same idempotency_key again returns the first booking (200) instead of a second one.
export const createHiringBooking = (data) => api.post(`${HIRING}/bookings`, data);
export const getHiringCandidate = (id) => api.get(`${HIRING}/candidates/${id}`);
// Place the booking's intake call. One key per click, kept only to retry that click: the same key never dials twice.
// 201 placed; 200 that key's call again; 202 sent but not confirmed; 409 refused (detail.code); 502/503 not placed.
export const startHiringCall = (bookingId, idempotencyKey) =>
  api.post(`${HIRING}/bookings/${bookingId}/calls`, { idempotency_key: idempotencyKey });
// { call_id, transcript, summary }: never Vapi's raw messages. 404 when the call has none (yet).
export const getHiringCallTranscript = (bookingId, callId) =>
  api.get(`${HIRING}/bookings/${bookingId}/calls/${callId}/transcript`);
// { url, expires_at }: a short-lived link the <audio> element plays directly; ask again once it expires.
export const getHiringCallRecording = (bookingId, callId) =>
  api.get(`${HIRING}/bookings/${bookingId}/calls/${callId}/recording`);
// Users the caller may see (was /api/auth/users, which never existed).
export const listUsers = () => authApi.get('/api/users', { params: { page_size: 100 } });

// ── Dashboard & Admin ──
export const getDashboardStats = () => api.get('/api/dashboard/stats');
export const getSystemHealth = () => api.get('/api/admin/system-health');

// ── Platform control area (/api/admin, Super Admin only) ──
export const getAdminOverview = (params) => api.get('/api/admin/overview', { params });
export const listTenantAdmins = (params) => api.get('/api/admin/tenant-admins', { params });
export const createTenantAdmin = (data) => api.post('/api/admin/tenant-admins', data);
export const deactivateTenantAdmin = (id) => api.post(`/api/admin/tenant-admins/${id}/deactivate`);
export const reactivateTenantAdmin = (id) => api.post(`/api/admin/tenant-admins/${id}/reactivate`);
export const getAdminControls = () => api.get('/api/admin/controls');
export const pauseAllDialing = (reason) => api.post('/api/admin/controls/pause', { reason });
export const resumeAllDialing = (reason) => api.post('/api/admin/controls/resume', { reason });
export const pauseTenantDialing = (id, reason) => api.post(`/api/admin/tenants/${id}/pause`, { reason });
export const resumeTenantDialing = (id, reason) => api.post(`/api/admin/tenants/${id}/resume`, { reason });
export const disableAdminAgent = (id, reason) => api.post(`/api/admin/agents/${id}/disable`, { reason });
export const enableAdminAgent = (id, reason) => api.post(`/api/admin/agents/${id}/enable`, { reason });
export const getTenantSettings = (id) => api.get(`/api/admin/tenants/${id}/settings`);
export const setTenantLimits = (id, data) => api.put(`/api/admin/tenants/${id}/limits`, data);
export const setTenantFeature = (id, key, enabled, reason) => api.put(`/api/admin/tenants/${id}/features`, { key, enabled, reason });
export const getAdminOperations = () => api.get('/api/admin/operations');
export const retryOperation = (kind, id, reason) => api.post(`/api/admin/operations/${kind}/${id}/retry`, { reason });
export const getAdminUsage = (params) => api.get('/api/admin/usage', { params });
export const getUserHierarchy = (params) => api.get('/api/admin/hierarchy', { params });
export const grantSeatOverride = (id, role, extraSeats, reason) => api.post(`/api/admin/tenants/${id}/seat-override`, { role, extra_seats: extraSeats, reason });
export const getOrphans = () => api.get('/api/admin/orphans');
export const reassignOrphan = (type, id, data) => api.post(`/api/admin/orphans/${type}/${id}/reassign`, data);
export const getUserSeats = () => api.get('/api/users/seats');
export const getIntegrationStatus = () => api.get('/api/admin/integrations');
export const getTenantCallingBound = (id) => api.get(`/api/admin/tenants/${id}/calling-bound`);
export const updateTenantCallingBound = (id, data) => api.put(`/api/admin/tenants/${id}/calling-bound`, data);
export const getAdminAuditLogs = (params) => api.get('/api/admin/audit-logs', { params });
export const listPlatformUsers = (params) => api.get('/api/admin/users', { params });
export const createPlatformUser = (data) => api.post('/api/admin/users', data);
export const updatePlatformUserStatus = (id, status, reason) => api.patch(`/api/admin/users/${id}/status`, { status, reason });
// Agent Fetch: a safe preview by Vapi id or this platform's numeric id; assign ties it to one tenant (reason required).
export const lookupAgent = (ref) => api.post('/api/admin/agents/lookup',
  /^\d+$/.test(ref) ? { assistant_id: Number(ref) } : { vapi_assistant_id: ref });
export const fetchAdminAgent = (vapiAssistantId) => api.post('/api/admin/agents/fetch', { vapi_assistant_id: vapiAssistantId });
export const importAdminAgent = (vapiAssistantId, reason) => api.post('/api/admin/agents/import', { vapi_assistant_id: vapiAssistantId, reason });
export const listAdminAgents = (params) => api.get('/api/admin/agents', { params });
export const getAdminAgent = (id) => api.get(`/api/admin/agents/${id}`);
export const refreshAdminAgent = (id, reason) => api.post(`/api/admin/agents/${id}/refresh`, { reason });
export const assignAdminAgent = (id, tenantId, reason) => api.post(`/api/admin/agents/${id}/assign`, { tenant_id: tenantId, reason });
export const previewAdminAgentTools = (id, selectedTools) => api.post(`/api/admin/agents/${id}/tools/preview`, { selected_tools: selectedTools });
export const applyAdminAgentTools = (id, selectedTools, reason) => api.post(`/api/admin/agents/${id}/tools/apply`, { selected_tools: selectedTools, reason });
export const assignAgent = (ref, tenantId, reason) =>
  api.post(`/api/admin/agents/${encodeURIComponent(ref)}/assign`, { tenant_id: tenantId, reason });

// ── Prospects (the only person record; "leads" are prospects with leads_only=true) ──
export const getProspects = (params) => api.get('/api/v1/prospects', { params });
export const getProspect = (id) => api.get(`/api/v1/prospects/${id}`);
export const createProspect = (data, params) => api.post('/api/v1/prospects', data, { params });
export const updateProspect = (id, data) => api.patch(`/api/v1/prospects/${id}`, data);
export const deleteProspect = (id) => api.delete(`/api/v1/prospects/${id}`);
// Managers and Tenant Admins: hide a lead from the Leads list (not scored or called) and bring it back.
export const archiveProspect = (id) => api.post(`/api/v1/prospects/${id}/archive`);
export const restoreProspect = (id) => api.post(`/api/v1/prospects/${id}/restore`);
// Import leads from a CSV (features/prospects/csv_import.py): read first, then import with { column: use }.
export const previewLeadImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/v1/prospects/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
// `stageValues` (optional): { value in the file: STAGE } for the column mapped to "stage".
export const importLeads = (file, mapping, stageValues) => {
  const form = new FormData();
  form.append('file', file);
  form.append('mapping', JSON.stringify(mapping));
  if (stageValues) form.append('stage_values', JSON.stringify(stageValues));
  return api.post('/api/v1/prospects/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getLeadScore = (id) => api.get(`/api/lead-scores/${id}`);
export const getLeadScoreHistory = (id, params) => api.get(`/api/lead-scores/${id}/history`, { params });
export const calculateLeadScore = (id) => api.post(`/api/lead-scores/${id}`);
export const changeProspectStage = (id, stage, reason) =>
  api.post(`/api/v1/prospects/${id}/stage`, { stage: String(stage).toUpperCase(), reason });
export const getProspectStageEvents = (id) => api.get(`/api/v1/prospects/${id}/stage-events`);
// Sharing prospects with people on your team (Tenant Admin: Managers and Sales Reps; Manager: own team).
export const getShareTargets = () => api.get('/api/v1/prospects/share-targets');
export const shareProspects = (prospectIds, userIds) =>
  api.post('/api/v1/prospects/shares', { prospect_ids: prospectIds, user_ids: userIds });
export const getProspectShares = (id) => api.get(`/api/v1/prospects/${id}/shares`);
export const revokeProspectShare = (id, userId) => api.delete(`/api/v1/prospects/${id}/shares/${userId}`);
export const createLeadEvent = (data) => api.post('/api/lead-events', data);

// ── Properties ──
export const getProperties = (params) => api.get('/api/properties', { params });
export const getProperty = (id) => api.get(`/api/properties/${id}`);
export const createProperty = (data) => api.post('/api/properties', data);
export const updateProperty = (id, data) => api.put(`/api/properties/${id}`, data);
export const deleteProperty = (id) => api.delete(`/api/properties/${id}`);

// ── Site Visits ──
export const getSiteVisits = (params) => api.get('/api/site-visits', { params });
export const createSiteVisit = (data) => api.post('/api/site-visits', data);
export const updateSiteVisit = (id, status) => api.put(`/api/site-visits/${id}?status=${status}`);

// ── Calls ──
export const getCalls = (params) => api.get('/api/calls', { params });
export const getCall = (id) => api.get(`/api/calls/${id}`);
export const createCall = (data) => api.post('/api/calls', data);

// ── Engagements ──
export const getEngagements = (params) => api.get('/api/engagements', { params });
export const getEngagement = (id) => api.get(`/api/engagements/${id}`);

// ── Research ──
export const getResearchReports = () => api.get('/api/research');
export const getResearchReport = (id) => api.get(`/api/research/${id}`);

// ── Executive Reports ──
export const getExecReports = () => api.get('/api/exec-reports');
export const getExecReport = (id) => api.get(`/api/exec-reports/${id}`);

// ── Settings ──
export const getSettings = () => api.get('/api/settings');
export const updateSettings = (data) => api.put('/api/settings', data);

// ── Prospecting (Apollo) ──
export const searchProspects = (query, perPage = 20) => api.post('/api/prospecting/search', { query, per_page: perPage });
export const importProspects = (prospects) => api.post('/api/prospecting/import', { prospects });
export const getMyLeads = () => api.get('/api/prospecting/my-leads');
export const deleteMyLead = (id) => api.delete(`/api/prospecting/my-leads/${id}`);

// ── AI Filtering: search prospects already in the database (/api/ai/filter) ──
// A filter is { version: 1, match: 'all' | 'any', conditions: [{ field, op, value }] }.
// Results are limited by the backend to the caller's tenant and role; deleted,
// simulated and do-not-contact prospects are never returned.
// Errors: 400 detail is { message, issues: [{ condition, field, error }] } for an
// invalid filter — format it with describeApiError() from
// '@/components/prospecting/filterUtils' rather than passing detail to a toast.

// → { fields: [{ key, label, type, operators[], allowed_values[] }] }
export const getFilterFields = () => api.get('/api/ai/filter/fields');
// text: 1–500 chars → { filter, dropped: [{ field, op, value, error }], not_understood: [string] }
// 502 / 503 when the AI service fails; the filter can still be built by hand.
export const parseFilterText = (text) => api.post('/api/ai/filter/parse', { text });
// → { items[], total, page, page_size, total_pages, sort, filter, rules_applied[] }
// pageSize max 100; sort is 'score_desc' | 'newest'; tenantId is honoured for a Super Admin only.
export const searchProspectsByFilter = (filter, { page = 1, pageSize = 25, sort = 'score_desc', tenantId } = {}) =>
  api.post('/api/ai/filter/search', { filter, page, page_size: pageSize, sort, tenant_id: tenantId });
// → { total, filter, rules_applied[] }
export const countProspectsByFilter = (filter, { tenantId } = {}) =>
  api.post('/api/ai/filter/count', { filter, tenant_id: tenantId });

// Saved filters. A saved filter is { filter_id, name, description, filter, is_shared,
// is_owner, can_edit, created_by_name, created_at, updated_at }; created_by_name is set for shared
// filters only. Sharing needs a Manager or Tenant Admin
// (403 otherwise); a Super Admin cannot use saved filters (403).
// → { items: [saved filter] } — the caller's own filters plus those shared with their tenant
export const listSavedFilters = () => api.get('/api/ai/filter/saved');
export const getSavedFilter = (filterId) => api.get(`/api/ai/filter/saved/${filterId}`);
// data: { name, description?, filter, is_shared? } → 201 with the saved filter
export const createSavedFilter = (data) => api.post('/api/ai/filter/saved', data);
// data: any of { name, description, filter, is_shared } — send only what changes
export const updateSavedFilter = (filterId, data) => api.patch(`/api/ai/filter/saved/${filterId}`, data);
// → 204, no body
export const deleteSavedFilter = (filterId) => api.delete(`/api/ai/filter/saved/${filterId}`);
// Runs a saved filter with the caller's own access; same response as searchProspectsByFilter.
export const runSavedFilter = (filterId, { page = 1, pageSize = 25, sort = 'score_desc' } = {}) =>
  api.post(`/api/ai/filter/saved/${filterId}/search`, { page, page_size: pageSize, sort });

// ── Apollo Preview: a temporary, live look at Apollo's free search (/api/apollo) ──
// Demo only. Results are masked and are never saved or imported. The backend decides
// who may use it: Tenant Admins, Managers and Sales Reps of tenants a Super Admin has granted
// access in Platform Admin → Tenants.
// → { enabled, access_granted, service_ready, reason }. access_granted: the tenant's grant and the role allow
//   it (decides whether Apollo Preview is offered); service_ready: an API key is configured (null without
//   access); enabled: both. reason is null when enabled, otherwise role_not_allowed | tenant_not_allowed |
//   access_check_failed (no access) or not_configured (access granted, service not set up).
export const getApolloStatus = () => api.get('/api/apollo/status');
// filter: the same { version, match, conditions } format as AI Filtering.
// pageSize 1-25, page 1-20.
// → { items: [{ apollo_person_id, first_name, last_name_masked, job_title, company_name,
//               has_email, has_phone, has_location }],
//     total, page, page_size, total_pages, requests_left_today,
//     not_translated: [{ condition, field, op, reason }],   conditions Apollo was not given
//     approximate:    [{ condition, field, op, reason }] }  conditions Apollo matches loosely
// 400 detail: { message, issues } for an invalid filter, or { message, not_translated } when
// Apollo can use none of it. 429 detail: { message, retry_after }. 403 and 503: a message.
export const searchApolloPreview = (filter, { page = 1, pageSize = 10 } = {}) =>
  api.post('/api/apollo/search', { filter, page, page_size: pageSize });

// ── AI Strategist ──
export const getStrategistHistory = () => api.get('/api/strategist/history');
export const strategistChat = (message) => api.post('/api/strategist/chat', { message });
export const launchCampaignFromStrategy = (strategy, prospectIds) => api.post('/api/campaigns/launch', { strategy, prospect_ids: prospectIds });

// ── Campaigns (SDR) ──
export const getSdrCampaigns = () => api.get('/api/campaigns');
export const getSdrCampaign = (id) => api.get(`/api/campaigns/${id}`);
export const generateCampaignMessages = (id, count = 5) => api.post(`/api/campaigns/${id}/generate-messages`, { count });
export const approveCampaignMessage = (id, data = {}) => api.post(`/api/messages/${id}/approve`, data);
export const rejectCampaignMessage = (id) => api.post(`/api/messages/${id}/reject`);
export const regenerateCampaignMessage = (id, instructions) => api.post(`/api/messages/${id}/regenerate`, { instructions });
export const sendApprovedCampaignMessages = (id) => api.post(`/api/campaigns/${id}/send-approved`);
export const launchCampaignCalls = (id, assistantId) => api.post(`/api/campaigns/${id}/launch-calls`, { assistant_id: assistantId });

// ── Inbox ──
// Every email sent to a lead (brochures, meeting emails), with why it went and the call it came from.
export const listLeadEmails = (params) => api.get('/api/v1/lead-emails', { params });

// ── AI Agent Actions ──
export const qualifyLead = (id) => api.post(`/api/agents/lead-qualify/${id}`);
export const generateEngagement = (data) => api.post('/api/agents/engagement/generate', data);
export const runResearch = () => api.post('/api/agents/research/run');
export const runExecReport = () => api.post('/api/agents/exec-report/run');
export const summarizeCall = (id) => api.post(`/api/agents/call-summarize/${id}`);

// ── Voice Agent ──
// ── Voice campaigns: one campaign API for selected leads and uploaded files ──
// data: { name, description, notes, assistant_id, timezone, calling_window,
//         calling_config, start: 'now'|'scheduled'|'draft', scheduled_at,
//         prospect_ids | contacts, source_filename }
export const createVoiceCampaign = (data) => api.post('/api/campaigns', data);
// "What the agent will tell leads": the form's unsaved offer values (voice_campaigns/offer.py; nothing is saved).
export const previewCampaignOffer = (data) => api.post('/api/campaigns/offer-preview', data);
// Parses a CSV/XLSX without storing anything; returns { filename, total, skipped_rows, contacts }.
export const previewCampaignCsv = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/campaigns/csv-preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
// Start a draft/scheduled/missed campaign now, or pass scheduledAt to (re)schedule it (reason recorded).
export const startVoiceCampaign = (id, scheduledAt, extra = {}) =>
  api.post(`/api/campaigns/${id}/start`, scheduledAt ? { scheduled_at: scheduledAt, ...extra } : extra);
// body: { reason?, expected_version?, credits_topped_up? } (CampaignActionRequest)
export const cancelVoiceCampaign = (id, body = {}) => api.post(`/api/campaigns/${id}/cancel`, body);
export const pauseVoiceCampaign = (id, body = {}) => api.post(`/api/campaigns/${id}/pause`, body);
export const resumeVoiceCampaign = (id, body = {}) => api.post(`/api/campaigns/${id}/resume`, body);
// A "Waiting" or paused campaign -> completed; reason required.
export const closeVoiceCampaign = (id, reason) => api.post(`/api/campaigns/${id}/close`, { reason });
export const getVoiceCampaignEvents = (id) => api.get(`/api/campaigns/${id}/events`);
// { warnings, calling_window, effective_window, starts_at, retry_defaults } before saving a campaign.
export const checkCampaignSchedule = (data) => api.post('/api/campaigns/schedule-check', data);
// Manual actions on one contact (Tenant Admin / Manager; every body carries a reason).
// action: requeue {phone_number?} | dial-now | next-attempt {next_attempt_at} | attempts {reset, max_attempts} | remove
export const campaignContactAction = (campaignId, contactId, action, body) =>
  api.post(`/api/campaigns/${campaignId}/contacts/${contactId}/${action}`, body);
export const getCampaignContactEvents = (campaignId, contactId) =>
  api.get(`/api/campaigns/${campaignId}/contacts/${contactId}/events`);
// History of uploads made before files became a campaign source.
export const getCsvCallResults = (processId) => api.get(`/api/csv/results/${processId}`);

// ── Voice Campaigns ──
// Distinct from getCampaigns() below, which hits /api/call-logs/campaigns and
// returns only id/name/created_at for the Call Logs filter dropdown.
export const getVoiceCampaigns = () => api.get('/api/campaigns');
export const getVoiceCampaign = (id) => api.get(`/api/campaigns/${id}`);
export const getVoiceCampaignContacts = (id) => api.get(`/api/campaigns/${id}/contacts`);
export const deleteVoiceCampaign = (id) => api.delete(`/api/campaigns/${id}`);
// Name/description/notes any time; calling settings until it finishes;
// assistant, timezone, scheduled_at and contacts only while draft or scheduled.
export const updateVoiceCampaign = (id, data) => api.patch(`/api/campaigns/${id}`, data);
// One immediate outbound call (Single Call tab).  A number the contact rules hold back is a 409
// { code, allowed_at, message }; allow_recent + reason calls it anyway (Tenant Admin / Manager only).
// code "opted_out" (do-not-call) can never be overridden.
export const initiateSmartsdrCall = ({ phone_number, user_name, assistant_id, prospect_id, allow_recent, reason }) => {
  const body = new URLSearchParams();
  body.append('phone_number', phone_number || '');
  body.append('user_name', user_name || '');
  if (assistant_id) {
    body.append('assistant_id', assistant_id);
  }
  if (allow_recent) {
    body.append('allow_recent', 'true');
    body.append('reason', reason || '');
  }
  if (prospect_id) {
    body.append('prospect_id', prospect_id);
  }
  return api.post('/api/smartsdr-calls', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};
export const scheduleVoiceCall = (data) => api.post('/api/voice/schedule', data);

// The endpoint reads form fields only (title, content, file), so text-only notes go as form data too;
// a JSON body would arrive empty ("Provide content text or a file").
export const createKnowledgeBase = (payload, file) => {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (file) formData.append('file', file);
  return api.post('/api/knowledge-base', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getCallLogs = (params) => api.get('/api/call-logs', { params });
export const getCallLogDetail = (id) => api.get(`/api/call-logs/${id}`);
// { url, expires_at }: a freshly signed recording URL the <audio> element can play directly.
export const getCallRecordingUrl = (id) => api.get(`/api/call-logs/${encodeURIComponent(id)}/recording-url`);
export const deleteCallLog = (id) => api.delete(`/api/call-logs/${id}`);
export const getVoiceCallStats = () => api.get('/api/call-logs/stats');
export const getCallStatsByAssistant = () => api.get('/api/call-logs/stats/by-assistant');
// Every Voice Agent dashboard number for [from, to): { from, to, tz, agent_id? }.
export const getVoiceDashboardSummary = (params) => api.get('/api/v1/voice/dashboard/summary', { params });
export const pauseAssistant = (assistantId) => api.post(`/api/v1/assistants/${assistantId}/pause`);
export const resumeAssistant = (assistantId) => api.post(`/api/v1/assistants/${assistantId}/resume`);
export const getCampaigns = () => api.get('/api/call-logs/campaigns');

// ── VAPI Assistant Workshop ──
export const getAssistants = () => api.get('/api/v1/assistants');
export const createAssistant = (data) => api.post('/api/v1/assistants', data);
export const saveAssistantDraft = (data) => api.post('/api/v1/assistants/draft', data);
export const importAssistants = (vapiAssistantIds) =>
  api.post('/api/v1/assistants/import', { vapi_assistant_ids: vapiAssistantIds });
export const deleteAssistant = (id) => api.delete(`/api/v1/assistants/${id}`);
export const getAssistant = (id) => api.get(`/api/v1/assistants/${id}`);

// ── Assistant change requests (a Sales Rep proposes; their Manager or a Tenant Admin reviews) ──
// changes: assistant fields by API name, as in PATCH /api/v1/assistants/{id}; reason required.
export const submitAssistantChangeRequest = (assistantId, changes, reason) =>
  api.post(`/api/v1/assistants/${assistantId}/change-requests`, { changes, reason });
// params: { status: pending | applied | rejected | withdrawn, assistant_id }
export const listAssistantChangeRequests = (params = {}) => api.get('/api/v1/assistant-change-requests', { params });
export const getAssistantChangeRequest = (id) => api.get(`/api/v1/assistant-change-requests/${id}`);
export const approveAssistantChangeRequest = (id, feedback) =>
  api.post(`/api/v1/assistant-change-requests/${id}/approve`, { feedback: feedback || null });
export const rejectAssistantChangeRequest = (id, feedback) =>
  api.post(`/api/v1/assistant-change-requests/${id}/reject`, { feedback });
export const withdrawAssistantChangeRequest = (id) => api.post(`/api/v1/assistant-change-requests/${id}/withdraw`);
export const uploadKnowledgeFile = (assistantId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  if (assistantId) fd.append('assistant_id', assistantId);
  return api.post('/api/v1/assistants/knowledge-base', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getKnowledgeFiles = () => api.get('/api/v1/assistants/knowledge-base/files');
// Refused (409, naming the agents) while an agent still uses the file.
export const deleteKnowledgeFile = (fileId) =>
  api.delete(`/api/v1/assistants/knowledge-base/files/${encodeURIComponent(fileId)}`);

// ── Assistant Builder (guided, versioned configs published to Vapi) ──
export const getCatalogItems = () => api.get('/api/v1/catalog/items');
// The Catalog page: columns (fixed, matching, the tenant's own fields) and every product; Tenant Admins
// and Managers edit. A CSV's extra columns become fields; products added here survive a re-import.
export const getCatalogTable = (params) => api.get('/api/v1/catalog/table', { params });
// The tenant's catalog settings as they apply (currency, words, preset, ...); Tenant Admins and Managers.
// A Super Admin passes { tenant_id }. Changes need a reason; every mutating catalog response carries
// `agents` ({ republish_scheduled, delay_seconds, drafts, missing_words? }).
export const getCatalogSettings = (params) => api.get('/api/v1/catalog/settings', { params });
export const updateCatalogSettings = (data, params) => api.patch('/api/v1/catalog/settings', data, { params });
export const getCatalogSettingsHistory = (params) => api.get('/api/v1/catalog/settings/history', { params });
// How the agent would say an amount ({ amount, currency?, price_format?, tenant_id? }).
export const getCatalogPricePreview = (params) => api.get('/api/v1/catalog/settings/price-preview', { params });
export const getCatalogPresets = () => api.get('/api/v1/catalog/presets');
export const applyCatalogPreset = (name) => api.post(`/api/v1/catalog/presets/${name}/apply`);
// A CSV import template for a preset: its columns plus example products (anyone who views the Catalog).
export const downloadCatalogPresetTemplate = (name) =>
  api.get(`/api/v1/catalog/presets/${name}/template`, { responseType: 'blob' });
// `mapping` (optional): { column: use } from the column-matching step (catalog/import_mapping.py).
export const importCatalog = (file, mapping) => {
  const form = new FormData();
  form.append('file', file);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  return api.post('/api/v1/catalog/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const previewCatalogImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/v1/catalog/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const addCatalogItem = (data) => api.post('/api/v1/catalog/items', data);
export const updateCatalogItem = (id, data) => api.patch(`/api/v1/catalog/items/${id}`, data);
export const addCatalogField = (data) => api.post('/api/v1/catalog/fields', data);
export const renameCatalogField = (key, label) => api.patch(`/api/v1/catalog/fields/${key}`, { label });
// Any field property (label, labels, type, matchable, match_mode, allowed_values, synonyms, aliases, weight, ask_lead).
export const updateCatalogField = (key, data) => api.patch(`/api/v1/catalog/fields/${key}`, data);
// { ask_order: [keys], relax_order: [keys], never_relax: [keys] }, saved together.
export const orderCatalogFields = (data) => api.put('/api/v1/catalog/fields/order', data);
export const deleteCatalogField = (key) => api.delete(`/api/v1/catalog/fields/${key}`);
// key: a custom field's key, 'price' or 'stock'.
export const setCatalogVisibility = (key, agentVisible) => api.patch('/api/v1/catalog/visibility', { key, agent_visible: agentVisible });
export const previewBuilderConfig = (data) => api.post('/api/v1/assistant-builder/preview', data);
export const listBuilderConfigs = () => api.get('/api/v1/assistant-builder/configs');
export const getBuilderConfig = (id) => api.get(`/api/v1/assistant-builder/configs/${id}`);
export const createBuilderConfig = (data) => api.post('/api/v1/assistant-builder/configs', data);
export const updateBuilderConfig = (id, data) => api.put(`/api/v1/assistant-builder/configs/${id}`, data);
export const deleteBuilderConfig = (id) => api.delete(`/api/v1/assistant-builder/configs/${id}`);
export const publishBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/publish`, null, { params: version ? { version } : {} });
export const rollbackBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/rollback/${version}`);
export const retryBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/retry/${version}`);

// ── Tools (Super Admin: platform Vapi tools) ──
export const listToolTypes = () => api.get('/api/admin/tools/types');
export const listTools = () => api.get('/api/admin/tools');
export const createTool = (data) => api.post('/api/admin/tools', data);
export const updateTool = (id, data) => api.patch(`/api/admin/tools/${id}`, data);
export const syncTool = (id) => api.post(`/api/admin/tools/${id}/sync`);
export const deleteTool = (id) => api.delete(`/api/admin/tools/${id}`);
export const previewTool = (data) => api.post('/api/admin/tools/preview', data);
// Create (or re-sync) the six appointment tools in Vapi; safe to re-run.
export const registerAppointmentTools = () => api.post('/api/admin/tools/register');
export const getToolTenants = (id) => api.get(`/api/admin/tools/${id}/tenants`);
export const setToolTenants = (id, tenantIds, reason) => api.put(`/api/admin/tools/${id}/tenants`, { tenant_ids: tenantIds, reason });
// Tools on one assistant (tools granted to its tenant; Tenant Admin attaches/detaches).
export const listAssistantTools = (assistantId) => api.get(`/api/v1/assistants/${assistantId}/tools`);
// Tools an Assistant Builder agent can be given (granted to the tenant), each with the tool types it needs.
export const listBuilderTools = () => api.get('/api/v1/assistant-builder/tools');
// The lead fields an agent may know: standard Prospect fields plus this tenant's custom.<key> fields.
export const getLeadFieldRegistry = () => api.get('/api/v1/assistant-builder/lead-fields');
// The languages an agent may speak (approved packs; drafts for test tenants), each with its voice readiness.
export const getBuilderLanguages = () => api.get('/api/v1/assistant-builder/languages');
export const attachAssistantTool = (assistantId, toolId) => api.post(`/api/v1/assistants/${assistantId}/tools/${toolId}`);
export const detachAssistantTool = (assistantId, toolId) => api.delete(`/api/v1/assistants/${assistantId}/tools/${toolId}`);

// ── Scheduling (Tenant Admin edits; Managers view): meeting types and executives for the appointment tools ──
export const listMeetingTypes = (includeInactive = false) =>
  api.get('/api/v1/scheduling/meeting-types', { params: { include_inactive: includeInactive } });
export const createMeetingType = (data) => api.post('/api/v1/scheduling/meeting-types', data);
export const updateMeetingType = (id, data) => api.patch(`/api/v1/scheduling/meeting-types/${id}`, data);
export const deactivateMeetingType = (id) => api.delete(`/api/v1/scheduling/meeting-types/${id}`);
export const listExecutives = () => api.get('/api/v1/scheduling/executives');
export const listExecutiveCandidates = () => api.get('/api/v1/scheduling/candidates');
export const createExecutive = (data) => api.post('/api/v1/scheduling/executives', data);
export const updateExecutive = (id, data) => api.patch(`/api/v1/scheduling/executives/${id}`, data);
export const deactivateExecutive = (id) => api.delete(`/api/v1/scheduling/executives/${id}`);
export const seedScheduling = () => api.post('/api/v1/scheduling/seed');
// Brochures for the lead's overview email: one per meeting type, plus the company default (meetingTypeId null). PDF only.
const brochurePath = (meetingTypeId) => (meetingTypeId
  ? `/api/v1/scheduling/meeting-types/${meetingTypeId}/brochure` : '/api/v1/scheduling/brochures/default');
export const listBrochures = () => api.get('/api/v1/scheduling/brochures');
// `name` (optional) is what the attachment is called in emails; left out: the file's own name.
const brochureForm = (file, name) => {
  const form = new FormData();
  form.append('file', file);
  if (name && name.trim()) form.append('name', name.trim());
  return form;
};
export const uploadBrochure = (meetingTypeId, file, name) => {
  const form = brochureForm(file, name);
  return api.put(brochurePath(meetingTypeId), form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteBrochure = (meetingTypeId) => api.delete(brochurePath(meetingTypeId));
export const downloadBrochure = (id) => api.get(`/api/v1/scheduling/brochures/${id}/file`, { responseType: 'blob' });
// A brochure's description, shown in the brochure email a lead asks for ("ABOUT IT").
export const describeBrochure = (id, description) => api.patch(`/api/v1/scheduling/brochures/${id}`, { description });
// Rename a brochure: the attachment's file name in emails (".pdf" is added when missing).
export const renameBrochure = (id, name) => api.patch(`/api/v1/scheduling/brochures/${id}`, { name });

// Products a lead can ask for a brochure about (Settings; Tenant Admin edits). Saving one re-publishes
// the agents that use send_brochure with the new product list.
export const listProducts = () => api.get('/api/v1/scheduling/products');
export const createProduct = (data) => api.post('/api/v1/scheduling/products', data);
export const updateProduct = (id, data) => api.patch(`/api/v1/scheduling/products/${id}`, data);
export const uploadProductBrochure = (productId, file, name) => {
  const form = brochureForm(file, name);
  return api.put(`/api/v1/scheduling/products/${productId}/brochure`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
// A catalog row's brochure: stored on the brochure product with the row's name (created when missing).
export const uploadCatalogItemBrochure = (itemId, file, name) => {
  const form = brochureForm(file, name);
  return api.put(`/api/v1/catalog/items/${itemId}/brochure`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteProductBrochure = (productId) => api.delete(`/api/v1/scheduling/products/${productId}/brochure`);

// Brochures leads asked for on calls, and the manual overrides (approve | reject | cancel | resend, with a reason).
export const listBrochureRequests = (params) => api.get('/api/v1/brochure-requests', { params });
export const decideBrochureRequest = (id, action, reason, extra = {}) => api.post(`/api/v1/brochure-requests/${id}/${action}`, { reason, ...extra });

// Events on one connected calendar (see src/lib/calendar.js for the "my primary calendar" helpers).
export const listCalendarEvents = (connectionId, params) =>
  api.get(`/api/v1/calendar/connections/${connectionId}/events`, { params });
export const createCalendarEvent = (connectionId, data) =>
  api.post(`/api/v1/calendar/connections/${connectionId}/events`, data);
export const deleteCalendarEvent = (connectionId, eventId) =>
  api.delete(`/api/v1/calendar/connections/${connectionId}/events/${encodeURIComponent(eventId)}`);

// ── Calendar connections (Nylas; provider = google | microsoft | icloud) ──
export const getCalendarProviders = () => api.get('/api/v1/calendar/providers');
export const getCalendarConnections = () => api.get('/api/v1/calendar/connections');
export const startCalendarConnect = (provider, redirectUri) =>
  api.post('/api/v1/calendar/connections/connect', { provider, ...(redirectUri ? { redirect_uri: redirectUri } : {}) });
export const completeCalendarOAuth = (data) => api.post('/api/v1/calendar/oauth/callback', data);
export const disconnectCalendarConnection = (id, force = false) =>
  api.delete(`/api/v1/calendar/connections/${id}`, { params: force ? { force: true } : {} });
export const setPrimaryCalendarConnection = (id) => api.post(`/api/v1/calendar/connections/${id}/primary`);
export const listConnectionCalendars = (id) => api.get(`/api/v1/calendar/connections/${id}/calendars`);
export const setBookingCalendar = (id, calendarId) =>
  api.put(`/api/v1/calendar/connections/${id}/booking-calendar`, { calendar_id: calendarId });

// ── Notifications (the signed-in user's) ──
export const getNotifications = (params) => api.get('/api/v1/notifications', { params });
export const getUnreadNotificationCount = () => api.get('/api/v1/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/api/v1/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/api/v1/notifications/read-all');

// Did the lead ask for a callback on this call, and was one scheduled?
// { requested, unscheduled, callback_task_id, scheduled_call_id, prospect_id }
export const getCallCallbackFollowUp = (callId) => api.get(`/api/call-logs/${encodeURIComponent(callId)}/callback-follow-up`);

// ── Hand-offs: callbacks a person must make (Tenant Admin / Manager) ──
// params: { status: open | done | cancelled }
export const getCallbackHandoffs = (params) => api.get('/api/v1/callback-handoffs', { params });
export const getCallbackHandoffCount = () => api.get('/api/v1/callback-handoffs/count');
export const getCallbackHandoffEvents = (id) => api.get(`/api/v1/callback-handoffs/${id}/events`);
// action: done | cancel | schedule-call {scheduled_time, assistant_id?}; every body carries a reason.
export const callbackHandoffAction = (id, action, body) => api.post(`/api/v1/callback-handoffs/${id}/${action}`, body);

// ── Scheduled calls and callbacks (Tenant Admin / Manager) ──
export const getScheduledCalls = (params) => api.get('/api/v1/scheduled-calls', { params });
export const getScheduledCallEvents = (id) => api.get(`/api/v1/scheduled-calls/${id}/events`);
// action: requeue | dial-now | next-attempt | attempts | reschedule {scheduled_time} | reassign {assistant_id}
//         | cancel | handled; every body carries a reason.
export const scheduledCallAction = (id, action, body) => api.post(`/api/v1/scheduled-calls/${id}/${action}`, body);

// ── Do-not-call (Tenant Admin / Manager; a Super Admin passes tenant_id) ──
export const getDoNotCallEntries = (params) => api.get('/api/v1/do-not-call', { params });
export const getDoNotCallHistory = (params) => api.get('/api/v1/do-not-call/history', { params });
export const addDoNotCall = (phoneNumber, reason) => api.post('/api/v1/do-not-call', { phone_number: phoneNumber, reason });
export const removeDoNotCall = (id, reason) => api.delete(`/api/v1/do-not-call/${id}`, { data: { reason } });
export const confirmDoNotCall = (id, reason) => api.post(`/api/v1/do-not-call/${id}/confirm`, reason ? { reason } : {});
// "Not an opt-out": { reverted, prospect_id, restored_stage, requeued_contact_ids, requeued_scheduled_call_ids }
export const revertDoNotCall = (id, reason) => api.post(`/api/v1/do-not-call/${id}/revert`, { reason });

// ── Intent review (Tenant Admin / Manager; a Super Admin passes tenant_id) ──
// params: { status: pending | approved | rejected, page, page_size, tenant_id }
export const getIntentReviewQueue = (params) => api.get('/api/intent-assessment/review-queue', { params });
export const getIntentAssessment = (id, params) => api.get(`/api/intent-assessment/${id}`, { params });
// One call log's assessment (database or Vapi id): { assessment | null, review | null }; anyone who may see it.
export const getCallIntentAssessment = (callId) => api.get(`/api/intent-assessment/calls/${callId}`);
// A prospect's assessment status (latest call, accepted intent, label, secondary badge), with or without a score.
export const getProspectAssessmentStatus = (prospectId) =>
  api.get(`/api/intent-assessment/prospects/${prospectId}/status`);
// decision: approved | rejected; 409 when someone already reviewed it.
// edits (optional, with approved): the reviewer's corrections - primary_intent, secondary_intents,
// buying_signals, rationale, confidence (0-100), opt_out_confirmed. Omitted fields keep the AI value.
export const reviewIntentAssessment = (id, decision, reason, params, edits) =>
  api.post(`/api/intent-assessment/${id}/review`, { decision, reason, ...edits }, { params });

// Conversion Workspace (tenant scoped; a Super Admin passes tenant_id).
export const getConversionWorkspace = (params) => api.get('/api/ai/conversion/workspace', { params });
export const getConversionTimeline = (prospectId, params) =>
  api.get(`/api/ai/conversion/prospects/${prospectId}/timeline`, { params });
export const getConversionHistory = (prospectId, params) =>
  api.get(`/api/ai/conversion/prospects/${prospectId}/history`, { params });
export const getConversionEvidenceCandidates = (prospectId, params) =>
  api.get(`/api/ai/conversion/prospects/${prospectId}/evidence-candidates`, { params });
export const verifyConversionEvidence = (prospectId, data) =>
  api.post(`/api/ai/conversion/prospects/${prospectId}/verifications`, data);
export const approveConversionDecision = (decisionId, data) =>
  api.post(`/api/ai/conversion/decisions/${decisionId}/approve`, data);
export const rejectConversionDecision = (decisionId, data) =>
  api.post(`/api/ai/conversion/decisions/${decisionId}/reject`, data);
// Evaluate a prospect again now (a new decision); data: { tenant_id?, idempotency_key }.
export const reassessConversion = (prospectId, data) =>
  api.post(`/api/ai/conversion/prospects/${prospectId}/reassess`, data);

// ── Lead scoring parameters (Tenant Admin / Super Admin edit with a reason; Manager views; Super Admin passes tenant_id) ──
// update body: { disabled: [parameter], reason, expected_config_hash } — 409 when the hash is out of date.
export const getLeadScoringConfig = (params) => api.get('/api/lead-scoring/config', { params });
export const updateLeadScoringConfig = (data, params) => api.put('/api/lead-scoring/config', data, { params });
export const getLeadScoringConfigHistory = (params) => api.get('/api/lead-scoring/config/history', { params });
// Counts of the tenant's prospects by classification, freshness, assessment and Data Completeness (read only).
export const getLeadScoringOverview = (params) => api.get('/api/lead-scoring/overview', { params });
// One pass of the score refresh for the tenant (Tenant Admin / Super Admin): { scored, fresh, no_fit_data, missing, failed }.
export const rescoreLeadScores = (params) => api.post('/api/lead-scores/rescore', null, { params });

// ── Tenant rules (Tenant Admin edits with a reason; Manager views; Super Admin passes tenant_id) ──
export const getContactRules = (params) => api.get('/api/v1/contact-rules', { params });
export const updateContactRules = (data, params) => api.put('/api/v1/contact-rules', data, { params });
export const getContactRulesHistory = (params) => api.get('/api/v1/contact-rules/history', { params });
export const getCallingBound = (params) => api.get('/api/v1/contact-rules/calling-bound', { params });
export const getAppointmentRules = (params) => api.get('/api/v1/appointment-rules', { params });
export const updateAppointmentRules = (data, params) => api.put('/api/v1/appointment-rules', data, { params });
export const getAppointmentRulesHistory = (params) => api.get('/api/v1/appointment-rules/history', { params });

// ── Appointments ──
// params: { tab, agent, campaign, executive, from, to, q, page, page_size, tenant_id }
// -> { items, total, page, page_size, tab, counts: {tab: n}, calendar: {disconnected, message} }
export const getAppointments = (params) => api.get('/api/v1/appointments', { params });
export const getAppointment = (id) => api.get(`/api/v1/appointments/${id}`);
// action: cancel | reschedule {start_at, end_at?} | restore | complete | no-show; body carries reason (+ expected_version)
export const appointmentAction = (id, action, body) => api.post(`/api/v1/appointments/${id}/${action}`, body);
// Send the lead's confirmation or overview email again ({ kind, reason }).
export const resendAppointmentEmail = (id, body) => api.post(`/api/v1/appointments/${id}/resend-email`, body);
export const relinkAppointment = (id, body) => api.patch(`/api/v1/appointments/${id}/link`, body);
export const getProspectTimeline = (id) => api.get(`/api/v1/prospects/${id}/timeline`);

// Can this assistant place calls? { status: ready | ready_with_warnings | not_ready, blocking[], warnings[] }
export const getAssistantReadiness = (id) => api.get(`/api/v1/assistants/${id}/readiness`);

// ── Agent Run Logs ──
export const getAgentRuns = (params) => api.get('/api/agent-runs', { params });
export const getAgentRunStats = () => api.get('/api/agent-runs/stats');
export const retryAgentRun = (id) => api.post(`/api/agent-runs/${id}/retry`);

// ── Bulk Actions (one request per prospect; there is no bulk endpoint) ──
const runBulk = async (ids, action, verb) => {
  const results = await Promise.allSettled(ids.map(action));
  const success = results.filter((r) => r.status === 'fulfilled').length;
  return { data: { success, total: ids.length, message: `${verb} ${success}/${ids.length} prospects` } };
};
export const bulkQualifyLeads = (ids) =>
  runBulk(ids, (id) => changeProspectStage(id, 'QUALIFIED', 'Bulk qualify'), 'Qualified');
export const bulkAssignLeads = (ids, assigned_to) =>
  runBulk(ids, (id) => updateProspect(id, { assigned_to }), 'Assigned');
export const bulkUpdateStage = (ids, stage) =>
  runBulk(ids, (id) => changeProspectStage(id, stage, 'Bulk stage update'), 'Updated');

// ── CSV Export ──
export const exportLeadsCSV = () => api.get('/api/export/leads', { responseType: 'blob' });
export const exportCallsCSV = () => api.get('/api/export/calls', { responseType: 'blob' });
export const exportAgentRunsCSV = () => api.get('/api/export/agent-runs', { responseType: 'blob' });

// ── Seed ──
export const seedDatabase = () => api.post('/api/seed');

// Helper to trigger download from blob
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ── Report Agent: Audio ──
// Zoho CRM integration (Tenant Admin; Super Admin supplies tenant_id).
const ZOHO_BASE = '/api/v1/integrations/zoho';
export const connectZoho = (data = {}) => api.post(`${ZOHO_BASE}/connect`, data);
export const getZohoConnections = (params) => api.get(`${ZOHO_BASE}/connections`, { params });
export const getZohoConnection = (id, params) => api.get(`${ZOHO_BASE}/connections/${id}`, { params });
export const disconnectZoho = (id, params) => api.delete(`${ZOHO_BASE}/connections/${id}`, { params });
export const getZohoHealth = (id, params) => api.get(`${ZOHO_BASE}/connections/${id}/health`, { params });
export const getZohoWebhookSetup = (id, params) => api.get(`${ZOHO_BASE}/connections/${id}/webhook-setup`, { params });
// `secret` is deliberately returned only by these two calls. Never persist it.
export const provisionZohoWebhookSecret = (id, params) => api.post(`${ZOHO_BASE}/connections/${id}/webhook-secret`, {}, { params });
export const rotateZohoWebhookSecret = (id, data = {}, params) => api.post(`${ZOHO_BASE}/connections/${id}/webhook-secret/rotate`, data, { params });
export const getZohoFields = (params) => api.get(`${ZOHO_BASE}/fields`, { params });
export const getZohoMappings = (params) => api.get(`${ZOHO_BASE}/mappings`, { params });
export const saveZohoMappings = (connectionId, data, params) => api.put(`${ZOHO_BASE}/mappings`, data, { params: { connection_id: connectionId, ...params } });
export const importZohoLeads = (connectionId, params) => api.post(`${ZOHO_BASE}/sync/import`, { module: 'Leads' }, { params: { connection_id: connectionId, ...params } });
export const getZohoJobs = (params) => api.get(`${ZOHO_BASE}/sync/jobs`, { params });
export const getZohoInboundEvents = (params) => api.get(`${ZOHO_BASE}/sync/inbound-events`, { params });
export const getZohoDeliveries = (params) => api.get(`${ZOHO_BASE}/sync/deliveries`, { params });
export const retryZohoDelivery = (id, data = {}, params) => api.post(`${ZOHO_BASE}/sync/retry/${id}`, data, { params });

export const uploadAudioFile = (file, executiveName) => {
  const fd = new FormData();
  fd.append('file', file);
  if (executiveName) fd.append('executive_name', executiveName);
  return reportApi.post('/audio/upload-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const diarizeAudio = (audioId) => reportApi.get(`/audio/diarize/${audioId}`);
export const getAudioSummary = (audioId) => reportApi.get(`/audio/summary/${audioId}`);
export const pushToSheet = (audioId) => reportApi.post(`/audio/push-to-sheet/${audioId}`);
export const getSheetsUrl = () => reportApi.get('/config/sheets-url');

// ── Report Agent: Call Analysis ──
export const analyzeCall = (audioId) =>
  reportApi.post('/call-analysis/', {}, { headers: { 'audio-id': audioId } });
export const getAnalysisReports = () => reportApi.get('/call-analysis/reports');
export const getManagerDashboard = (date) =>
  reportApi.get('/call-analysis/manager-dashboard', date ? { params: { date } } : {});
export const clearAllCallAnalysis = () => reportApi.delete('/call-analysis/clear-all');
export const deleteCallAnalysis = (audioId) => reportApi.delete(`/call-analysis/${audioId}`);
export const syncSheetColumns = () => reportApi.post('/call-analysis/sync-sheet-columns');


export const getCallAudio = (audioId) =>
  reportApi.get(`/audio/file/${audioId}`, { responseType: 'blob' });

export const downloadExecutiveReport = (audioId) =>
  reportApi.get(`/call-analysis/reports/${audioId}/download`, { responseType: 'blob' });

export const sendExecutiveReportEmail = (audioId, data) =>
  reportApi.post(`/call-analysis/reports/${audioId}/email`, data);

export const saveManualScoreOverride = (audioId, data) =>
  reportApi.put(`/call-analysis/reports/${audioId}/manual-override`, data);

export const emailExecutiveComparison = (data) =>
  reportApi.post('/call-analysis/executive-comparison-email', data);

// ── Report Agent: Weight Config ──
export const getWeightConfig = () => reportApi.get('/weights/');
export const updateWeightConfig = (data) => reportApi.put('/weights/', data);
export const resetWeightConfig = () => reportApi.post('/weights/reset');

// ── Chatbot: Knowledge Base management ──
export const getKbs = () => reportApi.get('/kb');
export const createKb = (name) => reportApi.post('/kb', { name });
export const deleteKb = (name) => reportApi.delete(`/kb/${encodeURIComponent(name)}`);
export const getActiveKb = () => reportApi.get('/kb/active');
export const setActiveKb = (name) => reportApi.post('/kb/active', { name });
export const getKbFiles = (name) => reportApi.get(`/kb/${encodeURIComponent(name)}/files`);
export const uploadKbFile = (name, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return reportApi.post(`/kb/${encodeURIComponent(name)}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteKbFile = (name, sourceFile) =>
  reportApi.delete(`/kb/${encodeURIComponent(name)}/files/${encodeURIComponent(sourceFile)}`);
export const scrapeKbUrl = (url, kbName) => reportApi.post('/scrape', { url, kb_name: kbName });

// ── Chatbot: Chat ──
export const askChatbot = (query, kbName, history = [], provider = 'groq') =>
  reportApi.post(provider === 'ollama' ? '/askus' : '/askgroq', { query, kb_name: kbName, history });

// ── Billing (Stripe; Tenant Admin only, always for their own tenant) ──
export const getBillingPlans = () => api.get('/api/v1/billing/plans');
export const getBillingSubscription = () => api.get('/api/v1/billing/subscription');
export const syncBillingSubscription = () => api.post('/api/v1/billing/sync');
export const getBillingInvoices = () => api.get('/api/v1/billing/invoices');
export const createCheckoutSession = (plan, interval = 'month') => api.post('/api/v1/billing/checkout-session', { plan, interval });
export const createPortalSession = () => api.post('/api/v1/billing/portal-session');
export const changeBillingPlan = (plan, interval = 'month') => api.post('/api/v1/billing/change-plan', { plan, interval });
export const cancelBillingSubscription = () => api.post('/api/v1/billing/cancel');
export const resumeBillingSubscription = () => api.post('/api/v1/billing/resume');

export { authApi, reportApi, voiceApi, http, API_BASE };
export default voiceApi;
