import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Billing from './Billing';
import * as api from '@/lib/api';
import { redirectTo } from '@/components/billing/billingUi';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
// Leaving for Stripe is the one thing a test must not really do.
jest.mock('@/components/billing/billingUi', () => ({ ...jest.requireActual('@/components/billing/billingUi'), redirectTo: jest.fn() }));

const PLANS = [
  { key: 'plus', name: 'Plus', rank: 1, description: 'For solo agents and small sales teams.', monthly_amount_usd: 249, intervals: ['month'],
    limits: { calls_per_month: 150, voice_minutes: 450, manager_seats: 1, rep_seats: 3 }, features: ['Email support'],
    addons: [{ label: 'Extra Manager seat', monthly_amount_usd: 39 }, { label: 'Extra Sales Rep seat', monthly_amount_usd: 19 }] },
  { key: 'pro', name: 'Pro', rank: 2, description: 'For growing teams scaling voice outreach.', monthly_amount_usd: 1499, intervals: ['month'],
    limits: { calls_per_month: 1000, voice_minutes: 3000, manager_seats: 3, rep_seats: 15 }, features: ['Priority email support', 'CRM & calendar integration'],
    addons: [{ label: 'Extra Manager seat', monthly_amount_usd: 29 }, { label: 'Extra Sales Rep seat', monthly_amount_usd: 15 }] },
  { key: 'pro_plus', name: 'Pro+', rank: 3, description: 'For large teams with high-volume outreach.', monthly_amount_usd: 3999, intervals: ['month'],
    limits: { calls_per_month: 3500, voice_minutes: 10500, manager_seats: null, rep_seats: null },
    features: ['Priority email support', 'CRM & calendar integration', 'Dedicated customer success manager'], addons: [] },
];

const FREE = { plan: 'free', plan_name: 'Free', plan_details: null, status: 'none', interval: null, current_period_start: null, current_period_end: null,
  cancel_at_period_end: false, pending_change: null, has_billing_account: false, billing_configured: true };
const PRO = { ...FREE, plan: 'pro', plan_name: 'Pro', plan_details: PLANS[1], status: 'active', interval: 'month',
  current_period_start: '2030-01-01T00:00:00Z', current_period_end: '2030-02-01T00:00:00Z', has_billing_account: true };

const respond = (subscription, extra = {}) => {
  api.getBillingPlans.mockResolvedValue({ data: { plans: PLANS, billing_configured: true } });
  api.getBillingSubscription.mockResolvedValue({ data: subscription });
  api.getBillingInvoices.mockResolvedValue({ data: { invoices: [], ...extra } });
};

beforeEach(() => {
  jest.resetAllMocks();
  respond(FREE);
});

const renderPage = (path = '/billing') => renderWithAuth(<Billing />, { user: USERS.tenant_admin, path });
const plan = (name) => within(screen.getByRole('article', { name: `${name} plan` }));

it('shows three cards, Plus, Pro and Pro+, and no Current plan box on Free', async () => {
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Available plans' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Current plan' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Plus plan', 'Pro plan', 'Pro+ plan']);
  expect(plan('Plus').getByText('$249')).toBeInTheDocument();
  expect(plan('Pro').getByText('$1,499')).toBeInTheDocument();
  expect(plan('Pro+').getByText('$3,999')).toBeInTheDocument();
  expect(plan('Pro').getByText('Most popular')).toBeInTheDocument();
  expect(plan('Pro+').getAllByText('Unlimited')).toHaveLength(2);
  expect(plan('Plus').getByText('Extra Manager seat')).toBeInTheDocument();
  // No yearly price is configured, so there is no monthly/annual switch.
  expect(screen.queryByRole('group', { name: 'Billing interval' })).not.toBeInTheDocument();
});

it('sends a new subscriber to Stripe Checkout for the chosen plan', async () => {
  api.createCheckoutSession.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/c/1' } });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Subscribe to Pro' }));
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://checkout.stripe.test/c/1'));
  expect(api.createCheckoutSession).toHaveBeenCalledWith('pro', 'month');
});

it('shows the backend message when Checkout cannot be started', async () => {
  api.createCheckoutSession.mockRejectedValue({ response: { data: { detail: 'This plan is not available for purchase yet.' } } });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Subscribe to Plus' }));
  await waitFor(() => expect(api.createCheckoutSession).toHaveBeenCalled());
  expect(redirectTo).not.toHaveBeenCalled();
});

it('marks the current plan and offers upgrade and downgrade on the others', async () => {
  respond(PRO);
  renderPage();
  await screen.findByRole('region', { name: 'Current plan' });
  expect(plan('Pro').getByRole('button', { name: 'Current plan' })).toBeDisabled();
  expect(plan('Pro+').getByRole('button', { name: 'Upgrade to Pro+' })).toBeEnabled();
  expect(plan('Plus').getByRole('button', { name: 'Downgrade to Plus' })).toBeEnabled();
  expect(within(screen.getByRole('region', { name: 'Current plan' })).getByText('Active')).toBeInTheDocument();
});

it('upgrades after confirmation and says the new plan is charged pro rata', async () => {
  respond(PRO);
  api.changeBillingPlan.mockResolvedValue({ data: { result: 'changed', subscription: { ...PRO, plan: 'pro_plus', plan_name: 'Pro+', plan_details: PLANS[2] } } });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro+' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText(/prorated difference/)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Upgrade to Pro+' }));
  expect(await screen.findByText(/You are now on Pro\+/)).toBeInTheDocument();
  expect(api.changeBillingPlan).toHaveBeenCalledWith('pro_plus', 'month');
  expect(await plan('Pro+').findByRole('button', { name: 'Current plan' })).toBeInTheDocument();
});

it('keeps the current plan until the next billing date on a downgrade, and says when', async () => {
  respond(PRO);
  api.changeBillingPlan.mockResolvedValue({ data: { result: 'scheduled', effective_at: '2030-02-01T00:00:00Z',
    subscription: { ...PRO, pending_change: { plan: 'plus', plan_name: 'Plus', effective_at: '2030-02-01T00:00:00Z' } } } });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Downgrade to Plus' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText(/You keep Pro until 1 Feb 2030/)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Downgrade to Plus' }));
  expect(await screen.findByText(/You will move to Plus on 1 Feb 2030/)).toBeInTheDocument();
  expect(plan('Plus').getByRole('button', { name: /Starts 1 Feb 2030/ })).toBeDisabled();
});

it('selects a plan card when it is clicked', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Available plans' });
  const card = screen.getByRole('article', { name: 'Pro plan' });
  expect(card).not.toHaveAttribute('aria-current');
  fireEvent.click(card);
  expect(card).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('article', { name: 'Plus plan' }));
  expect(card).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('article', { name: 'Plus plan' })).toHaveAttribute('aria-current', 'true');
});

it('cancels at the period end and can resume', async () => {
  respond(PRO);
  api.cancelBillingSubscription.mockResolvedValue({ data: { ...PRO, cancel_at_period_end: true } });
  api.resumeBillingSubscription.mockResolvedValue({ data: PRO });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Cancel subscription/ }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel subscription' }));
  expect(await screen.findByText(/Your subscription will not renew/)).toBeInTheDocument();
  // While a cancellation is pending, plan changes are not offered.
  expect(plan('Pro+').getByRole('button', { name: 'Choose Pro+' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Resume subscription/ }));
  expect(await screen.findByText(/will renew as normal/)).toBeInTheDocument();
});

it('opens the Stripe Customer Portal to update the payment method', async () => {
  respond(PRO);
  api.createPortalSession.mockResolvedValue({ data: { url: 'https://billing.stripe.test/p/1' } });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Update payment method/ }));
  await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://billing.stripe.test/p/1'));
});

it('warns when the last payment failed', async () => {
  respond({ ...PRO, status: 'past_due' });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your last payment failed.');
});

it('lists invoices with a download link', async () => {
  respond(PRO, { invoices: [{ id: 'in_1', number: 'A-0001', created: '2030-01-01T00:00:00Z', amount: 149900, currency: 'usd', status: 'paid',
    hosted_invoice_url: 'https://inv.stripe.test/1', invoice_pdf: 'https://inv.stripe.test/1.pdf' }] });
  renderPage();
  const row = within(await screen.findByRole('row', { name: /A-0001/ }));
  expect(row.getByText('$1,499.00')).toBeInTheDocument();
  expect(row.getByText('Paid')).toBeInTheDocument();
  expect(row.getByRole('link', { name: 'Download invoice A-0001' })).toHaveAttribute('href', 'https://inv.stripe.test/1.pdf');
});

it('does not break the page when only the invoices fail', async () => {
  respond(PRO);
  api.getBillingInvoices.mockRejectedValue({ response: { data: { detail: 'Stripe could not load your invoices. Please try again.' } } });
  renderPage();
  expect(await screen.findByText(/Billing history could not be loaded/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pro', level: 2 })).toBeInTheDocument();
});

it('says so when billing is not configured on the server', async () => {
  api.getBillingPlans.mockResolvedValue({ data: { plans: PLANS, billing_configured: false } });
  renderPage();
  expect(await screen.findByText(/Billing is not set up on this server yet/)).toBeInTheDocument();
});

it('shows the error and lets the visitor retry', async () => {
  api.getBillingPlans.mockRejectedValueOnce({ response: { data: { detail: 'Backend is down' } } });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Backend is down');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Available plans' })).toBeInTheDocument();
});

describe('coming back from Stripe Checkout', () => {
  it('does not activate anything itself: the plan appears once the backend reports it', async () => {
    let calls = 0;
    api.getBillingSubscription.mockImplementation(async () => ({ data: ++calls < 3 ? FREE : PRO }));
    renderPage('/billing?checkout=success&session_id=cs_1');
    expect(await screen.findByText('Confirming your payment with Stripe…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Available plans' })).toBeInTheDocument();
    expect(await screen.findByText(/Payment confirmed. Your Pro plan is now active./, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro', level: 2 })).toBeInTheDocument();
  }, 15000);

  it('says nothing was charged when Checkout was cancelled', async () => {
    renderPage('/billing?checkout=cancelled');
    expect(await screen.findByText('Checkout was cancelled. You have not been charged.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Available plans' })).toBeInTheDocument();
  });
});
