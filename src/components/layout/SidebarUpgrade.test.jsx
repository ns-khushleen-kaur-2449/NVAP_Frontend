import { screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

it('puts Upgrade Plan immediately above Logout for a Tenant Admin', () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/dashboard' });
  const upgrade = screen.getByRole('link', { name: /Upgrade Plan/ });
  const logout = screen.getByRole('button', { name: /Logout/ });
  expect(upgrade).toHaveAttribute('href', '/billing');
  expect(upgrade.nextElementSibling).toBe(logout);
});

it('marks Upgrade Plan active on the billing page', () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/billing' });
  expect(screen.getByRole('link', { name: /Upgrade Plan/ })).toHaveAttribute('aria-current', 'page');
});

it.each(['super_admin', 'manager', 'rep'])('does not show Upgrade Plan to a %s', (role) => {
  renderWithAuth(<Sidebar />, { user: USERS[role], path: '/dashboard' });
  expect(screen.queryByRole('link', { name: /Upgrade Plan/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Logout/ })).toBeInTheDocument();
});
