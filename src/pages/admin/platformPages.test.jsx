import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import ControlsPage from './Controls';
import OperationsPage from './Operations';
import UsagePage from './Usage';
import AdminOverviewPage from './Overview';
import HierarchyPage from './Hierarchy';
import TenantSettingsDialog from '@/components/admin/TenantSettingsDialog';

jest.mock('@/lib/api');
const api = require('@/lib/api');

const CONTROLS = { global_pause: { paused: false, paused_at: null, reason: null }, paused_tenants: [], disabled_agents: [] };
const render = (ui) => renderWithAuth(ui, { user: USERS.super_admin, path: '/admin/x' });

beforeEach(() => {
  jest.resetAllMocks();
  api.listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-1', name: 'Apex', status: 'active' }] } });
  api.getAdminControls.mockResolvedValue({ data: CONTROLS });
});

async function confirmWithReason(reason, button) {
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole('button', { name: button }));
}

test('pausing all calling asks for a reason and shows the result', async () => {
  api.pauseAllDialing.mockResolvedValue({ data: { ...CONTROLS, global_pause: { paused: true, paused_at: '2026-11-06T10:00:00Z', reason: 'Carrier outage' } } });
  render(<ControlsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pause all calling' }));
  await confirmWithReason('Carrier outage', 'Pause all calling');
  await waitFor(() => expect(api.pauseAllDialing).toHaveBeenCalledWith('Carrier outage'));
  expect(await screen.findByTestId('global-pause')).toHaveTextContent('Carrier outage');
});

test('a paused tenant can be resumed with a reason', async () => {
  api.getAdminControls.mockResolvedValue({ data: { ...CONTROLS, paused_tenants: [{ tenant_id: 't-1', name: 'Apex', paused_at: '2026-11-06T10:00:00Z', reason: 'Abuse' }] } });
  api.resumeTenantDialing.mockResolvedValue({ data: CONTROLS });
  render(<ControlsPage />);
  fireEvent.click(within(await screen.findByTestId('paused-tenant-t-1')).getByRole('button', { name: 'Resume' }));
  await confirmWithReason('Sorted', 'Resume');
  await waitFor(() => expect(api.resumeTenantDialing).toHaveBeenCalledWith('t-1', 'Sorted'));
});

test('operations show codes and retry only what can be retried', async () => {
  api.getAdminOperations.mockResolvedValue({ data: {
    workers: [{ name: 'campaign_runner', state: 'late', last_seen_at: null, last_error_at: '2026-11-06T11:39:05Z', last_error: 'A database query failed (ProgrammingError)' }],
    failures: { webhooks: [{ kind: 'webhook', id: 'w-1', tenant_id: 't-1', call_id: 'c-1', error_code: 'ValueError', occurred_at: null, retryable: false }],
      emails: [{ kind: 'email', id: 'e-1', tenant_id: 't-1', call_id: null, error_code: 'NylasError', occurred_at: null, retryable: true }], syncs: [], jobs: [] },
  } });
  api.retryOperation.mockResolvedValue({ data: {} });
  render(<OperationsPage />);
  expect(await screen.findByTestId('workers')).toHaveTextContent('Late');
  expect(screen.getByTestId('worker-campaign_runner')).toHaveTextContent('A database query failed (ProgrammingError)');
  expect(within(screen.getByTestId('failure-w-1')).queryByRole('button')).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByTestId('failure-e-1')).getByRole('button', { name: 'Retry' }));
  await confirmWithReason('Mailbox fixed', 'Retry');
  await waitFor(() => expect(api.retryOperation).toHaveBeenCalledWith('email', 'e-1', 'Mailbox fixed'));
});

test('usage shows seats and opens the limits of that tenant', async () => {
  api.getAdminUsage.mockResolvedValue({ data: { totals: { calls: 0, minutes: 0, cost: null, calls_with_unknown_cost: 0 }, tenants: [
    { tenant_id: 't-1', name: 'Apex', calls: 0, minutes: 0, cost: null, calls_with_unknown_cost: 0, monthly_minutes_limit: null, limit_warning: null,
      monthly_calls: { used: 80, limit: 100, full: false }, manager_seats: { used: 2, limit: 2, full: true }, rep_seats: { used: 4, limit: null, full: false } }] } });
  const limits = { monthly_minutes: null, monthly_calls: 100, concurrent_calls: null, manager_seats: 2, rep_seats: null };
  api.getTenantSettings.mockResolvedValue({ data: { status: 'active', dialing_paused: false, limits, features: [], tenant_admins: [] } });
  api.setTenantLimits.mockResolvedValue({ data: { status: 'active', dialing_paused: false, limits: { ...limits, rep_seats: 10 }, features: [], tenant_admins: [] } });
  render(<UsagePage />);
  const row = await screen.findByTestId('usage-row-t-1');
  expect(row).toHaveTextContent('2 / 2');
  expect(row).toHaveTextContent('80 / 100');
  expect(row).toHaveTextContent('4 / No limit');
  fireEvent.click(within(row).getByRole('button', { name: 'Edit limits' }));
  fireEvent.change(await screen.findByLabelText('Sales rep seats (enforced)'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save limits' }));
  const dialogs = await screen.findAllByRole('dialog');
  const reason = dialogs[dialogs.length - 1];
  fireEvent.change(within(reason).getByRole('textbox'), { target: { value: 'New contract' } });
  fireEvent.click(within(reason).getByRole('button', { name: 'Save limits' }));
  await waitFor(() => expect(api.setTenantLimits).toHaveBeenCalledWith('t-1',
    { monthly_minutes: null, monthly_calls: 100, concurrent_calls: null, manager_seats: 2, rep_seats: 10, reason: 'New contract' }));
});

test('usage shows unknown cost and limit warnings', async () => {
  api.getAdminUsage.mockResolvedValue({ data: { totals: { calls: 3, minutes: 9, cost: null, calls_with_unknown_cost: 3 }, tenants: [
    { tenant_id: 't-1', name: 'Apex', calls: 3, minutes: 9, cost: null, calls_with_unknown_cost: 3, monthly_minutes_limit: 10, limit_warning: 'near' }] } });
  render(<UsagePage />);
  expect(await screen.findByTestId('usage-cost')).toHaveTextContent('Unknown');
  expect(screen.getByTestId('usage-row-t-1')).toHaveTextContent('Near limit');
});

test('the overview shows alerts, usage and health', async () => {
  api.getAdminOverview.mockResolvedValue({ data: { tenants: { total: 2, active: 2, suspended: 0 }, window_days: 30,
    usage: { calls: 4, minutes: 12, bookings: 1, cost: 1.5 }, health: { workers: [{ name: 'campaign_runner', state: 'healthy' }] },
    alerts: [{ code: 'platform_paused', severity: 'critical', label: 'Outbound calling is paused for the platform', count: null }] } });
  render(<AdminOverviewPage />);
  expect(await screen.findByTestId('overview-alerts')).toHaveTextContent('Outbound calling is paused');
  expect(screen.getByTestId('overview-usage-cost')).toHaveTextContent('$1.50');
  expect(screen.getByTestId('overview-health')).toHaveTextContent('Healthy');
});

test('tenant settings save limits and switches with a reason', async () => {
  const settings = { status: 'active', dialing_paused: false, limits: { monthly_minutes: null, concurrent_calls: null },
    features: [{ key: 'campaigns', label: 'Campaigns', enabled: true }], tenant_admins: [{ id: 1, name: 'Owner', email: 'o@x.example', status: 'active' }] };
  api.getTenantSettings.mockResolvedValue({ data: settings });
  api.setTenantFeature.mockResolvedValue({ data: settings });
  render(<TenantSettingsDialog tenant={{ tenant_id: 't-1', name: 'Apex' }} onOpenChange={() => {}} />);
  fireEvent.click(await screen.findByRole('switch', { name: 'Campaigns' }));
  const dialogs = await screen.findAllByRole('dialog');
  const reason = dialogs[dialogs.length - 1];
  fireEvent.change(within(reason).getByRole('textbox'), { target: { value: 'Contract ended' } });
  fireEvent.click(within(reason).getByRole('button', { name: 'Switch off' }));
  await waitFor(() => expect(api.setTenantFeature).toHaveBeenCalledWith('t-1', 'campaigns', false, 'Contract ended'));
});

test('an orphaned record needs a tenant, its typed id and a reason before it can be reassigned', async () => {
  api.getAdminOperations.mockResolvedValue({ data: { workers: [], failures: { webhooks: [], emails: [], syncs: [], jobs: [] } } });
  api.getOrphans.mockResolvedValue({ data: { totals: { call_log: 1 }, items: [
    { type: 'call_log', label: 'Call log', id: '42', created_at: '2026-11-06T10:00:00', reason: 'It names no assistant', has_transcript: true, has_recording: false }] } });
  render(<OperationsPage />);
  const row = await screen.findByTestId('orphan-42');
  expect(row).toHaveTextContent('It names no assistant');
  expect(row).toHaveTextContent('transcript');
  fireEvent.click(within(row).getByRole('button', { name: 'Reassign' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Reassign' })).toBeDisabled();
  expect(api.reassignOrphan).not.toHaveBeenCalled();
});

test('the hierarchy shows totals, then each tenant opens to its people by name and email', async () => {
  const rep = (id, name, status = 'active') => ({ id, name, email: `${name.toLowerCase()}@apex.example`, status });
  api.getUserHierarchy.mockResolvedValue({ data: {
    totals: { users: 9, tenants: 1, tenant_admins: 1, managers: 2, sales_reps: 3, platform_admins: 1, active: 9, inactive: 0 },
    tenants: [{ tenant_id: 't-1', name: 'Apex', status: 'active', user_count: 6, manager_count: 2, sales_rep_count: 3,
      tenant_admins: [rep(1, 'Owner')],
      managers: [{ ...rep(7, 'Mona'), sales_reps: [rep(11, 'Asha'), rep(12, 'Bina', 'inactive')] }, { ...rep(8, 'Zed'), sales_reps: [] }],
      sales_reps_without_team: [rep(13, 'Solo')] }],
  } });
  render(<HierarchyPage />);
  expect(await screen.findByTestId('total-users')).toHaveTextContent('9');
  const tenant = screen.getByTestId('hierarchy-t-1');
  expect(tenant).toHaveTextContent('6 users');
  expect(tenant).not.toHaveTextContent('owner@apex.example');
  fireEvent.click(within(tenant).getByRole('button'));
  expect(screen.getByTestId('person-1')).toHaveTextContent('owner@apex.example');
  expect(screen.getByTestId('person-7')).toHaveTextContent('Mona');
  expect(screen.getByTestId('person-11')).toHaveTextContent('asha@apex.example');
  expect(screen.getByTestId('person-12')).toHaveTextContent('inactive');
  expect(tenant).toHaveTextContent('No sales reps');
  expect(tenant).toHaveTextContent('No manager');
  expect(screen.getByTestId('person-13')).toHaveTextContent('Solo');
});
