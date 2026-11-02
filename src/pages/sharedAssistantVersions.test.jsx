import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentsAdminPage from '@/pages/admin/AgentsAdmin';
import { parseAssistantJson } from '@/lib/agents';
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
  getAgentHealth: jest.fn(),
  listAgentAssistantVersions: jest.fn(),
  importAgentAssistantVersion: jest.fn(),
  createAgentAssistantDraft: jest.fn(),
  checkAgentAssistantVersion: jest.fn(),
  publishAgentAssistantVersion: jest.fn(),
  rollbackAgentAssistantVersion: jest.fn(),
}));

const AGENT = { id: 'a-2', key: 'hiring', name: 'Hiring', industry: 'HR', status: 'active', access_scope: 'selected' };
const ROW = { id: 'r-1', agent_id: 'a-2', vapi_assistant_id: 'vapi-1', name: 'Intake', purpose: 'intake', published_version: 2 };
const version = (n, status, payload, extra = {}) => ({
  id: `v-${n}`, agent_assistant_id: 'r-1', version: n, status, payload, copied_from: null, created_by: 1,
  created_at: '2026-11-02T08:00:00Z', published_by: null, published_at: null, ...extra,
});
const VERSIONS = [
  version(3, 'draft', { firstMessage: 'Draft hello' }),
  version(2, 'published', { firstMessage: 'Live hello' }),
  version(1, 'superseded', { firstMessage: 'Old hello' }),
];

beforeEach(() => {
  jest.clearAllMocks();
  api.listAgents.mockResolvedValue({ data: [AGENT] });
  api.getAgentHealth.mockResolvedValue({ data: { key: 'hiring', has_code: false, ok: false, problems: ['no_code_pack'] } });
  api.listAgentAssistants.mockResolvedValue({ data: [ROW] });
  api.listAgentAssistantVersions.mockResolvedValue({ data: VERSIONS });
  api.importAgentAssistantVersion.mockResolvedValue({ data: {} });
  api.createAgentAssistantDraft.mockResolvedValue({ data: version(4, 'draft', {}) });
  api.checkAgentAssistantVersion.mockResolvedValue({ data: { ok: true, problems: [] } });
  api.publishAgentAssistantVersion.mockResolvedValue({ data: {} });
  api.rollbackAgentAssistantVersion.mockResolvedValue({ data: version(4, 'published', {}, { copied_from: 1 }) });
});

async function openVersions(user) {
  renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
  await user.click(within(await screen.findByTestId('agent-row-hiring')).getByRole('button', { name: 'Assistants' }));
  const assistants = await screen.findByTestId('agent-assistants-dialog');
  await user.click(await within(assistants).findByRole('button', { name: 'Versions of Intake' }));
  return screen.findByTestId('assistant-versions-dialog');
}

describe('parseAssistantJson', () => {
  test('accepts a JSON object and explains anything else', () => {
    expect(parseAssistantJson('{"name": "x"}')).toEqual({ payload: { name: 'x' } });
    expect(parseAssistantJson('{name: x}')).toEqual({ error: "That isn't valid JSON" });
    expect(parseAssistantJson('[1]')).toEqual({ error: 'The assistant must be a JSON object' });
    expect(parseAssistantJson('null')).toEqual({ error: 'The assistant must be a JSON object' });
    expect(parseAssistantJson('{}')).toEqual({ error: 'The assistant JSON is empty' });
  });
});

describe('Shared assistant versions (Super Admin)', () => {
  test('the assistant list shows which version is live', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    await user.click(within(await screen.findByTestId('agent-row-hiring')).getByRole('button', { name: 'Assistants' }));
    expect(await screen.findByText('Versions (live: 2)')).toBeInTheDocument();
  });

  test('with no versions it offers only the import, then shows what was imported', async () => {
    api.listAgentAssistantVersions.mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [version(1, 'published', { name: 'Intake' })] });
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    expect(await within(dialog).findByText(/only reads the assistant/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /import from vapi/i }));
    await waitFor(() => expect(api.importAgentAssistantVersion).toHaveBeenCalledWith('a-2', 'r-1'));
    expect(await within(dialog).findByTestId('version-row-1')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/assistant json/i).value).toContain('"name": "Intake"');
  });

  test('lists versions with the actions each status allows, starting from the live JSON', async () => {
    const dialog = await openVersions(userEvent.setup());
    const draft = await within(dialog).findByTestId('version-row-3');
    expect(within(draft).getByText('Draft')).toBeInTheDocument();
    expect(within(draft).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    const live = within(dialog).getByTestId('version-row-2');
    expect(within(live).getByText('Live')).toBeInTheDocument();
    expect(within(live).queryByRole('button', { name: /publish|restore/i })).not.toBeInTheDocument();
    expect(within(within(dialog).getByTestId('version-row-1')).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/assistant json/i).value).toContain('Live hello');
  });

  test('saving a draft needs valid JSON', async () => {
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    const editor = await within(dialog).findByLabelText(/assistant json/i);
    await user.clear(editor);
    await user.type(editor, 'not json');
    await user.click(within(dialog).getByRole('button', { name: /save as draft/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent("That isn't valid JSON");
    expect(api.createAgentAssistantDraft).not.toHaveBeenCalled();
    await user.clear(editor);
    await user.type(editor, '{{"firstMessage": "Hi"}');
    await user.click(within(dialog).getByRole('button', { name: /save as draft/i }));
    await waitFor(() => expect(api.createAgentAssistantDraft).toHaveBeenCalledWith('a-2', 'r-1', { firstMessage: 'Hi' }));
  });

  test('the check lists its problems', async () => {
    api.checkAgentAssistantVersion.mockResolvedValue({ data: { ok: false, problems: ["Tool 'x' belongs to another agent"] } });
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    await user.click(within(await within(dialog).findByTestId('version-row-3')).getByRole('button', { name: 'Check' }));
    const result = await within(dialog).findByTestId('version-check');
    expect(result).toHaveTextContent("Version 3 can't be published yet");
    expect(result).toHaveTextContent("Tool 'x' belongs to another agent");
    expect(api.checkAgentAssistantVersion).toHaveBeenCalledWith('a-2', 'r-1', 3);
  });

  test('publishing asks first and says it reaches every organisation', async () => {
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    await user.click(within(await within(dialog).findByTestId('version-row-3')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/every organisation using Hiring/i);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.publishAgentAssistantVersion).not.toHaveBeenCalled();
    await user.click(within(within(dialog).getByTestId('version-row-3')).getByRole('button', { name: 'Publish' }));
    // While the confirmation is open, only its own Publish button is reachable.
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.publishAgentAssistantVersion).toHaveBeenCalledWith('a-2', 'r-1', 3));
  });

  test("a publish the backend refuses shows the check's problems", async () => {
    api.publishAgentAssistantVersion.mockRejectedValue({ response: { status: 422, data: { detail: {
      message: 'The staged check failed, so nothing was published',
      problems: ["Webhook settings cannot be changed here; remove 'server'"] } } } });
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    await user.click(within(await within(dialog).findByTestId('version-row-3')).getByRole('button', { name: 'Publish' }));
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('nothing was published');
    expect(within(dialog).getByTestId('version-check')).toHaveTextContent("remove 'server'");
  });

  test('restoring an earlier version asks first, then restores it', async () => {
    const user = userEvent.setup();
    const dialog = await openVersions(user);
    await user.click(within(await within(dialog).findByTestId('version-row-1')).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/copied into a new version/i);
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(api.rollbackAgentAssistantVersion).toHaveBeenCalledWith('a-2', 'r-1', 1));
  });
});
