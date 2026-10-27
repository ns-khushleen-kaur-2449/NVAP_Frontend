import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSavedFilter, getFilterFields, parseFilterText, searchProspectsByFilter } from '@/lib/api';
import AiFilterSearch from './AiFilterSearch';

jest.mock('@/lib/api', () => ({
  getFilterFields: jest.fn(),
  parseFilterText: jest.fn(),
  searchProspectsByFilter: jest.fn(),
  createSavedFilter: jest.fn(),
  updateSavedFilter: jest.fn(),
}));

const CONDITION = { field: 'job_title', op: 'contains', value: 'CTO' };
const prospect = (id, name) => ({ prospect_id: id, full_name: name, job_title: 'CTO', company: { name: 'Arvion' }, score: 80 });
const results = (items, rules = ['tenant_isolation', 'exclude_simulated']) => ({
  data: { items, total: items.length, page: 1, page_size: 25, total_pages: 1, sort: 'score_desc', rules_applied: rules },
});

beforeEach(() => {
  jest.clearAllMocks();
  getFilterFields.mockResolvedValue({ data: { fields: [
    { key: 'job_title', label: 'Job title', type: 'text', operators: ['contains'], allowed_values: [] },
  ] } });
});

const parseSentence = async (user, sentence = 'CTOs') => {
  await user.type(await screen.findByLabelText('Describe your ideal prospects'), sentence);
  await user.click(screen.getByRole('button', { name: 'Parse' }));
};

it('turns a sentence into conditions and searches with them', async () => {
  const user = userEvent.setup();
  parseFilterText.mockResolvedValue({ data: { filter: { version: 1, match: 'all', conditions: [CONDITION] }, dropped: [], not_understood: [] } });
  searchProspectsByFilter.mockResolvedValue(results([prospect('a', 'Asha Rao')]));
  render(<AiFilterSearch />);

  await parseSentence(user, 'CTOs');
  expect(parseFilterText).toHaveBeenCalledWith('CTOs');
  await user.click(await screen.findByRole('button', { name: 'Search prospects' }));

  expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
  expect(searchProspectsByFilter).toHaveBeenCalledWith(
    expect.objectContaining({ match: 'all', conditions: [CONDITION] }),
    expect.objectContaining({ page: 1, sort: 'score_desc' }),
  );
});

it('searches every visible prospect when there are no conditions', async () => {
  const user = userEvent.setup();
  searchProspectsByFilter.mockResolvedValue(results([prospect('a', 'Asha Rao')]));
  render(<AiFilterSearch />);

  expect(await screen.findByText(/the search returns every prospect you have access to/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Search prospects' }));
  await screen.findByText('Asha Rao');
  expect(searchProspectsByFilter).toHaveBeenCalledWith(expect.objectContaining({ conditions: [] }), expect.any(Object));
});

it('keeps working by hand when the AI service is down', async () => {
  const user = userEvent.setup();
  parseFilterText.mockRejectedValue({ response: { status: 503, data: { detail: 'The AI service is not available right now.' } } });
  render(<AiFilterSearch />);

  await parseSentence(user);
  expect(await screen.findByText('The AI service is unavailable right now')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search prospects' })).toBeEnabled();
});

it('reports a failed search and keeps the filter', async () => {
  const user = userEvent.setup();
  searchProspectsByFilter.mockRejectedValue({ response: { status: 500, data: { detail: 'Database unavailable' } } });
  render(<AiFilterSearch />);

  await user.click(await screen.findByRole('button', { name: 'Search prospects' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('The search could not be completed');
  expect(alert).toHaveTextContent('Database unavailable');
  expect(alert).toHaveTextContent('Your filter has been kept');
});

describe('saving a filter', () => {
  const save = async (user, { share }) => {
    parseFilterText.mockResolvedValue({ data: { filter: { version: 1, match: 'all', conditions: [CONDITION] }, dropped: [], not_understood: [] } });
    createSavedFilter.mockResolvedValue({ data: { filter_id: 'f1', name: 'CTOs', can_edit: true } });
    await parseSentence(user);
    await user.click(await screen.findByRole('button', { name: 'Save filter' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'CTOs');
    if (share) await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Save filter' }));
  };

  it('a Manager can share it with the organisation', async () => {
    const user = userEvent.setup();
    const onSaved = jest.fn();
    render(<AiFilterSearch canShare onSaved={onSaved} />);
    await save(user, { share: true });

    expect(createSavedFilter).toHaveBeenCalledWith({
      name: 'CTOs', description: null, is_shared: true,
      filter: expect.objectContaining({ conditions: [CONDITION] }),
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('a Sales Rep is not offered sharing', async () => {
    const user = userEvent.setup();
    render(<AiFilterSearch canShare={false} />);
    await save(user, { share: false });

    expect(screen.queryByText('Share with everyone in my organisation')).not.toBeInTheDocument();
    expect(createSavedFilter).toHaveBeenCalledWith(expect.objectContaining({ is_shared: false }));
  });

  it('is not offered where saved filters are unavailable (Super Admin)', async () => {
    render(<AiFilterSearch savedFiltersAvailable={false} />);
    await screen.findByRole('button', { name: 'Search prospects' });
    expect(screen.queryByRole('button', { name: 'Save filter' })).not.toBeInTheDocument();
  });
});
