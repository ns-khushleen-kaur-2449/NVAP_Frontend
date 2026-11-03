import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import TenantsPage from './Tenants';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const api = require('@/lib/api');
const TENANT = { tenant_id: 't-1', name: 'Acme', status: 'active', default_timezone: 'Asia/Kolkata', created_at: '2026-11-01T00:00:00Z',
  user_count: 3, active_user_count: 3, admin_count: 1 };

beforeEach(() => {
  jest.resetAllMocks();
  api.listAdminTenants.mockResolvedValue({ data: { tenants: [{ ...TENANT, active_assistant_count: 0, call_count: 0 }], total: 1 } });
  api.suspendTenant.mockResolvedValue({ data: { ...TENANT, status: 'suspended' } });
});

async function openSuspend() {
  renderWithAuth(<TenantsPage />, { user: USERS.super_admin, path: '/admin/tenants' });
  fireEvent.click(within(await screen.findByTestId('tenant-row-t-1')).getByRole('button', { name: 'Suspend' }));
  return screen.getByRole('dialog');
}

test('suspending asks for a reason and sends it', async () => {
  const dialog = await openSuspend();
  const confirm = within(dialog).getByRole('button', { name: 'Suspend' });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: '  Unpaid invoice ' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(api.suspendTenant).toHaveBeenCalledWith('t-1', 'Unpaid invoice'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('a refused change keeps the dialog open', async () => {
  api.suspendTenant.mockRejectedValue({ response: { data: { detail: 'A reason is required' } } });
  const dialog = await openSuspend();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'x y z' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
  await waitFor(() => expect(api.suspendTenant).toHaveBeenCalled());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('offboarding can be cancelled with a reason', async () => {
  api.listAdminTenants.mockResolvedValue({ data: { tenants: [{ ...TENANT, active_assistant_count: 0, call_count: 0,
    offboarding_started_at: '2026-11-02T00:00:00Z', offboarding_reason: 'Contract ended' }], total: 1 } });
  api.cancelTenantOffboarding.mockResolvedValue({ data: { ...TENANT, offboarding_started_at: null } });
  renderWithAuth(<TenantsPage />, { user: USERS.super_admin, path: '/admin/tenants' });
  const row = await screen.findByTestId('tenant-row-t-1');
  expect(within(row).queryByRole('button', { name: 'Offboard' })).not.toBeInTheDocument();
  fireEvent.click(within(row).getByRole('button', { name: 'Cancel offboarding' }));
  const dialog = screen.getByRole('dialog');
  const confirm = within(dialog).getByRole('button', { name: 'Cancel offboarding' });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Customer renewed' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(api.cancelTenantOffboarding).toHaveBeenCalledWith('t-1', 'Customer renewed'));
});
