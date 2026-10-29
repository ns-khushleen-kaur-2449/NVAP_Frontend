import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import AgentsAdminPage from '@/pages/admin/AgentsAdmin';
import AgentsPage from '@/pages/Agents';
import RequirePermission from '@/components/auth/RequirePermission';
import { Sidebar } from '@/components/layout/Sidebar';
import { PERMISSIONS } from '@/lib/rbac';
import { agentRoute, accessSummary } from '@/lib/agents';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  getAgentAccess: jest.fn(),
  setAgentAccess: jest.fn(),
  listAgentAssistants: jest.fn(),
  registerAgentAssistant: jest.fn(),
  removeAgentAssistant: jest.fn(),
  listAvailableAgents: jest.fn(),
}));

const AGENTS = [
  { id: 'a-1', key: 'sdr', name: 'SmartSDR', industry: 'Sales', description: 'Outbound sales calls', status: 'active', access_scope: 'all' },
  { id: 'a-2', key: 'hiring', name: 'Hiring', industry: 'HR', description: null, status: 'draft', access_scope: 'selected' },
];

beforeEach(() => {
  jest.clearAllMocks();
  api.listAgents.mockResolvedValue({ data: AGENTS });
  api.updateAgent.mockResolvedValue({ data: {} });
  api.createAgent.mockResolvedValue({ data: {} });
  api.setAgentAccess.mockResolvedValue({ data: {} });
  api.getAgentAccess.mockResolvedValue({ data: [
    { tenant_id: 't-1', name: 'Apex Motors', granted: true, granted_at: null },
    { tenant_id: 't-2', name: 'Bright Homes', granted: false, granted_at: null },
  ] });
  api.listAgentAssistants.mockResolvedValue({ data: [] });
  api.registerAgentAssistant.mockResolvedValue({ data: {} });
  api.listAvailableAgents.mockResolvedValue({ data: [AGENTS[0], AGENTS[1]] });
});

describe('agent permissions', () => {
  const guarded = (perm) => <RequirePermission perm={perm}><p>Allowed</p></RequirePermission>;
  const routes = [<Route key="403" path="/403" element={<p>Forbidden</p>} />];

  test.each([
    ['super_admin', 'Allowed'], ['tenant_admin', 'Forbidden'], ['manager', 'Forbidden'], ['rep', 'Forbidden'],
  ])('%s opening the catalog admin sees %s', (role, text) => {
    renderWithAuth(guarded(PERMISSIONS.AGENTS_MANAGE), { user: USERS[role], path: '/x', routes });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test.each(['super_admin', 'tenant_admin', 'manager', 'rep'])('%s may view the agents list', (role) => {
    renderWithAuth(guarded(PERMISSIONS.AGENTS_VIEW), { user: USERS[role], path: '/x', routes });
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  test('only the Super Admin sees the catalog admin link; everyone sees Agents', () => {
    const { unmount } = renderWithAuth(<Sidebar />, { user: USERS.super_admin, path: '/dashboard' });
    expect(screen.getByTestId('nav-agent catalog')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    unmount();
    renderWithAuth(<Sidebar />, { user: USERS.rep, path: '/dashboard' });
    expect(screen.queryByTestId('nav-agent catalog')).not.toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });
});

describe('lib/agents', () => {
  test('only agents with a screen can be opened', () => {
    expect(agentRoute({ key: 'sdr' })).toBe('/voice_agent');
    expect(agentRoute({ key: 'hiring' })).toBeNull();
    expect(agentRoute(null)).toBeNull();
  });

  test('access summary', () => {
    expect(accessSummary({ access_scope: 'all' })).toBe('All organisations');
    expect(accessSummary({ access_scope: 'selected' })).toBe('Selected organisations');
  });
});

describe('Agents (tenant view)', () => {
  test('lists the available agents and opens only those with a screen', async () => {
    renderWithAuth(<AgentsPage />, { user: USERS.manager });
    const sdr = await screen.findByTestId('agent-card-sdr');
    expect(within(sdr).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/voice_agent');
    const hiring = screen.getByTestId('agent-card-hiring');
    expect(within(hiring).queryByRole('link')).not.toBeInTheDocument();
    expect(within(hiring).getByText(/coming soon/i)).toBeInTheDocument();
  });

  test('says so when nothing is available', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [] });
    renderWithAuth(<AgentsPage />, { user: USERS.rep });
    expect(await screen.findByText(/no agents are available/i)).toBeInTheDocument();
  });

  test('never shows Vapi details', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [{ ...AGENTS[0], vapi_assistant_id: 'secret-id' }] });
    renderWithAuth(<AgentsPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('agent-card-sdr');
    expect(screen.queryByText(/secret-id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/vapi/i)).not.toBeInTheDocument();
  });
});

describe('Agent catalog admin (Super Admin)', () => {
  test('lists agents with status and who may use them', async () => {
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const sdr = await screen.findByTestId('agent-row-sdr');
    expect(within(sdr).getByText('Active')).toBeInTheDocument();
    expect(within(sdr).getByText('All organisations')).toBeInTheDocument();
    expect(within(screen.getByTestId('agent-row-hiring')).getByText('Draft')).toBeInTheDocument();
  });

  test('activating a draft changes its status', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(api.updateAgent).toHaveBeenCalledWith('a-2', { status: 'active' }));
  });

  test('creating an agent needs a key and a name', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    await screen.findByTestId('agent-row-sdr');
    await user.click(screen.getByRole('button', { name: /new agent/i }));
    await user.click(screen.getByRole('button', { name: /create agent/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('A key and a name are required');
    expect(api.createAgent).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/key/i), 'finance');
    await user.type(screen.getByLabelText(/^name/i), 'Finance');
    await user.click(screen.getByRole('button', { name: /create agent/i }));
    await waitFor(() => expect(api.createAgent).toHaveBeenCalledWith(
      { key: 'finance', name: 'Finance', industry: null, description: null }));
  });

  test('access: choosing selected organisations sends exactly the ticked ones', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Access' }));
    const dialog = await screen.findByTestId('agent-access-dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Bright Homes' }));
    await user.click(within(dialog).getByRole('button', { name: /save access/i }));
    await waitFor(() => expect(api.setAgentAccess).toHaveBeenCalledWith('a-2', 'selected', expect.arrayContaining(['t-1', 't-2'])));
    expect(api.setAgentAccess.mock.calls[0][2]).toHaveLength(2);
  });

  test('access: all organisations sends no tenant list', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Access' }));
    const dialog = await screen.findByTestId('agent-access-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'All organisations' }));
    await user.click(within(dialog).getByRole('button', { name: /save access/i }));
    await waitFor(() => expect(api.setAgentAccess).toHaveBeenCalledWith('a-2', 'all', []));
  });

  test('registering a shared assistant needs an id and a name, then refreshes the list', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Assistants' }));
    const dialog = await screen.findByTestId('agent-assistants-dialog');
    await user.click(within(dialog).getByRole('button', { name: /register assistant/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A Vapi assistant id and a name are required');
    expect(api.registerAgentAssistant).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/vapi assistant id/i), 'vapi-123');
    await user.type(within(dialog).getByLabelText(/^name/i), 'Intake');
    await user.click(within(dialog).getByRole('button', { name: /register assistant/i }));
    await waitFor(() => expect(api.registerAgentAssistant).toHaveBeenCalledWith('a-2',
      { vapi_assistant_id: 'vapi-123', name: 'Intake', purpose: null }));
    await waitFor(() => expect(api.listAgentAssistants).toHaveBeenCalledTimes(2));
  });
});
