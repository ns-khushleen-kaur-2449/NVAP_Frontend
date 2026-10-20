import axios from 'axios';

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
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  });
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      // A 403 the user must act on (temporary password, suspended organisation): AuthContext shows the screen.
      const action = error.response?.headers?.['x-auth-required-action'];
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

// ── Admin: users, teams, tenants, role dashboard ──
export const listAdminUsers = (params) => api.get('/api/users', { params });
export const updateAdminUser = (id, data) => api.patch(`/api/users/${id}`, data);
export const deactivateUser = (id) => api.post(`/api/users/${id}/deactivate`);
export const reactivateUser = (id) => api.post(`/api/users/${id}/reactivate`);
export const moveUserToTeam = (id, managerUserId) => api.put(`/api/users/${id}/team`, { manager_user_id: managerUserId });
export const listTeams = () => api.get('/api/teams');
export const listTenants = () => api.get('/api/tenants');
export const createTenantWithAdmin = (data) => api.post('/api/tenants/with-admin', data);
export const suspendTenant = (id) => api.post(`/api/tenants/${id}/suspend`);
export const activateTenant = (id) => api.post(`/api/tenants/${id}/activate`);
export const getRoleDashboard = () => api.get('/api/v1/dashboard');
// Users the caller may see (was /api/auth/users, which never existed).
export const listUsers = () => authApi.get('/api/users', { params: { page_size: 100 } });

// ── Dashboard & Admin ──
export const getDashboardStats = () => api.get('/api/dashboard/stats');
export const getSystemHealth = () => api.get('/api/admin/system-health');

// ── Prospects (the only person record; "leads" are prospects with leads_only=true) ──
export const getProspects = (params) => api.get('/api/v1/prospects', { params });
export const getProspect = (id) => api.get(`/api/v1/prospects/${id}`);
export const createProspect = (data, params) => api.post('/api/v1/prospects', data, { params });
export const updateProspect = (id, data) => api.patch(`/api/v1/prospects/${id}`, data);
export const deleteProspect = (id) => api.delete(`/api/v1/prospects/${id}`);
export const changeProspectStage = (id, stage, reason) =>
  api.post(`/api/v1/prospects/${id}/stage`, { stage: String(stage).toUpperCase(), reason });
export const getProspectStageEvents = (id) => api.get(`/api/v1/prospects/${id}/stage-events`);
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
// who may use it: Tenant Admins, Managers and Sales Reps of tenants it is enabled for.
// → { enabled, reason } — reason is null when enabled, otherwise one of
//   integration_disabled | not_configured | role_not_allowed | tenant_not_allowed
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
export const getInbox = () => api.get('/api/inbox');

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
// Parses a CSV/XLSX without storing anything; returns { filename, total, skipped_rows, contacts }.
export const previewCampaignCsv = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/campaigns/csv-preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
// Start a draft/scheduled campaign now, or pass scheduledAt to (re)schedule it.
export const startVoiceCampaign = (id, scheduledAt) =>
  api.post(`/api/campaigns/${id}/start`, scheduledAt ? { scheduled_at: scheduledAt } : {});
export const cancelVoiceCampaign = (id) => api.post(`/api/campaigns/${id}/cancel`);
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
// One immediate outbound call (Single Call tab).
export const initiateSmartsdrCall = ({ phone_number, user_name, assistant_id }) => {
  const body = new URLSearchParams();
  body.append('phone_number', phone_number || '');
  body.append('user_name', user_name || '');
  if (assistant_id) {
    body.append('assistant_id', assistant_id);
  }
  return api.post('/api/smartsdr-calls', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};
export const scheduleVoiceCall = (data) => api.post('/api/voice/schedule', data);

export const createKnowledgeBase = (payload, file) => {
  if (file) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, value);
    });
    formData.append('file', file);
    return api.post('/api/knowledge-base', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/api/knowledge-base', payload);
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
export const uploadKnowledgeFile = (assistantId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  if (assistantId) fd.append('assistant_id', assistantId);
  return api.post('/api/v1/assistants/knowledge-base', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getKnowledgeFiles = () => api.get('/api/v1/assistants/knowledge-base/files');

// ── Assistant Builder (guided, versioned configs published to Vapi) ──
export const getCatalogItems = () => api.get('/api/v1/catalog/items');
export const previewBuilderConfig = (data) => api.post('/api/v1/assistant-builder/preview', data);
export const listBuilderConfigs = () => api.get('/api/v1/assistant-builder/configs');
export const getBuilderConfig = (id) => api.get(`/api/v1/assistant-builder/configs/${id}`);
export const createBuilderConfig = (data) => api.post('/api/v1/assistant-builder/configs', data);
export const updateBuilderConfig = (id, data) => api.put(`/api/v1/assistant-builder/configs/${id}`, data);
export const publishBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/publish`, null, { params: version ? { version } : {} });
export const rollbackBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/rollback/${version}`);
export const retryBuilderConfig = (id, version) =>
  api.post(`/api/v1/assistant-builder/configs/${id}/retry/${version}`);

// ── Tools (Super Admin: platform Vapi tools) ──
export const listToolTypes = () => api.get('/api/v1/tools/types');
export const listTools = () => api.get('/api/v1/tools');
export const createTool = (data) => api.post('/api/v1/tools', data);
export const updateTool = (id, data) => api.patch(`/api/v1/tools/${id}`, data);
export const syncTool = (id) => api.post(`/api/v1/tools/${id}/sync`);
export const deleteTool = (id) => api.delete(`/api/v1/tools/${id}`);
export const previewTool = (data) => api.post('/api/v1/tools/preview', data);
// Create (or re-sync) the six appointment tools in Vapi; safe to re-run.
export const registerAppointmentTools = () => api.post('/api/v1/tools/register');
export const getToolTenants = (id) => api.get(`/api/v1/tools/${id}/tenants`);
export const setToolTenants = (id, tenantIds) => api.put(`/api/v1/tools/${id}/tenants`, { tenant_ids: tenantIds });
// Tools on one assistant (tools granted to its tenant; Tenant Admin attaches/detaches).
export const listAssistantTools = (assistantId) => api.get(`/api/v1/assistants/${assistantId}/tools`);
// Tools an Assistant Builder agent can be given (granted to the tenant), each with the tool types it needs.
export const listBuilderTools = () => api.get('/api/v1/assistant-builder/tools');
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

export { authApi, reportApi, voiceApi, http, API_BASE };
export default voiceApi;
