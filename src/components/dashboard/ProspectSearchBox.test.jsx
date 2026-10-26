import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { parseFilterText, searchProspectsByFilter } from '@/lib/api';
import ProspectSearchBox, { PREVIEW_SIZE } from './ProspectSearchBox';

jest.mock('@/lib/api', () => ({
  parseFilterText: jest.fn(),
  searchProspectsByFilter: jest.fn(),
}));

const FILTER = { version: 1, match: 'all', conditions: [{ field: 'job_title', op: 'contains', value: 'CTO' }] };
const prospect = (id, name, score) => ({ prospect_id: id, full_name: name, job_title: 'CTO', company: { name: 'Arvion' }, score });
const page = (items, total, rules = ['tenant_isolation', 'exclude_simulated']) => ({
  data: { items, total, page: 1, page_size: PREVIEW_SIZE, total_pages: 1, sort: 'score_desc', filter: FILTER, rules_applied: rules },
});

const renderBox = () => render(<MemoryRouter><ProspectSearchBox /></MemoryRouter>);
const ask = async (sentence) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Describe the prospects you want'), sentence);
  await user.click(screen.getByRole('button', { name: 'Search' }));
};

beforeEach(() => jest.clearAllMocks());

it('turns the sentence into a filter and shows the top matches', async () => {
  parseFilterText.mockResolvedValue({ data: { filter: FILTER, dropped: [], not_understood: ['next quarter'] } });
  searchProspectsByFilter.mockResolvedValue(page([prospect('a', 'Asha Rao', 82)], 12));
  renderBox();
  await ask('CTOs next quarter');

  expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
  expect(parseFilterText).toHaveBeenCalledWith('CTOs next quarter');
  // The parsed filter is searched unchanged, top scores first, one preview page only.
  expect(searchProspectsByFilter).toHaveBeenCalledWith(FILTER, { page: 1, pageSize: PREVIEW_SIZE, sort: 'score_desc' });
  expect(screen.getByRole('status')).toHaveTextContent('12 matching prospects · top 1 by score');
  expect(screen.getByTestId('prospect-search-box')).toHaveTextContent('Not used: next quarter');
  expect(screen.queryByText('Development data is shown')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open prospecting/i })).toHaveAttribute('href', '/prospecting');
});

it('never searches everyone when the sentence gives no conditions', async () => {
  parseFilterText.mockResolvedValue({ data: { filter: { version: 1, match: 'all', conditions: [] }, dropped: [], not_understood: ['hello'] } });
  renderBox();
  await ask('hello');

  expect(await screen.findByText('No filter could be built from that sentence')).toBeInTheDocument();
  expect(searchProspectsByFilter).not.toHaveBeenCalled();
});

it('says when the AI service is down and does not search', async () => {
  parseFilterText.mockRejectedValue({ response: { status: 503, data: { detail: 'The AI service is not available right now.' } } });
  renderBox();
  await ask('CTOs in India');

  expect(await screen.findByRole('alert')).toHaveTextContent('The AI search is unavailable right now');
  expect(screen.getByText(/build the filter by hand on the Prospecting page/i)).toBeInTheDocument();
  expect(searchProspectsByFilter).not.toHaveBeenCalled();
});

it('shows the server error when the search itself fails', async () => {
  parseFilterText.mockResolvedValue({ data: { filter: FILTER, dropped: [], not_understood: [] } });
  searchProspectsByFilter.mockRejectedValue({ response: { status: 403, data: { detail: 'Your account is not assigned to a tenant' } } });
  renderBox();
  await ask('CTOs');

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('The search could not be completed');
  expect(alert).toHaveTextContent('Your account is not assigned to a tenant');
});

it('marks development synthetic data', async () => {
  parseFilterText.mockResolvedValue({ data: { filter: FILTER, dropped: [], not_understood: [] } });
  searchProspectsByFilter.mockResolvedValue(page([prospect('a', 'Asha Rao', 82)], 1, ['tenant_isolation', 'include_simulated_development']));
  renderBox();
  await ask('CTOs');

  expect(await screen.findByText('Development data is shown')).toBeInTheDocument();
});

it('cannot search with an empty sentence', () => {
  renderBox();
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
});
