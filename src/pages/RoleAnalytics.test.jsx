import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DashboardPage, ReportsPage } from './RoleAnalytics';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { http } from '@/lib/api';
import { ENDPOINTS } from '@/lib/analytics/endpoints';
import { setMockLatency, toParams } from '@/lib/analytics/service';

jest.mock('@/components/voice/VoiceDashboard', () => () => <div>Voice stats</div>);

const original = JSON.parse(JSON.stringify(ENDPOINTS));
beforeAll(() => setMockLatency(0));
afterEach(() => {
  Object.keys(original).forEach((k) => { ENDPOINTS[k] = { ...original[k] }; });
  jest.restoreAllMocks();
});

const dashboard = (role) => renderWithAuth(<DashboardPage />, { user: USERS[role], path: '/dashboard' });
const reports = (role) => renderWithAuth(<ReportsPage />, { user: USERS[role], path: '/reports' });
const section = (name) => within(screen.getByRole('region', { name }));

it.each([
  ['rep', 'Needs you', 'Priority prospects'],
  ['manager', 'Needs your approval', 'Team leaderboard'],
  ['tenant_admin', 'Integration health', 'Compliance alerts'],
])('shows a %s only their own Dashboard, without Reports content', async (role, first, second) => {
  dashboard(role);
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(await section(first).findAllByRole('listitem')).not.toHaveLength(0);
  expect(screen.getByRole('region', { name: second })).toBeInTheDocument();
  expect(screen.queryByText(/Funnel drop-off/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Export CSV/ })).not.toBeInTheDocument();
});

it('links the funnel card to the full analysis on /reports', async () => {
  dashboard('rep');
  const link = await section('My funnel').findByRole('link', { name: /See full analysis/ });
  expect(link).toHaveAttribute('href', '/reports');
});

it('keeps the voice stats below the dashboard for roles that may view assistants', async () => {
  dashboard('manager');
  expect(screen.getByText('Voice stats')).toBeInTheDocument();
});

it.each([
  ['rep', 'Lead response time and SLA'],
  ['manager', 'Rep performance'],
  ['tenant_admin', 'Compliance and audit'],
])('shows a %s their own Reports page with date, campaign and channel filters', (role, heading) => {
  reports(role);
  expect(screen.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: new RegExp(heading) })).toBeInTheDocument();
  ['Date range', 'Campaign', 'Channel'].forEach((f) => expect(screen.getByLabelText(f)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
});

it('says "Data not available yet" where the data is not recorded', async () => {
  reports('tenant_admin');
  expect(await section('AI cost by feature').findByText('Data not available yet')).toBeInTheDocument();
  expect(await screen.findAllByText('Data not available yet')).not.toHaveLength(0);
});

it('sends the filters as query parameters and reloads the section when one changes', async () => {
  ENDPOINTS.reportFunnel.source = 'live';
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: [{ stage: 'Contacted', count: 10 }, { stage: 'Responded', count: 5 }] });
  reports('rep');
  await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/reports/funnel', expect.anything()));
  expect(get.mock.calls.at(-1)[1].params).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  expect(get.mock.calls.at(-1)[1].params).not.toHaveProperty('channel');

  fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'email' } });
  await waitFor(() => expect(get.mock.calls.at(-1)[1].params).toEqual(expect.objectContaining({ channel: 'email' })));
});

it('shows the loading, empty, error and stale states', async () => {
  ENDPOINTS.reportFunnel.source = 'live';
  ENDPOINTS.lateItems.source = 'live';
  let fail = false;
  jest.spyOn(http, 'get').mockImplementation((path) => {
    if (path === '/api/v1/reports/late-items') return Promise.resolve({ data: [] });
    if (fail) return Promise.reject(new Error('Network Error'));
    return Promise.resolve({ data: [{ stage: 'Contacted', count: 10 }, { stage: 'Responded', count: 5 }] });
  });
  reports('rep');
  expect(screen.getByLabelText('Loading Prospects at each stage')).toBeInTheDocument();
  expect(await section('Late items').findByText('Nothing is late')).toBeInTheDocument();
  await section('Prospects at each stage').findByRole('button', { name: 'Show data' });

  fail = true;
  fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'saas-mid-market' } });
  expect(await section('Prospects at each stage').findByText(/Could not refresh/, {}, { timeout: 3000 })).toBeInTheDocument();
});

it('shows an error with a retry when a section never loaded', async () => {
  ENDPOINTS.scoreBands.source = 'live';
  const get = jest.spyOn(http, 'get').mockRejectedValueOnce(new Error('Server error')).mockResolvedValue({ data: [{ band: '80+', rate: 30 }] });
  reports('rep');
  const card = section('Actual conversion by score band');
  expect(await card.findByText('This could not be loaded.')).toBeInTheDocument();
  fireEvent.click(card.getByRole('button', { name: /Try again/ }));
  expect(await card.findByRole('button', { name: 'Show data' })).toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(2);
});

it('exports the report as a CSV file', async () => {
  const createObjectURL = jest.fn(() => 'blob:report');
  Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
  reports('manager');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Export CSV/ })); });
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
});

it('leaves "all" choices out of the query and turns a period into dates', () => {
  const params = toParams({ period: '7d', campaign: 'all', channel: 'sms', rep: 'all' });
  expect(params).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), channel: 'sms' });
  expect(toParams({ period: 'custom', from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
});
