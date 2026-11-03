import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import AgentImportPage from './AgentImport';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const api = require('@/lib/api');
const VAPI_ID = '6c1f0c2e-1111-4a2b-9c3d-123456789abc';
const PREVIEW = {
  vapi_assistant_id: VAPI_ID, name: 'Riya - Apex', model: { provider: 'openai', model: 'gpt-4.1' },
  voice: { provider: '11labs', voice_id: 'voice-1', model: null }, language: 'en',
  tools: [{ name: 'book_appointment', kind: 'platform' }, { name: null, vapi_tool_id: 'vt-x', kind: 'unknown' }],
  server: { configured: false, points_to_smartsdr: false, host: null }, call_analysis_ready: true, owner: null,
  prompt_preview: 'You are Riya…',
  warnings: [{ code: 'inbound_webhook', message: 'Inbound calls may not be logged.', items: [] }],
};
const TENANTS = [
  { tenant_id: 't-1', name: 'Acme', status: 'active' },
  { tenant_id: 't-2', name: 'Dormant', status: 'suspended' },
];

beforeEach(() => {
  jest.resetAllMocks();
  api.listTenants.mockResolvedValue({ data: { tenants: TENANTS } });
  api.lookupAgent.mockResolvedValue({ data: PREVIEW });
});

async function lookUp(value = VAPI_ID) {
  renderWithAuth(<AgentImportPage />, { user: USERS.super_admin, path: '/admin/agents/import' });
  fireEvent.change(screen.getByLabelText(/Vapi assistant ID or agent ID/), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /look up/i }));
}

test('shows the safe preview and the warnings', async () => {
  await lookUp(`  ${VAPI_ID} `);
  const preview = await screen.findByTestId('agent-preview');
  expect(api.lookupAgent).toHaveBeenCalledWith(VAPI_ID);
  expect(within(preview).getByText('Riya - Apex')).toBeInTheDocument();
  expect(within(preview).getByText('openai · gpt-4.1')).toBeInTheDocument();
  expect(within(preview).getByText('Not set')).toBeInTheDocument();
  expect(within(preview).getByText('book_appointment')).toBeInTheDocument();
  expect(screen.getByTestId('agent-warnings')).toHaveTextContent('Inbound calls may not be logged.');
});

test('shows a loading state, then the error', async () => {
  let reject;
  api.lookupAgent.mockReturnValue(new Promise((_, r) => { reject = r; }));
  await lookUp();
  expect(screen.getByRole('button', { name: /look up/i })).toBeDisabled();
  reject({ response: { data: { detail: 'Vapi has no assistant with this id' } } });
  expect(await screen.findByTestId('agent-error')).toHaveTextContent('Vapi has no assistant with this id');
  expect(screen.queryByTestId('agent-preview')).not.toBeInTheDocument();
});

test('an agent another tenant owns cannot be assigned', async () => {
  api.lookupAgent.mockResolvedValue({ data: { ...PREVIEW, owner: { tenant_id: 't-9', tenant_name: 'Other Co', assistant_id: 7 } } });
  await lookUp();
  expect(await screen.findByTestId('agent-owner')).toHaveTextContent('Owned by Other Co');
  const assign = screen.getByTestId('agent-assign');
  expect(within(assign).getByTestId('agent-owned-note')).toBeInTheDocument();
  expect(within(assign).queryByRole('button', { name: /assign/i })).not.toBeInTheDocument();
});

test('assigns to an active tenant with a reason', async () => {
  const user = userEvent.setup();
  api.assignAgent.mockResolvedValue({ data: {
    assistant_id: 42, vapi_assistant_id: VAPI_ID, tenant_id: 't-1', created: true, already_assigned: false,
    status: 'imported', agent: { ...PREVIEW, owner: { tenant_id: 't-1', tenant_name: 'Acme', assistant_id: 42 } },
    warnings: [{ code: 'tools_not_granted', message: 'Not granted to the tenant.', items: ['book_appointment'] }],
  } });
  await lookUp();
  await screen.findByTestId('agent-preview');
  const assignButton = screen.getByRole('button', { name: 'Assign…' });
  expect(assignButton).toBeDisabled();
  await user.click(screen.getByRole('combobox', { name: 'Tenant' }));
  expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Acme']);
  await user.click(screen.getByRole('option', { name: 'Acme' }));
  await user.click(assignButton);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Assign' })).toBeDisabled();
  await user.type(within(dialog).getByLabelText(/Reason/), 'Onboarding Acme');
  await user.click(within(dialog).getByRole('button', { name: 'Assign' }));
  await waitFor(() => expect(api.assignAgent).toHaveBeenCalledWith(VAPI_ID, 't-1', 'Onboarding Acme'));
  expect(await screen.findByTestId('agent-assigned')).toHaveTextContent('Assigned as agent #42.');
  expect(screen.getByTestId('agent-warnings')).toHaveTextContent('book_appointment');
});
