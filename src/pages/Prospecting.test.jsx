import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApolloStatus, getFilterFields, listSavedFilters } from '@/lib/api';
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
  getApolloStatus.mockResolvedValue({ data: { enabled: false, reason: 'tenant_not_allowed' } });
});

it.each(['tenant_admin', 'manager', 'rep'])('%s gets all three tabs', async (role) => {
  renderWithAuth(<ProspectingPage />, { user: USERS[role], path: '/prospecting' });
  expect(screen.getByRole('tab', { name: 'Search leads' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Saved searches' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Apollo Preview' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Save filter' })).toBeInTheDocument();
});

it('a Super Admin has no saved searches', async () => {
  renderWithAuth(<ProspectingPage />, { user: USERS.super_admin, path: '/prospecting' });
  expect(screen.queryByRole('tab', { name: 'Saved searches' })).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Search prospects' });
  expect(screen.queryByRole('button', { name: 'Save filter' })).not.toBeInTheDocument();
});

it('loads saved searches and Apollo only when their tab is opened', async () => {
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.rep, path: '/prospecting' });
  await screen.findByRole('button', { name: 'Search prospects' });
  expect(listSavedFilters).not.toHaveBeenCalled();
  expect(getApolloStatus).not.toHaveBeenCalled();

  await user.click(screen.getByRole('tab', { name: 'Saved searches' }));
  expect(await screen.findByText('Indian CTOs')).toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Apollo Preview' }));
  expect(await screen.findByText('Apollo Preview is not enabled for your organisation')).toBeInTheDocument();
});

it('editing a saved search moves it into Search leads', async () => {
  const user = userEvent.setup();
  renderWithAuth(<ProspectingPage />, { user: USERS.manager, path: '/prospecting' });
  await user.click(screen.getByRole('tab', { name: 'Saved searches' }));
  await user.click(await screen.findByRole('button', { name: 'Edit the conditions of saved search Indian CTOs in Search leads' }));

  expect(screen.getByRole('tab', { name: 'Search leads' })).toHaveAttribute('data-state', 'active');
  expect(await screen.findByText('Editing saved search “Indian CTOs”')).toBeInTheDocument();
});
