import { act, screen } from '@testing-library/react';
import { BILLING_CHANGED } from '@/components/billing/billingUi';
import { Sidebar } from './Sidebar';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');

const subscription = (plan, plan_name) => ({ data: { plan, plan_name } });

beforeEach(() => {
  jest.resetAllMocks();
  api.getBillingSubscription.mockResolvedValue(subscription('plus', 'Plus'));
});

it('puts Upgrade Plan immediately above Logout for a Tenant Admin', async () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/dashboard' });
  const upgrade = screen.getByRole('link', { name: /Upgrade Plan/ });
  const logout = screen.getByRole('button', { name: /Logout/ });
  expect(upgrade).toHaveAttribute('href', '/billing');
  expect(upgrade.nextElementSibling).toBe(logout);
  await screen.findByTestId('current-plan');
});

it('says which plan the organisation is on, above the upgrade link', async () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/dashboard' });
  const label = await screen.findByTestId('current-plan');
  expect(label).toHaveTextContent('You are on the Plus plan');
  expect(label.nextElementSibling).toBe(screen.getByRole('link', { name: /Upgrade Plan/ }));
});

it('offers Manage Plan instead of Upgrade Plan on the top plan', async () => {
  api.getBillingSubscription.mockResolvedValue(subscription('pro_plus', 'Pro+'));
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/dashboard' });
  expect(await screen.findByTestId('current-plan')).toHaveTextContent('You are on the Pro+ plan');
  expect(screen.getByRole('link', { name: /Manage Plan/ })).toHaveAttribute('href', '/billing');
  expect(screen.queryByRole('link', { name: /Upgrade Plan/ })).not.toBeInTheDocument();
});

it('still shows Upgrade Plan when the plan cannot be loaded', async () => {
  api.getBillingSubscription.mockRejectedValue(new Error('offline'));
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/dashboard' });
  expect(screen.getByRole('link', { name: /Upgrade Plan/ })).toBeInTheDocument();
  expect(screen.queryByTestId('current-plan')).not.toBeInTheDocument();
});

it('updates the plan as soon as the Billing page reports a new one', async () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/billing' });
  expect(await screen.findByTestId('current-plan')).toHaveTextContent('Plus');
  act(() => { window.dispatchEvent(new CustomEvent(BILLING_CHANGED, { detail: { key: 'pro', name: 'Pro' } })); });
  expect(screen.getByTestId('current-plan')).toHaveTextContent('You are on the Pro plan');
});

it('marks Upgrade Plan active on the billing page', async () => {
  renderWithAuth(<Sidebar />, { user: USERS.tenant_admin, path: '/billing' });
  expect(screen.getByRole('link', { name: /Upgrade Plan/ })).toHaveAttribute('aria-current', 'page');
  await screen.findByTestId('current-plan');
});

it.each(['super_admin', 'manager', 'rep'])('does not show Upgrade Plan or the plan to a %s', (role) => {
  renderWithAuth(<Sidebar />, { user: USERS[role], path: '/dashboard' });
  expect(screen.queryByRole('link', { name: /Upgrade Plan/ })).not.toBeInTheDocument();
  expect(screen.queryByTestId('current-plan')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Logout/ })).toBeInTheDocument();
  expect(api.getBillingSubscription).not.toHaveBeenCalled();
});
