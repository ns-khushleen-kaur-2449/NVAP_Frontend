import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import AgentImportPage from './AgentImport';

jest.mock('@/lib/api');
const api = require('@/lib/api');
const VAPI_ID = '6c1f0c2e-1111-4a2b-9c3d-123456789abc';
const PREVIEW = {
  vapi_assistant_id: VAPI_ID, name: 'Riya - Apex', model: { provider: 'openai', model: 'gpt-4.1' },
  voice: { provider: '11labs', voice_id: 'voice-1' }, language: 'en',
  tools: [{ name: 'book_appointment', kind: 'platform' }],
  server: { configured: false, points_to_smartsdr: false, host: null }, prompt_preview: 'You are Riya…',
  warnings: [{ code: 'inbound_webhook', message: 'Inbound calls may not be logged.' }],
  status: 'not_imported', imported: false,
};

beforeEach(() => {
  jest.resetAllMocks();
  api.fetchAdminAgent.mockResolvedValue({ data: PREVIEW });
  api.importAdminAgent.mockResolvedValue({ data: { id: 42 } });
});

async function fetchPreview() {
  renderWithAuth(<AgentImportPage />, { user: USERS.super_admin, path: '/admin/agents/import' });
  fireEvent.change(screen.getByLabelText(/Vapi assistant ID/), { target: { value: ` ${VAPI_ID} ` } });
  fireEvent.click(screen.getByRole('button', { name: /fetch/i }));
}

test('fetches and shows the safe preview and warnings', async () => {
  await fetchPreview();
  expect(api.fetchAdminAgent).toHaveBeenCalledWith(VAPI_ID);
  expect(await screen.findByText('Riya - Apex')).toBeInTheDocument();
  expect(screen.getByText(/openai/)).toBeInTheDocument();
  expect(screen.getByText(/gpt-4\.1/)).toBeInTheDocument();
  expect(screen.getByText('book_appointment')).toBeInTheDocument();
  expect(screen.getByText('Inbound calls may not be logged.')).toBeInTheDocument();
});

test('shows a loading state and explains an assistant may belong to another account', async () => {
  let reject;
  api.fetchAdminAgent.mockReturnValue(new Promise((_, r) => { reject = r; }));
  await fetchPreview();
  expect(screen.getByRole('button', { name: /fetch/i })).toBeDisabled();
  reject({ response: { data: { detail: 'Vapi cannot find this assistant; it may not exist or may belong to another Vapi account' } } });
  expect(await screen.findByRole('alert')).toHaveTextContent('another Vapi account');
});

test('imports locally with an audit reason', async () => {
  const user = userEvent.setup();
  await fetchPreview();
  await user.click(await screen.findByRole('button', { name: /import locally/i }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText(/reason/i), 'Approved onboarding');
  await user.click(within(dialog).getByRole('button', { name: /import/i }));
  await waitFor(() => expect(api.importAdminAgent).toHaveBeenCalledWith(VAPI_ID, 'Approved onboarding'));
});
