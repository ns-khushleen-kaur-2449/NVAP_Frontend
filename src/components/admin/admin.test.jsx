import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import AddUserDialog from '@/components/admin/AddUserDialog';
import UsersTable from '@/components/admin/UsersTable';
import RequirePermission from '@/components/auth/RequirePermission';
import Can from '@/components/auth/Can';
import AuthGate from '@/components/auth/AuthGate';
import { Sidebar } from '@/components/layout/Sidebar';
import { WIDGETS, allowedWidgets } from '@/components/dashboard/widgetRegistry';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import * as api from '@/lib/api';
import { USERS, authValue, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  authRegister: jest.fn(),
  listTenants: jest.fn(),
  listTeams: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.listTenants.mockResolvedValue({ data: { tenants: [
    { tenant_id: 't-1', name: 'Apex Motors', status: 'active' },
    { tenant_id: 't-9', name: 'Old Co', status: 'suspended' },
  ] } });
  api.listTeams.mockResolvedValue({ data: { teams: [
    { manager: { id: 3, name: 'Manu Manager', status: 'active' }, members: [] },
  ], unassigned: [] } });
  api.authRegister.mockResolvedValue({ data: { user: { id: 50, email: 'new@x.co' } } });
});

const roleOptions = async (user) => {
  await user.click(screen.getByTestId('role-select'));
  const options = await screen.findAllByRole('option');
  return options.map((o) => o.textContent);
};

async function fillBasics(user) {
  await user.type(screen.getByLabelText('Name'), 'New Person');
  await user.type(screen.getByLabelText('Email'), 'new@x.co');
}

describe('Add User dialog', () => {
  test('super admin: only Tenant Admin, and a tenant picker is required', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.super_admin });
    expect(await roleOptions(user)).toEqual(['Tenant Admin']);
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('tenant-select')).toBeInTheDocument();
    expect(screen.queryByTestId('team-select')).not.toBeInTheDocument();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: /create user/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a tenant');
    expect(api.authRegister).not.toHaveBeenCalled();
  });

  test('super admin: suspended tenants are not offered', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.super_admin });
    await waitFor(() => expect(api.listTenants).toHaveBeenCalled());
    await user.click(screen.getByTestId('tenant-select'));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Apex Motors']);
  });

  test('tenant admin: Manager and Sales Rep; a Sales Rep needs a team', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.tenant_admin });
    expect(await roleOptions(user)).toEqual(['Manager', 'Sales Rep']);
    await user.click(screen.getByRole('option', { name: 'Sales Rep' }));
    expect(screen.getByTestId('team-select')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-select')).not.toBeInTheDocument();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: /create user/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a team');
    expect(api.authRegister).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('team-select'));
    await user.click(await screen.findByRole('option', { name: "Manu Manager's team" }));
    await user.click(screen.getByRole('button', { name: /create user/i }));
    await waitFor(() => expect(api.authRegister).toHaveBeenCalledTimes(1));
    expect(api.authRegister.mock.calls[0][0]).toMatchObject({ role: 'rep', manager_user_id: 3 });
    expect(api.authRegister.mock.calls[0][0]).not.toHaveProperty('tenant_id');
  });

  test('tenant admin adding a Manager: no team picker', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.tenant_admin });
    await roleOptions(user);
    await user.click(screen.getByRole('option', { name: 'Manager' }));
    expect(screen.queryByTestId('team-select')).not.toBeInTheDocument();
  });

  test('manager: only Sales Rep, no tenant or team picker; tenant and team come from the manager', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.manager });
    expect(await roleOptions(user)).toEqual(['Sales Rep']);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('tenant-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-select')).not.toBeInTheDocument();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: /create user/i }));
    await waitFor(() => expect(api.authRegister).toHaveBeenCalledTimes(1));
    const body = api.authRegister.mock.calls[0][0];
    expect(body.role).toBe('rep');
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('manager_user_id');
  });

  test('sales rep: no roles at all and nothing can be created', async () => {
    renderWithAuth(<AddUserDialog open onOpenChange={() => {}} />, { user: USERS.rep });
    expect(screen.getByRole('button', { name: /create user/i })).toBeDisabled();
  });
});

describe('Users table: Edit / Deactivate only where canManageUser', () => {
  const rows = [
    { id: 2, name: 'Tara Admin', email: 'a@x.co', role: 'tenant_admin', tenant_id: 't-1', manager_user_id: null, status: 'active' },
    { id: 3, name: 'Manu Manager', email: 'b@x.co', role: 'manager', tenant_id: 't-1', manager_user_id: null, status: 'active' },
    { id: 4, name: 'Rita Rep', email: 'c@x.co', role: 'rep', tenant_id: 't-1', manager_user_id: 3, status: 'active', last_login_at: '2030-01-01' },
    { id: 5, name: 'Other Rep', email: 'd@x.co', role: 'rep', tenant_id: 't-1', manager_user_id: 8, status: 'inactive' },
    { id: 6, name: 'Foreign Rep', email: 'e@x.co', role: 'rep', tenant_id: 't-2', manager_user_id: 9, status: 'active' },
    { id: 7, name: 'Foreign Admin', email: 'f@x.co', role: 'tenant_admin', tenant_id: 't-2', manager_user_id: null, status: 'active' },
  ];
  const manageable = (actor) => {
    renderWithAuth(<UsersTable users={rows} actor={actor} />, { user: actor });
    return rows.filter((r) => within(screen.getByTestId(`user-row-${r.id}`)).queryByRole('button', { name: /^Edit/ })).map((r) => r.id);
  };

  test.each([
    ['super_admin', [2, 7]],
    ['tenant_admin', [3, 4, 5]],
    ['manager', [4]],
    ['rep', []],
  ])('%s can manage rows %j', (role, expected) => {
    expect(manageable(USERS[role])).toEqual(expected);
  });

  test('inactive users offer Reactivate; never-logged-in users are marked', () => {
    renderWithAuth(<UsersTable users={rows} actor={USERS.tenant_admin} />, { user: USERS.tenant_admin });
    const other = within(screen.getByTestId('user-row-5'));
    expect(other.getByRole('button', { name: 'Reactivate Other Rep' })).toBeInTheDocument();
    expect(other.getByText('Not logged in')).toBeInTheDocument();
    expect(within(screen.getByTestId('user-row-4')).queryByText('Not logged in')).not.toBeInTheDocument();
  });
});

describe('Route guard and <Can>', () => {
  const guarded = (
    <RequirePermission perm={PERMISSIONS.USERS_VIEW}><p>Users page</p></RequirePermission>
  );
  const routes = [<Route key="403" path="/403" element={<p>Forbidden</p>} />, <Route key="login" path="/login" element={<p>Login</p>} />];

  test.each([
    ['super_admin', 'Users page'], ['tenant_admin', 'Users page'], ['manager', 'Users page'], ['rep', 'Forbidden'],
  ])('%s opening the users page sees "%s"', (role, text) => {
    renderWithAuth(guarded, { user: USERS[role], path: '/settings/users', routes });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test('a logged-out visitor goes to login', () => {
    renderWithAuth(guarded, { user: null, path: '/settings/users', routes });
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  test.each([
    ['super_admin', PERMISSIONS.TENANTS_MANAGE, 'Forbidden', 'tenant_admin'],
    ['tenant_admin', PERMISSIONS.TEAMS_MANAGE, 'Forbidden', 'manager'],
  ])('only %s passes %s', (allowedRole, perm, blocked, otherRole) => {
    const ui = <RequirePermission perm={perm}><p>Allowed</p></RequirePermission>;
    renderWithAuth(ui, { user: USERS[otherRole], path: '/x', routes });
    expect(screen.getByText(blocked)).toBeInTheDocument();
  });

  test('<Can> hides by permission and by role', () => {
    renderWithAuth(<div><Can perm={PERMISSIONS.USERS_CREATE}><span>create</span></Can><Can role="rep"><span>rep only</span></Can></div>,
      { user: USERS.manager });
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.queryByText('rep only')).not.toBeInTheDocument();
  });
});

describe('Sidebar shows only permitted admin items', () => {
  test.each([
    ['super_admin', ['tenants', 'users']],
    ['tenant_admin', ['users', 'teams']],
    ['manager', ['users']],
    ['rep', []],
  ])('%s sees %j', (role, expected) => {
    renderWithAuth(<Sidebar />, { user: USERS[role], path: '/dashboard' });
    const shown = ['tenants', 'users', 'teams'].filter((item) => screen.queryByTestId(`nav-${item}`));
    expect(shown).toEqual(expected);
  });
});

describe('Forced password change', () => {
  test('a user with a temporary password sees only the change-password screen', () => {
    renderWithAuth(<AuthGate><p>App</p></AuthGate>, {
      user: { ...USERS.rep, must_change_password: true }, path: '/dashboard',
      auth: { requiredAction: 'password_change_required', mustChangePassword: true },
    });
    expect(screen.getByTestId('change-password-page')).toBeInTheDocument();
    expect(screen.queryByText('App')).not.toBeInTheDocument();
  });

  test('a suspended organisation sees only the notice; everyone else sees the app', () => {
    const { unmount } = renderWithAuth(<AuthGate><p>App</p></AuthGate>, {
      user: USERS.rep, path: '/dashboard', auth: { requiredAction: 'tenant_suspended' },
    });
    expect(screen.getByTestId('tenant-suspended')).toBeInTheDocument();
    unmount();
    renderWithAuth(<AuthGate><p>App</p></AuthGate>, { user: USERS.rep, path: '/dashboard' });
    expect(screen.getByText('App')).toBeInTheDocument();
  });
});

describe('Dashboard widget registry', () => {
  const data = { platform: {}, tenant: {}, team: {}, own: {} };
  test.each([
    ['super_admin', ['platform-stats']],
    ['tenant_admin', ['tenant-kpis', 'team-leaderboard']],
    ['manager', ['team-call-scores', 'rep-performance']],
    ['rep', ['my-calls', 'my-scores', 'my-callbacks']],
  ])('%s gets %j', (role, expected) => {
    const can = (perm) => hasPermission(USERS[role], perm);
    expect(allowedWidgets(can, WIDGETS, data).map((w) => w.id)).toEqual(expected);
  });

  test('a widget without data from the server is not shown', () => {
    const can = authValue(USERS.tenant_admin).can;
    expect(allowedWidgets(can, WIDGETS, {})).toEqual([]);
  });
});
