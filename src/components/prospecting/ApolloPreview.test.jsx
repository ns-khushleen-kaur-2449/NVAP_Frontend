import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApolloStatus, getFilterFields, parseFilterText, searchApolloPreview } from '@/lib/api';
import ApolloPreview from './ApolloPreview';

jest.mock('@/lib/api', () => ({
  getApolloStatus: jest.fn(),
  searchApolloPreview: jest.fn(),
  getFilterFields: jest.fn(),
  parseFilterText: jest.fn(),
}));

const CONDITION = { field: 'job_title', op: 'contains', value: 'CTO' };

beforeEach(() => {
  jest.clearAllMocks();
  getFilterFields.mockResolvedValue({ data: { fields: [
    { key: 'job_title', label: 'Job title', type: 'text', operators: ['contains'], allowed_values: [] },
  ] } });
  parseFilterText.mockResolvedValue({ data: { filter: { version: 1, match: 'all', conditions: [CONDITION] }, dropped: [], not_understood: [] } });
});

const addConditionAndSearch = async (user) => {
  await user.type(await screen.findByLabelText('Describe your ideal prospects'), 'CTOs');
  await user.click(screen.getByRole('button', { name: 'Parse' }));
  await user.click(await screen.findByRole('button', { name: 'Search Apollo' }));
};

it.each([
  ['integration_disabled', 'Apollo Preview is switched off'],
  ['not_configured', 'Apollo Preview is not set up yet'],
  ['role_not_allowed', 'Apollo Preview is not available for your role'],
  ['tenant_not_allowed', 'Apollo Preview is not enabled for your organisation'],
])('explains why it is unavailable (%s)', async (reason, title) => {
  getApolloStatus.mockResolvedValue({ data: { enabled: false, reason } });
  render(<ApolloPreview />);
  expect(await screen.findByText(title)).toBeInTheDocument();
  expect(screen.getByText('Search leads still works as usual.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Search Apollo' })).not.toBeInTheDocument();
});

it('needs at least one condition before searching', async () => {
  getApolloStatus.mockResolvedValue({ data: { enabled: true, reason: null } });
  render(<ApolloPreview />);
  expect(await screen.findByRole('button', { name: 'Search Apollo' })).toBeDisabled();
});

it('shows masked results and the requests left today', async () => {
  const user = userEvent.setup();
  getApolloStatus.mockResolvedValue({ data: { enabled: true, reason: null } });
  searchApolloPreview.mockResolvedValue({ data: {
    items: [{ apollo_person_id: 'x1', first_name: 'Asha', last_name_masked: 'R***', job_title: 'CTO', company_name: 'Arvion',
      has_email: true, has_phone: false, has_location: true }],
    total: 1, page: 1, page_size: 10, total_pages: 1, requests_left_today: 42, not_translated: [], approximate: [],
  } });
  render(<ApolloPreview />);

  await addConditionAndSearch(user);
  expect(await screen.findByText('Asha R***')).toBeInTheDocument();
  expect(screen.getByText(/Apollo requests left today/)).toHaveTextContent('42 Apollo requests left today');
  expect(searchApolloPreview).toHaveBeenCalledWith(expect.objectContaining({ conditions: [CONDITION] }), { page: 1, pageSize: 10 });
});

it('passes on how long Apollo asks us to wait when the limit is reached', async () => {
  const user = userEvent.setup();
  getApolloStatus.mockResolvedValue({ data: { enabled: true, reason: null } });
  searchApolloPreview.mockRejectedValue({ response: { status: 429, data: { detail: { message: 'Too many requests', retry_after: 30 } } } });
  render(<ApolloPreview />);

  await addConditionAndSearch(user);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent("Apollo's request limit has been reached");
  expect(alert).toHaveTextContent('wait about 30 seconds');
  expect(searchApolloPreview).toHaveBeenCalledTimes(1);
});
