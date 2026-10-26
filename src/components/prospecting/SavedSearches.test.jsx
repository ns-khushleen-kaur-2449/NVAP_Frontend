import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteSavedFilter, listSavedFilters, runSavedFilter } from '@/lib/api';
import SavedSearches from './SavedSearches';

jest.mock('@/lib/api', () => ({
  listSavedFilters: jest.fn(),
  runSavedFilter: jest.fn(),
  updateSavedFilter: jest.fn(),
  deleteSavedFilter: jest.fn(),
}));

const SAVED = {
  filter_id: 'f1', name: 'Indian CTOs', description: null, is_shared: true, is_owner: true, can_edit: true,
  filter: { version: 1, match: 'all', conditions: [{ field: 'job_title', op: 'contains', value: 'CTO' }] },
};
const COLLEAGUES = { ...SAVED, filter_id: 'f2', name: 'Team list', is_owner: false, can_edit: false, created_by_name: 'Manu Manager' };

beforeEach(() => {
  jest.clearAllMocks();
  listSavedFilters.mockResolvedValue({ data: { items: [SAVED, COLLEAGUES] } });
});

it('lists own and shared searches', async () => {
  render(<SavedSearches refreshKey={0} canShare onEdit={jest.fn()} />);
  expect(await screen.findByText('Indian CTOs')).toBeInTheDocument();
  expect(screen.getByText('Shared by Manu Manager')).toBeInTheDocument();
  // Someone else's shared search cannot be deleted from here.
  expect(screen.getByRole('button', { name: 'Delete saved search Indian CTOs' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete saved search Team list' })).not.toBeInTheDocument();
});

it('runs a saved search on the server with the caller’s access', async () => {
  const user = userEvent.setup();
  runSavedFilter.mockResolvedValue({ data: {
    items: [{ prospect_id: 'p1', full_name: 'Asha Rao', score: 90 }], total: 1, page: 1, page_size: 25, total_pages: 1,
    sort: 'score_desc', rules_applied: [],
  } });
  render(<SavedSearches refreshKey={0} canShare onEdit={jest.fn()} />);

  await user.click(await screen.findByRole('button', { name: 'Show results for saved search Indian CTOs' }));
  expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
  expect(runSavedFilter).toHaveBeenCalledWith('f1', { page: 1, pageSize: 25, sort: 'score_desc' });
  expect(screen.getByRole('region', { name: 'Saved search results' })).toHaveTextContent('Results for “Indian CTOs”');
});

it('refreshes the list when a run fails, since the search may have been removed', async () => {
  const user = userEvent.setup();
  runSavedFilter.mockRejectedValue({ response: { status: 404, data: { detail: 'Saved filter not found' } } });
  render(<SavedSearches refreshKey={0} canShare onEdit={jest.fn()} />);

  await user.click(await screen.findByRole('button', { name: 'Show results for saved search Indian CTOs' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Saved filter not found');
  await waitFor(() => expect(listSavedFilters).toHaveBeenCalledTimes(2));
});

it('deletes only after confirmation', async () => {
  const user = userEvent.setup();
  deleteSavedFilter.mockResolvedValue({});
  render(<SavedSearches refreshKey={0} canShare onEdit={jest.fn()} />);

  await user.click(await screen.findByRole('button', { name: 'Delete saved search Indian CTOs' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(deleteSavedFilter).not.toHaveBeenCalled();
  expect(dialog).toHaveTextContent('No prospects are deleted.');
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(deleteSavedFilter).toHaveBeenCalledWith('f1'));
});

it('hands a search to Search leads for editing', async () => {
  const user = userEvent.setup();
  const onEdit = jest.fn();
  render(<SavedSearches refreshKey={0} canShare onEdit={onEdit} />);

  await user.click(await screen.findByRole('button', { name: 'Edit the conditions of saved search Indian CTOs in Search leads' }));
  expect(onEdit).toHaveBeenCalledWith(SAVED);
});
