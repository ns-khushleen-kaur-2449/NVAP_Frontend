import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { SuperAdminGoesTo } from '@/components/auth/SuperAdminRoute';
import { adminRoutes } from './adminRoutes';

jest.mock('@/lib/api');
jest.mock('@/components/admin/ToolsManager', () => () => <div>tools-manager</div>);
jest.mock('@/components/shared/ThemeToggle', () => () => null);
jest.mock('@/pages/admin/Tenants', () => () => <div>tenants-page</div>);
jest.mock('@/pages/admin/Users', () => () => <div>users-page</div>);
jest.mock('@/pages/admin/PlatformUsers', () => () => <div>platform-users-page</div>);
jest.mock('@/pages/admin/AgentImport', () => () => <div>agents-page</div>);
jest.mock('@/pages/admin/Agents', () => () => <div>agents-list-page</div>);

const api = require('@/lib/api');

function renderAdmin(path, user, auth = {}) {
  return renderWithAuth(<div>elsewhere</div>, {
    path, user, auth,
    routes: [
      adminRoutes(),
      <Route key="403" path="/403" element={<div>forbidden-page</div>} />,
      <Route key="login" path="/login" element={<div>login-page</div>} />,
    ],
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  api.getAdminOverview.mockResolvedValue({ data: { tenants: { total: 7, active: 5, suspended: 2 } } });
});

describe('SuperAdminRoute', () => {
  test('/admin opens the overview for a Super Admin', async () => {
    renderAdmin('/admin', USERS.super_admin);
    await waitFor(() => expect(screen.getByTestId('overview-total')).toHaveTextContent('7'));
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
  });

  test.each(['tenant_admin', 'manager', 'rep'])('a %s is sent to 403 and never calls the admin API', (role) => {
    renderAdmin('/admin/overview', USERS[role]);
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-layout')).not.toBeInTheDocument();
    expect(api.getAdminOverview).not.toHaveBeenCalled();
  });

  test('a signed-out visitor is sent to the login page', () => {
    renderAdmin('/admin/tools', null);
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  test('waits while the session loads', () => {
    renderAdmin('/admin/overview', null, { loading: true, token: 'token' });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('an unknown admin path goes to the overview', async () => {
    renderAdmin('/admin/nothing-here', USERS.super_admin);
    expect(await screen.findByTestId('overview-total')).toBeInTheDocument();
  });
});

describe('AdminLayout', () => {
  test('the sidebar has Overview, Tenants, Users, Audit Logs, Agents and Tools, and Tools shows the tools manager', () => {
    renderAdmin('/admin/tools', USERS.super_admin);
    const nav = screen.getByRole('navigation', { name: 'Platform admin' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Overview', 'Tenants', 'Platform users', 'Tenant users', 'CRM integrations', 'Audit Logs', 'Agents', 'Tools', 'Security']);
    expect(screen.getByText('tools-manager')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /back to app/i })[0]).toHaveAttribute('href', '/dashboard');
  });
});

describe('Overview page', () => {
  test('shows the active and suspended counts', async () => {
    renderAdmin('/admin/overview', USERS.super_admin);
    await waitFor(() => expect(screen.getByTestId('overview-active')).toHaveTextContent('5'));
    expect(screen.getByTestId('overview-suspended')).toHaveTextContent('2');
  });

  test('shows a loading state until the counts arrive', async () => {
    let resolve;
    api.getAdminOverview.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderAdmin('/admin/overview', USERS.super_admin);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(3);
    resolve({ data: { tenants: { total: 1, active: 1, suspended: 0 } } });
    await waitFor(() => expect(screen.getByTestId('overview-total')).toHaveTextContent('1'));
    expect(screen.queryAllByLabelText('Loading')).toHaveLength(0);
  });

  test('shows the error and loads again on retry', async () => {
    api.getAdminOverview.mockRejectedValueOnce({ response: { data: { detail: 'Service unavailable' } } });
    renderAdmin('/admin/overview', USERS.super_admin);
    const alert = await screen.findByTestId('overview-error');
    expect(alert).toHaveTextContent('Service unavailable');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('overview-total')).toHaveTextContent('7'));
    expect(screen.queryByTestId('overview-error')).not.toBeInTheDocument();
    expect(api.getAdminOverview).toHaveBeenCalledTimes(2);
  });
});

describe('Tenants and Users in the platform area', () => {
  test.each([['/admin/tenants', 'tenants-page'], ['/admin/users', 'platform-users-page'], ['/admin/tenant-users', 'users-page'], ['/admin/agents/import', 'agents-page'],
    ['/admin/agents', 'agents-list-page']])('%s opens for a Super Admin', (path, page) => {
    renderAdmin(path, USERS.super_admin);
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  test.each(['tenant_admin', 'manager', 'rep'])('a %s cannot open any platform admin page', (role) => {
    ['/admin/tenants', '/admin/users', '/admin/tenant-users', '/admin/audit-logs', '/admin/agents/import'].forEach((path) => {
      const { unmount } = renderAdmin(path, USERS[role]);
      expect(screen.getByText('forbidden-page')).toBeInTheDocument();
      expect(screen.queryByText(/tenants-page|users-page|platform-users-page|agents-page/)).not.toBeInTheDocument();
      unmount();
    });
  });

  test('the old Settings → Users link sends a Super Admin to /admin/tenant-users and keeps everyone else in Settings', () => {
    const ui = <SuperAdminGoesTo to="/admin/tenant-users"><div>settings-users</div></SuperAdminGoesTo>;
    const routes = [<Route key="u" path="/admin/tenant-users" element={<div>admin-users</div>} />];
    const { unmount } = renderWithAuth(ui, { user: USERS.super_admin, path: '/settings/users', routes });
    expect(screen.getByText('admin-users')).toBeInTheDocument();
    unmount();
    renderWithAuth(ui, { user: USERS.tenant_admin, path: '/settings/users', routes });
    expect(screen.getByText('settings-users')).toBeInTheDocument();
  });
});
