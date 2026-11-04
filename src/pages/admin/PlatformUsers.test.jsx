import { fireEvent, screen, waitFor } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import PlatformUsersPage from './PlatformUsers';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = require('@/lib/api');

beforeEach(() => {
  jest.resetAllMocks();
  api.listPlatformUsers.mockResolvedValue({ data: { users: [{ id: 1, name: 'A. Admin', email: 'admin@example.test', role: 'super_admin', status: 'active', last_login_at: null, created_at: '2026-01-01T00:00:00Z' }], total: 1, page: 1, page_size: 25 } });
  api.createPlatformUser.mockResolvedValue({ data: { id: 2 } });
});

test('shows Super Admin security state and current accounts', async () => {
  renderWithAuth(<PlatformUsersPage />, { user: USERS.super_admin, path: '/admin/users' });
  expect(await screen.findByText('admin@example.test')).toBeInTheDocument();
  expect(screen.getByText('Not supported')).toBeInTheDocument();
  expect(screen.getByText('Not tracked')).toBeInTheDocument();
  expect(screen.getByText(/no per-session records or MFA support/i)).toBeInTheDocument();
});

test('creates a Super Admin with a required reason and temporary password', async () => {
  renderWithAuth(<PlatformUsersPage />, { user: USERS.super_admin, path: '/admin/users' });
  fireEvent.click(await screen.findByRole('button', { name: /Add Super Admin/i }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Admin' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new-admin@example.test' } });
  fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'StrongPass1!' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Additional platform coverage' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(api.createPlatformUser).toHaveBeenCalledWith(expect.objectContaining({
    name: 'New Admin', email: 'new-admin@example.test', temporary_password: 'StrongPass1!', reason: 'Additional platform coverage',
  })));
  expect(await screen.findByText('StrongPass1!')).toBeInTheDocument();
});
