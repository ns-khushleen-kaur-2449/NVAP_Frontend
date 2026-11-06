import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { Route, useLocation } from 'react-router-dom';
import { getApolloStatus, getFilterFields, listSavedFilters, searchProspectsByFilter } from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import ProspectingPage from './Prospecting';

jest.mock('@/lib/api', () => ({
  getFilterFields: jest.fn(),
  parseFilterText: jest.fn(),
  searchProspectsByFilter: jest.fn(),
  createSavedFilter: jest.fn(),
  updateSavedFilter: jest.fn(),
  deleteSavedFilter: jest.fn(),
  listSavedFilters: jest.fn(),
  runSavedFilter: jest.fn(),
  getApolloStatus: jest.fn(),
  searchApolloPreview: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));

// GET /api/apollo/status answers.
const GRANTED = { enabled: true, access_granted: true, service_ready: true, reason: null };
const GRANTED_NOT_CONFIGURED = { enabled: false, access_granted: true, service_ready: false, reason: 'not_configured' };
const refused = (reason) => ({ enabled: false, access_granted: false, service_ready: null, reason });

const SAVED = {
  filter_id: 'f1', name: 'Indian CTOs', is_shared: false, is_owner: true, can_edit: true,
  filter: { version: 1, match: 'all', conditions: [{ field: 'job_title', op: 'contains', value: 'CTO' }] },
};

beforeEach(() => {
  jest.clearAllMocks();
  getFilterFields.mockResolvedValue({ data: { fields: [
    { key: 'job_title', label: 'Job title', type: 'text', operators: ['contains'], allowed_values: [] },
  ] } });
  listSavedFilters.mockResolvedValue({ data: { items: [SAVED] } });
  getApolloStatus.mockResolvedValue({ data: refused('tenant_not_allowed') });
  searchProspectsByFilter.mockResolvedValue({ data: {
    items: [{ prospect_id: 'p-1', full_name: 'Asha Rao', phone: '+919800000001' }],
    total: 1, page: 1, page_size: 25, total_pages: 1, rules_applied: [],
  } });
});

it('sends the ticked prospects to the Lead-to-Campaign Builder', async () => {
  const user = userEvent.setup();
  let seen = null;
  const Builder = () => { seen = useLocation(); return <p>Builder page</p>; };
  renderWithAuth(<ProspectingPage />, {
    user: USERS.rep, path: '/prospecting', routes: <Route path="/voice_agent" element={<Builder />} />,
  });

  await user.click(await screen.findByRole('checkbox', { name: 'Select Asha Rao' }));
  await user.click(screen.getByRole('button', { name: /add to lead-to-campaign builder/i }));
  expect(await screen.findByText('Builder page')).toBeInTheDocument();
  expect(seen.search).toBe('?tab=builder');
  expect(seen.state).toEqual({ fromProspecting: [expect.objectContaining({ id: 'p-1', name: 'Asha Rao', phone: '+919800000001' })] });
});

it('a Super Admin cannot send prospects to a campaign', async () => {
  renderWithAuth(<ProspectingPage />, { user: USERS.super_admin, path: '/prospecting' });
  await screen.findByText('Asha Rao');
  expect(screen.queryByRole('button', { name: /add to lead-to-campaign builder/i })).not.toBeInTheDocument();
});

it.each(['tenant_admin', 'manager', 'rep'])('%s of a tenant with Apollo access gets all three tabs', async (role) => {
  getApolloStatus.mockResolvedValue({ data: GRANTED });
  renderWithAuth(<ProspectingPage />, { user: USERS[role], path: '/prospecting' });
  expect(screen.getByRole('tab', { name: 'Search leads' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Saved searches' })).toBeInTheDocument();
  expect(await screen.findByRole('tab', { name: 'Apollo Preview' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Save filter' })).toBeInTheDocument();
});

it('a granted tenant keeps the tab when the service is not set up, and sees why inside it', async () => {
  getApolloStatus.mockResolvedValue({ data: GRANTED_NOT_CONFIGURED });
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.tenant_admin, path: '/prospecting' });
  await user.click(await screen.findByRole('tab', { name: 'Apollo Preview' }));
  expect(await screen.findByText('Apollo Preview is not set up yet')).toBeInTheDocument();
  expect(screen.queryByText('Apollo Preview is not enabled for your organisation')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Apollo Preview' })).toHaveAttribute('data-state', 'active');
});

it.each([
  ['the tenant has no access', () => getApolloStatus.mockResolvedValue({ data: refused('tenant_not_allowed') })],
  ['the grant cannot be checked', () => getApolloStatus.mockResolvedValue({ data: refused('access_check_failed') })],
  ['an old-style answer has no access_granted', () => getApolloStatus.mockResolvedValue({ data: { enabled: true, reason: null } })],
  ['the status request fails', () => getApolloStatus.mockRejectedValue({ response: { status: 503 } })],
])('the Apollo Preview tab is not offered when %s', async (_case, arrange) => {
  arrange();
  renderWithAuth(<ProspectingPage />, { user: USERS.rep, path: '/prospecting' });
  await screen.findByRole('button', { name: 'Search prospects' });
  await waitFor(() => expect(getApolloStatus).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('tab', { name: 'Apollo Preview' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Saved searches' })).toBeInTheDocument();
});

it('a Super Admin has no saved searches and no Apollo Preview', async () => {
  getApolloStatus.mockResolvedValue({ data: refused('role_not_allowed') });
  renderWithAuth(<ProspectingPage />, { user: USERS.super_admin, path: '/prospecting' });
  expect(screen.queryByRole('tab', { name: 'Saved searches' })).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Search prospects' });
  expect(screen.queryByRole('button', { name: 'Save filter' })).not.toBeInTheDocument();
  await waitFor(() => expect(getApolloStatus).toHaveBeenCalled());
  expect(screen.queryByRole('tab', { name: 'Apollo Preview' })).not.toBeInTheDocument();
});

it('loads saved searches and Apollo Preview only when their tab is opened', async () => {
  getApolloStatus.mockResolvedValue({ data: GRANTED });
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.rep, path: '/prospecting' });
  await screen.findByRole('button', { name: 'Search prospects' });
  expect(listSavedFilters).not.toHaveBeenCalled();
  // The page asks once whether to offer the tab; Apollo Preview itself is not loaded yet.
  const apolloTab = await screen.findByRole('tab', { name: 'Apollo Preview' });
  expect(getApolloStatus).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('tab', { name: 'Saved searches' }));
  expect(await screen.findByText('Indian CTOs')).toBeInTheDocument();

  await user.click(apolloTab);
  await waitFor(() => expect(getApolloStatus).toHaveBeenCalledTimes(2));
});

it('a grant made while the page is open shows the tab when the window regains focus', async () => {
  renderWithAuth(<ProspectingPage />, { user: USERS.rep, path: '/prospecting' });
  await waitFor(() => expect(getApolloStatus).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('tab', { name: 'Apollo Preview' })).not.toBeInTheDocument();

  getApolloStatus.mockResolvedValue({ data: GRANTED });
  await act(async () => { fireEvent.focus(window); });
  expect(await screen.findByRole('tab', { name: 'Apollo Preview' })).toBeInTheDocument();
});

it('a revoke removes the tab at the next status refresh, even while it is open', async () => {
  getApolloStatus.mockResolvedValue({ data: GRANTED });
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.manager, path: '/prospecting' });
  await user.click(await screen.findByRole('tab', { name: 'Apollo Preview' }));
  await waitFor(() => expect(getApolloStatus).toHaveBeenCalledTimes(2));

  getApolloStatus.mockResolvedValue({ data: refused('tenant_not_allowed') });
  await act(async () => { fireEvent.focus(window); });
  await waitFor(() => expect(screen.queryByRole('tab', { name: 'Apollo Preview' })).not.toBeInTheDocument());
  expect(screen.getByRole('tab', { name: 'Search leads' })).toHaveAttribute('data-state', 'active');
  expect(toast.info).toHaveBeenCalledWith('Apollo Preview is no longer enabled for your organisation.');
});

it('editing a saved search moves it into Search leads', async () => {
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.manager, path: '/prospecting' });
  await user.click(screen.getByRole('tab', { name: 'Saved searches' }));
  await user.click(await screen.findByRole('button', { name: 'Edit the conditions of saved search Indian CTOs in Search leads' }));

  expect(screen.getByRole('tab', { name: 'Search leads' })).toHaveAttribute('data-state', 'active');
  expect(await screen.findByText('Editing saved search “Indian CTOs”')).toBeInTheDocument();
});
