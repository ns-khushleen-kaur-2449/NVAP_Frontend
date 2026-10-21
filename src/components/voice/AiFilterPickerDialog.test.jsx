import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getFilterFields, listSavedFilters, searchProspectsByFilter } from '@/lib/api';
import AiFilterPickerDialog from './AiFilterPickerDialog';

jest.mock('@/lib/api', () => ({
  getFilterFields: jest.fn(),
  parseFilterText: jest.fn(),
  listSavedFilters: jest.fn(),
  searchProspectsByFilter: jest.fn(),
}));

const lead = (id, phone = `+91980000000${id.length}`) => ({ prospect_id: id, full_name: `Lead ${id}`, phone, has_phone: Boolean(phone) });

const page = (number, items, rules = ['tenant_isolation', 'exclude_simulated']) => ({
  data: { items, total: 3, page: number, page_size: 2, total_pages: 2, sort: 'score_desc', rules_applied: rules },
});

beforeEach(() => {
  jest.clearAllMocks();
  getFilterFields.mockResolvedValue({ data: { fields: [{ key: 'country', label: 'Country', type: 'country', operators: ['eq'], allowed_values: [] }] } });
  listSavedFilters.mockResolvedValue({ data: { items: [] } });
});

const renderPicker = (onConfirm = jest.fn()) => {
  render(<AiFilterPickerDialog open onOpenChange={jest.fn()} onConfirm={onConfirm} />);
  return onConfirm;
};

const searchFirstPage = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /search prospects/i }));
  await screen.findByText('Lead a');
};

it('keeps selections across result pages and hands the ids to onConfirm', async () => {
  searchProspectsByFilter
    .mockResolvedValueOnce(page(1, [lead('a'), lead('b', null)]))
    .mockResolvedValueOnce(page(2, [lead('c')]))
    .mockResolvedValueOnce(page(1, [lead('a'), lead('b', null)]));
  const onConfirm = renderPicker();
  await searchFirstPage();

  // A prospect without a phone cannot be ticked.
  expect(screen.getByRole('checkbox', { name: 'Select Lead b' })).toBeDisabled();
  expect(screen.getByText('No phone number to call')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Lead a' }));

  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await screen.findByText('Lead c');
  expect(searchProspectsByFilter).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ page: 2 }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Lead c' }));

  fireEvent.click(screen.getByRole('button', { name: /previous/i }));
  await screen.findByText('Lead a');
  expect(screen.getByRole('checkbox', { name: 'Select Lead a' })).toBeChecked();

  fireEvent.click(screen.getByRole('button', { name: 'Use 2 prospects' }));
  expect(onConfirm).toHaveBeenCalledWith(['a', 'c']);
});

it('selects every callable prospect on a page at once', async () => {
  searchProspectsByFilter.mockResolvedValueOnce(page(1, [lead('a'), lead('b', ''), lead('d')]));
  const onConfirm = renderPicker();
  await searchFirstPage();
  fireEvent.click(screen.getByRole('checkbox', { name: /select everyone on this page who can be called \(2\)/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Use 2 prospects' }));
  expect(onConfirm).toHaveBeenCalledWith(['a', 'd']);
});

it('cannot confirm an empty selection', async () => {
  searchProspectsByFilter.mockResolvedValueOnce(page(1, [lead('a')]));
  renderPicker();
  await searchFirstPage();
  expect(screen.getByRole('button', { name: 'Use 0 prospects' })).toBeDisabled();
});

it('says when development synthetic data is shown', async () => {
  searchProspectsByFilter.mockResolvedValueOnce(page(1, [lead('a')], ['tenant_isolation', 'include_simulated_development']));
  renderPicker();
  await searchFirstPage();
  expect(screen.getByText('Development data is shown')).toBeInTheDocument();
});

it('runs a saved search when one is chosen', async () => {
  listSavedFilters.mockResolvedValue({ data: { items: [
    { filter_id: 'f1', name: 'High scorers', filter: { version: 1, match: 'all', conditions: [] } },
  ] } });
  searchProspectsByFilter.mockResolvedValueOnce(page(1, [lead('a')]));
  renderPicker();
  await waitFor(() => expect(listSavedFilters).toHaveBeenCalled());
  const trigger = await screen.findByRole('combobox', { name: /start from a saved search/i });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole('option', { name: 'High scorers' }));
  await screen.findByText('Lead a');
  expect(searchProspectsByFilter).toHaveBeenCalledWith({ version: 1, match: 'all', conditions: [] }, expect.objectContaining({ page: 1 }));
});
