import { fireEvent, screen, waitFor } from '@testing-library/react';
import LeadScoringSettings from './LeadScoringSettings';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = require('@/lib/api');
const { toast } = require('sonner');

const HASH = 'a'.repeat(64);
const param = (parameter, label, group, extra = {}) => ({
  parameter, label, group, feature: parameter, configurable: true, enabled: true, base_weight: 10, effective_weight: 10, ...extra,
});
const config = (disabled = []) => ({
  data: {
    tenant_id: 't1', methodology_version: 'v2', config_hash: HASH, default_config_hash: HASH, tenant_override: false, disabled,
    parameters: [
      param('seniority', 'Seniority', 'fit', { enabled: !disabled.includes('seniority') }),
      param('company_size', 'Company size', 'fit', { enabled: !disabled.includes('company_size') }),
      param('department', 'Department', 'fit', { enabled: !disabled.includes('department') }),
      param('intent_status', 'Intent status', 'engagement', { configurable: false }),
      param('intent_freshness', 'Intent freshness adjustment', 'engagement', { base_weight: null, effective_weight: null }),
    ],
    group_weights: { fit: 60, engagement: 40 },
    thresholds: [{ label: 'HOT', min: 70, max: 100 }, { label: 'WARM', min: 40, max: 69 }, { label: 'COLD', min: 0, max: 39 }],
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  api.getLeadScoringConfig.mockResolvedValue(config());
  api.getLeadScoringConfigHistory.mockResolvedValue({ data: { items: [] } });
});

const box = (name) => screen.getByRole('checkbox', { name });
const open = async (user) => { renderWithAuth(<LeadScoringSettings />, { user, path: '/settings' }); await screen.findByText('Seniority'); };

it('shows parameters, weights and thresholds', async () => {
  await open(USERS.tenant_admin);
  expect(box('Seniority')).toBeChecked();
  expect(screen.getByText(/HOT 70–100 · WARM 40–69 · COLD 0–39/)).toBeInTheDocument();
  expect(screen.getByText(/fit · 60 points/i)).toBeInTheDocument();
  expect(api.getLeadScoringConfig).toHaveBeenCalledWith({});
});

it('is read-only for a Manager', async () => {
  await open(USERS.manager);
  expect(screen.getByText('View only.')).toBeInTheDocument();
  expect(box('Seniority')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('lets a Tenant Admin edit, but never intent status', async () => {
  await open(USERS.tenant_admin);
  expect(box('Seniority')).toBeEnabled();
  expect(box('Intent status')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('blocks switching off every Fit parameter', async () => {
  await open(USERS.tenant_admin);
  ['Seniority', 'Company size', 'Department'].forEach((n) => fireEvent.click(box(n)));
  expect(screen.getByText(/At least one Fit parameter must stay on/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('undo restores the saved state', async () => {
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  expect(box('Department')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
  expect(box('Department')).toBeChecked();
});

it('saves with the reason and the config hash it loaded', async () => {
  api.updateLeadScoringConfig.mockResolvedValue({ data: { ...config(['department']).data, changed: true } });
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  fireEvent.click(box('Intent freshness adjustment'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Department: on → off')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Not useful for us' } });
  api.getLeadScoringConfig.mockResolvedValue(config(['department', 'intent_freshness']));
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).pop());
  await waitFor(() => expect(api.updateLeadScoringConfig).toHaveBeenCalledTimes(1));
  expect(api.updateLeadScoringConfig).toHaveBeenCalledWith(
    { disabled: ['department', 'intent_freshness'], reason: 'Not useful for us', expected_config_hash: HASH }, {});
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  await waitFor(() => expect(api.getLeadScoringConfig).toHaveBeenCalledTimes(2)); // reloaded
});

it('reloads after a 409 conflict', async () => {
  api.updateLeadScoringConfig.mockRejectedValue({ response: { status: 409, data: { detail: { message: 'changed since read' } } } });
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: 'x' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).pop());
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('changed since read'));
  await waitFor(() => expect(api.getLeadScoringConfig).toHaveBeenCalledTimes(2));
});

it('lists the change history', async () => {
  api.getLeadScoringConfigHistory.mockResolvedValue({ data: { items: [{
    event_id: 1, reason: 'QA test', created_at: '2026-10-30T11:35:26Z', new_value: { disabled: ['department'] },
  }] } });
  await open(USERS.tenant_admin);
  expect(screen.getByText('Change history (1)')).toBeInTheDocument();
  expect(screen.getByText('“QA test”')).toBeInTheDocument();
  expect(screen.getByText('Turned off: Department')).toBeInTheDocument();
});

it('shows an error with retry when loading fails', async () => {
  api.getLeadScoringConfig.mockRejectedValue({ response: { status: 503, data: { detail: 'Lead scoring is not available' } } });
  renderWithAuth(<LeadScoringSettings />, { user: USERS.tenant_admin, path: '/settings' });
  expect(await screen.findByText(/Lead scoring is not available/)).toBeInTheDocument();
});
