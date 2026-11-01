import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantsPage from '@/pages/admin/Tenants';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listTenants: jest.fn(),
  createTenantWithAdmin: jest.fn(),
  suspendTenant: jest.fn(),
  activateTenant: jest.fn(),
  listTenantPhoneNumbers: jest.fn(),
  addTenantPhoneNumber: jest.fn(),
  removeTenantPhoneNumber: jest.fn(),
}));

const TENANT = {
  tenant_id: 't-1', name: 'Apex Motors', status: 'active', default_timezone: 'Asia/Kolkata',
  user_count: 3, active_user_count: 3, admin_count: 1, created_at: '2026-10-01T00:00:00Z',
};
const NUMBER = {
  id: 'n-1', tenant_id: 't-1', vapi_phone_number_id: 'pn-sales-1', label: 'Sales line', assigned_by: 1,
  created_at: '2026-10-30T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  api.listTenants.mockResolvedValue({ data: { tenants: [TENANT] } });
  api.listTenantPhoneNumbers.mockResolvedValue({ data: [NUMBER] });
  api.addTenantPhoneNumber.mockResolvedValue({ data: {} });
  api.removeTenantPhoneNumber.mockResolvedValue({ data: null });
});

async function openNumbers(user) {
  renderWithAuth(<TenantsPage />, { user: USERS.super_admin });
  const row = await screen.findByTestId('tenant-row-t-1');
  await user.click(within(row).getByRole('button', { name: 'Phone numbers' }));
  return screen.findByTestId('tenant-phone-numbers-dialog');
}

describe('Tenant phone numbers (Super Admin)', () => {
  test('lists the numbers given to the tenant', async () => {
    const dialog = await openNumbers(userEvent.setup());
    expect(await within(dialog).findByText('pn-sales-1')).toBeInTheDocument();
    expect(within(dialog).getByText('Sales line')).toBeInTheDocument();
    expect(api.listTenantPhoneNumbers).toHaveBeenCalledWith('t-1');
  });

  test('says what an empty list means', async () => {
    api.listTenantPhoneNumbers.mockResolvedValue({ data: [] });
    const dialog = await openNumbers(userEvent.setup());
    expect(await within(dialog).findByText(/can't attach any number until you add one/i)).toBeInTheDocument();
  });

  test('adding needs an id, then sends it and reloads the list', async () => {
    const user = userEvent.setup();
    const dialog = await openNumbers(user);
    await within(dialog).findByText('pn-sales-1');
    await user.click(within(dialog).getByRole('button', { name: /add number/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A Vapi phone number id is required');
    expect(api.addTenantPhoneNumber).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/vapi phone number id/i), ' pn-new ');
    await user.click(within(dialog).getByRole('button', { name: /add number/i }));
    await waitFor(() => expect(api.addTenantPhoneNumber).toHaveBeenCalledWith('t-1',
      { vapi_phone_number_id: 'pn-new', label: null }));
    await waitFor(() => expect(api.listTenantPhoneNumbers).toHaveBeenCalledTimes(2));
  });

  test("shows the backend's reason when a number belongs to another tenant", async () => {
    api.addTenantPhoneNumber.mockRejectedValue({ response: { status: 409, data: {
      detail: 'This phone number is already assigned to a tenant' } } });
    const user = userEvent.setup();
    const dialog = await openNumbers(user);
    await user.type(within(dialog).getByLabelText(/vapi phone number id/i), 'pn-taken');
    await user.type(within(dialog).getByLabelText(/^label/i), 'Taken');
    await user.click(within(dialog).getByRole('button', { name: /add number/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already assigned to a tenant');
    expect(api.addTenantPhoneNumber).toHaveBeenCalledWith('t-1', { vapi_phone_number_id: 'pn-taken', label: 'Taken' });
  });

  test('removing asks first, then removes and reloads', async () => {
    const user = userEvent.setup();
    const dialog = await openNumbers(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Remove Sales line' }));
    expect(api.removeTenantPhoneNumber).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.removeTenantPhoneNumber).toHaveBeenCalledWith('t-1', 'n-1'));
    await waitFor(() => expect(api.listTenantPhoneNumbers).toHaveBeenCalledTimes(2));
  });
});
