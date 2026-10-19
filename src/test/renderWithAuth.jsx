import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/lib/AuthContext';
import { creatableRoles, hasPermission } from '@/lib/rbac';

/** Test users, one per role, in tenant t-1 (the manager leads team 3). */
export const USERS = {
  super_admin: { id: 1, name: 'Sam Super', email: 'sam@x.co', role: 'super_admin', tenant_id: null, manager_user_id: null },
  tenant_admin: { id: 2, name: 'Tara Admin', email: 'tara@x.co', role: 'tenant_admin', tenant_id: 't-1', manager_user_id: null },
  manager: { id: 3, name: 'Manu Manager', email: 'manu@x.co', role: 'manager', tenant_id: 't-1', manager_user_id: null },
  rep: { id: 4, name: 'Rita Rep', email: 'rita@x.co', role: 'rep', tenant_id: 't-1', manager_user_id: 3 },
};

export function authValue(user, overrides = {}) {
  return {
    user, token: user ? 'token' : null, loading: false, role: user?.role || null,
    login: jest.fn(), register: jest.fn(), logout: jest.fn(), refreshMe: jest.fn(), changePassword: jest.fn(),
    hasRole: (...roles) => Boolean(user) && roles.includes(user.role),
    can: (perm) => hasPermission(user, perm),
    creatableRoles: creatableRoles(user),
    requiredAction: null, mustChangePassword: false,
    ...overrides,
  };
}

/** Render `ui` at `path` (with optional extra routes) as `user`. */
export function renderWithAuth(ui, { user = null, path = '/', routes = null, auth = {} } = {}) {
  return render(
    <AuthContext.Provider value={authValue(user, auth)}>
      <MemoryRouter initialEntries={[path]}>
        {routes ? <Routes>{routes}<Route path="*" element={ui} /></Routes> : ui}
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
