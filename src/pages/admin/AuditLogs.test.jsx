import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import AuditLogsPage from './AuditLogs';

jest.mock('@/lib/api');
const api = require('@/lib/api');

const ROW = { id: 'event-1', created_at: '2026-11-03T09:00:00Z', actor_user_id: 9, actor_role: 'super_admin',
  action: 'tenant.suspend', resource_type: 'tenant', resource_id: 'tenant-1', tenant_id: 'tenant-1', tenant_name: 'Acme',
  outcome: 'success', ip_address: '127.0.0.1', reason: 'Requested by billing', before: { status: 'active' }, after: { status: 'suspended' } };

beforeEach(() => {
  jest.resetAllMocks();
  api.getAdminAuditLogs.mockResolvedValue({ data: { items: [ROW], total: 1, page: 1, page_size: 25 } });
});

test('lists paginated audit rows and reveals sanitized event details', async () => {
  renderWithAuth(<AuditLogsPage />, { user: USERS.super_admin, path: '/admin/audit-logs' });
  expect(await screen.findByText('tenant.suspend')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  expect(screen.getByText('Requested by billing')).toBeInTheDocument();
  expect(screen.getByText(/"status": "active"/)).toBeInTheDocument();
});

test('applies filters through the paginated endpoint', async () => {
  renderWithAuth(<AuditLogsPage />, { user: USERS.super_admin, path: '/admin/audit-logs' });
  await screen.findByText('tenant.suspend');
  fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'tenant.suspend' } });
  fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'success' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.getAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'tenant.suspend', outcome: 'success' })));
});

test('shows an error state when the audit query fails', async () => {
  api.getAdminAuditLogs.mockRejectedValueOnce({ response: { data: { detail: 'Audit store unavailable' } } });
  renderWithAuth(<AuditLogsPage />, { user: USERS.super_admin, path: '/admin/audit-logs' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Audit store unavailable');
});
