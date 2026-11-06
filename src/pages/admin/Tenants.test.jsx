import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import TenantsPage from './Tenants';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const api = require('@/lib/api');
const { toast } = require('sonner');
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

describe('Apollo access', () => {
  const withAccess = (enabled) => api.listAdminTenants.mockResolvedValue({ data: { tenants: [
    { ...TENANT, active_assistant_count: 0, call_count: 0, apollo_access_enabled: enabled }], total: 1 } });

  async function apolloSwitch() {
    renderWithAuth(<TenantsPage />, { user: USERS.super_admin, path: '/admin/tenants' });
    const row = await screen.findByTestId('tenant-row-t-1');
    return { row, control: within(row).getByRole('switch', { name: 'Apollo access for Acme' }) };
  }

  test('each tenant shows its saved Apollo access', async () => {
    withAccess(false);
    const { row, control } = await apolloSwitch();
    expect(screen.getByRole('columnheader', { name: 'Apollo' })).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(within(row).getByText('Disabled')).toBeInTheDocument();
  });

  test('granting asks for a reason, sends it and reloads the saved value', async () => {
    withAccess(false);
    api.setTenantApolloAccess.mockResolvedValue({ data: { ...TENANT, apollo_access_enabled: true } });
    const { control } = await apolloSwitch();
    fireEvent.click(control);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Grant Apollo access to Acme?')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Grant access' });
    expect(confirm).toBeDisabled();
    expect(api.setTenantApolloAccess).not.toHaveBeenCalled();

    withAccess(true);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: ' Pilot customer ' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.setTenantApolloAccess).toHaveBeenCalledWith('t-1', true, 'Pilot customer'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Apollo access granted to Acme'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = await screen.findByTestId('tenant-row-t-1');
    await waitFor(() => expect(within(row).getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    expect(within(row).getByText('Enabled')).toBeInTheDocument();
  });

  test('revoking needs a confirmation with a reason', async () => {
    withAccess(true);
    api.setTenantApolloAccess.mockResolvedValue({ data: { ...TENANT, apollo_access_enabled: false } });
    const { control } = await apolloSwitch();
    expect(control).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(control);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Revoke Apollo access for Acme?')).toBeInTheDocument();
    expect(within(dialog).getByText(/stops working for its users from their next request/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Revoke access' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Pilot ended' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.setTenantApolloAccess).toHaveBeenCalledWith('t-1', false, 'Pilot ended'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Apollo access revoked for Acme'));
  });

  test('closing the confirmation changes nothing', async () => {
    withAccess(true);
    const { control } = await apolloSwitch();
    fireEvent.click(control);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.setTenantApolloAccess).not.toHaveBeenCalled();
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  test('a refused change reports the failure and keeps the saved value', async () => {
    withAccess(false);
    api.setTenantApolloAccess.mockRejectedValue({ response: { status: 403, data: { detail: 'You do not have permission to perform this action' } } });
    const { control } = await apolloSwitch();
    fireEvent.click(control);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Pilot customer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Grant access' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You do not have permission to perform this action'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-checked', 'false');
  });
});

test('shows each tenant admin name and email', async () => {
  api.listAdminTenants.mockResolvedValue({ data: { tenants: [{ ...TENANT, tenant_admins: [{ name: 'Owner', email: 'owner@apex.example', status: 'active' }] }], total: 1 } });
  renderWithAuth(<TenantsPage />, { user: USERS.super_admin });
  expect(await screen.findByTestId(`tenant-admins-${TENANT.tenant_id}`)).toHaveTextContent('owner@apex.example');
});

