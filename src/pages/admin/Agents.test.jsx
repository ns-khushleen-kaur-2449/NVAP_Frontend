import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import AgentsPage from './Agents';
import AgentDetailPage from './AgentDetail';

jest.mock('@/lib/api');
const api = require('@/lib/api');

const BUILT = {
  id: 7, name: 'Riya', vapi_assistant_id: 'v-7', status: 'live', source: 'tenant', read_only: true, publish_status: 'live',
  owner: { tenant_id: 't-1', tenant_name: 'Apex Motors', tenant_status: 'active' },
  model: { provider: 'openai', model: 'gpt-4.1' }, voice: { provider: '11labs', voice_id: 'voice-7' }, language: 'en',
  tools: ['book_appointment'],
};
const IMPORTED = { ...BUILT, id: 8, name: 'Imported agent', source: 'imported', read_only: false, publish_status: 'draft', owner: null, tools: [] };

beforeEach(() => {
  jest.resetAllMocks();
  api.listAdminAgents.mockResolvedValue({ data: { agents: [BUILT, IMPORTED], total: 2 } });
  api.listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-1', name: 'Apex Motors', status: 'active' }] } });
});

test('lists imported agents and the ones tenants built', async () => {
  renderWithAuth(<AgentsPage />, { user: USERS.super_admin, path: '/admin/agents' });
  const built = await screen.findByTestId('agent-row-7');
  expect(built).toHaveTextContent('Built by tenant');
  expect(built).toHaveTextContent('Apex Motors');
  expect(built).toHaveTextContent('Live');
  expect(built).toHaveTextContent('voice-7');
  expect(screen.getByTestId('agent-row-8')).toHaveTextContent('Unassigned');
  expect(screen.getByTestId('agent-row-8')).toHaveTextContent('Imported');
});

test('searches on the server', async () => {
  renderWithAuth(<AgentsPage />, { user: USERS.super_admin, path: '/admin/agents' });
  await screen.findByTestId('agent-row-7');
  fireEvent.change(screen.getByLabelText('Search agents'), { target: { value: 'riya' } });
  await waitFor(() => expect(api.listAdminAgents).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'riya', page: 1 })));
});

test('a tenant-built agent opens read only, with no way to change it', async () => {
  api.getAdminAgent.mockResolvedValue({ data: BUILT });
  renderWithAuth(<div />, {
    user: USERS.super_admin, path: '/admin/agents/7',
    routes: [<Route key="a" path="/admin/agents/:agentId" element={<AgentDetailPage />} />],
  });
  expect(await screen.findByTestId('tenant-built-agent')).toHaveTextContent('book_appointment');
  expect(screen.queryByRole('button', { name: /refresh from vapi/i })).not.toBeInTheDocument();
  expect(screen.queryByText('Assign tenant')).not.toBeInTheDocument();
  expect(screen.queryByText('Tenant granted tools')).not.toBeInTheDocument();
  expect(screen.queryByText(/Configuration snapshot/)).not.toBeInTheDocument();
});
