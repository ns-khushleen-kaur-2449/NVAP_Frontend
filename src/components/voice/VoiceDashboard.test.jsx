import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getVoiceDashboardSummary, pauseAssistant } from '@/lib/api';
import VoiceDashboard, { REFRESH_MS } from './VoiceDashboard';

jest.mock('@/lib/api', () => ({
  getVoiceDashboardSummary: jest.fn(),
  pauseAssistant: jest.fn(),
  resumeAssistant: jest.fn(),
}));

const SUMMARY = {
  window: { from: '2026-10-19T18:30:00Z', to: '2026-10-20T18:30:00Z', tz: 'Asia/Kolkata' },
  generated_at: '2026-10-20T13:02:00Z',
  kpis: {
    dialed: { value: 17, previous: 12 },
    connected: { value: 6, previous: 4 },
    connect_rate: { value: 0.353, previous: 0.333 },
    conversations_30s: { value: 5, previous: 3 },
    interested: { value: 3, previous: 2 },
    hot_leads: { value: 2, previous: 2 },
    avg_talk_seconds: { value: 115, previous: 127 },
    unclassified: { value: 1, previous: 0 },
    inbound: { value: 2, previous: 0 },
    direction_unknown: { value: 0, previous: 0 },
    retry_queue: { total: 19, from_window: 11, carried_over: 8, next_due_at: '2026-10-20T13:30:00Z' },
  },
  outcomes: { interested: 3, not_interested: 1, unclassified: 1, unclear: 0, callback_requested: 1,
              no_answer: 7, busy: 0, voicemail: 0, not_reachable: 4, error: 0, unknown: 0, in_progress: 0 },
  funnel: [
    { step: 'dialed', n: 17, share_of_dialed: 1 }, { step: 'connected', n: 6, share_of_dialed: 0.353 },
    { step: 'interested', n: 3, share_of_dialed: 0.176 }, { step: 'hot', n: 2, share_of_dialed: 0.118 },
  ],
  by_hour: [{ hour: 15, dialed: 4, connected: 2 }, { hour: 16, dialed: 3, connected: 1 }],
  best_connect_window: { start_hour: 15, end_hour: 17, connected: 3, dialed: 7 },
  agents: [
    { id: 11, name: 'Riya-AISDR-1', initials: 'RA', campaign: 'SaaS leads', status: 'calling', queue_empty: false,
      last_call_at_all_time: '2026-10-20T12:46:00Z', dialed: 12, connected: 4, connect_rate: 0.333, interested: 2,
      hot: 1, avg_talk_seconds: 108, queue: 14 },
    { id: 9, name: 'Neha-nets', initials: 'NN', campaign: null, status: 'idle', queue_empty: true,
      last_call_at_all_time: null, dialed: 0, connected: 0, connect_rate: null, interested: 0, hot: 0,
      avg_talk_seconds: null, queue: 0 },
  ],
  recent_calls: [
    { id: 1, started_at: '2026-10-20T12:46:00Z', lead_label: 'Lead 1042', phone_masked: '+91 98••• ••412',
      agent_id: 11, agent_name: 'Riya-AISDR-1', outcome: 'interested', duration_seconds: 161, direction: 'outbound' },
  ],
  health: [
    { key: 'vapi_webhooks', state: 'healthy', detail: 'Last event received 2 min ago · 0 failed deliveries (24h)', checked_at: '2026-10-20T13:02:00Z' },
    { key: 'crm_sync', state: 'not_configured', detail: 'Not configured · 2 events waiting in the outbox', checked_at: '2026-10-20T13:02:00Z' },
    { key: 'retry_worker', state: 'scheduled', detail: '19 leads queued', checked_at: '2026-10-20T13:02:00Z' },
    { key: 'call_failures', state: 'watch', detail: '4 of 17 calls could not reach the number (24%)', checked_at: '2026-10-20T13:02:00Z' },
  ],
  alerts: [{ level: 'warning', message: '1 agent has not dialed in 4+ days: Neha-nets', agent_ids: [9] }],
};

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  jest.clearAllMocks();
  setHidden(false);
  getVoiceDashboardSummary.mockResolvedValue({ data: SUMMARY });
});

afterEach(() => jest.useRealTimers());

test('every value comes from the summary endpoint', async () => {
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  const dialed = await screen.findByRole('region', { name: 'Calls dialed' });
  expect(within(dialed).getByText('17')).toBeInTheDocument();
  expect(within(dialed).getByText('5 vs yesterday (12)')).toBeInTheDocument();

  const rate = screen.getByRole('region', { name: 'Connect rate' });
  expect(within(rate).getByText('35%')).toBeInTheDocument();
  expect(within(rate).getByText('6 of 17')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Hot leads' })).getByText('same as yesterday')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Avg talk time' })).getByText('1:55')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Retry queue' })).getByText('11 from this period + 8 carried over.')).toBeInTheDocument();

  expect(screen.getByText(/1 of 2 agents calling now/)).toBeInTheDocument();
  expect(screen.getByText(/has not dialed in 4\+ days/)).toBeInTheDocument();
  // A zero-call agent shows dashes, its status in words, and the right action.
  expect(screen.getByText('Idle · queue empty')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Assign leads to Neha-nets' })).toBeInTheDocument();
  expect(screen.getByText('+91 98••• ••412')).toBeInTheDocument();
  expect(screen.getByText(/CRM sync/)).toBeInTheDocument();

  const params = getVoiceDashboardSummary.mock.calls[0][0];
  expect(params).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String), tz: expect.any(String) }));
  expect(params.agent_id).toBeUndefined();
});

test('an API error shows an inline retry', async () => {
  getVoiceDashboardSummary.mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Server error' } } });
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Calls dialed' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a role without access sees why', async () => {
  getVoiceDashboardSummary.mockRejectedValue({ response: { status: 403 } });
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your role cannot view voice agents.');
});

test('the range control asks for that window', async () => {
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  await screen.findByRole('region', { name: 'Calls dialed' });
  fireEvent.click(screen.getByRole('button', { name: '7 days' }));
  await waitFor(() => expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(2));
  const { from, to } = getVoiceDashboardSummary.mock.calls[1][0];
  expect((new Date(to) - new Date(from)) / 86400000).toBeCloseTo(7, 0);
  expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
});

test('pausing an agent calls the API and reloads', async () => {
  pauseAssistant.mockResolvedValue({ data: {} });
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pause Riya-AISDR-1' }));
  await waitFor(() => expect(pauseAssistant).toHaveBeenCalledWith(11));
  await waitFor(() => expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(2));
});

test('polls every 30 s and stops while the tab is hidden', async () => {
  jest.useFakeTimers();
  render(<VoiceDashboard onNavigate={jest.fn()} />);
  await act(async () => {});
  expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(REFRESH_MS); });
  expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(2);

  act(() => setHidden(true));
  await act(async () => { jest.advanceTimersByTime(REFRESH_MS * 3); });
  expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(2);

  // Coming back refreshes at once and resumes polling.
  await act(async () => setHidden(false));
  expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(3);
  await act(async () => { jest.advanceTimersByTime(REFRESH_MS); });
  expect(getVoiceDashboardSummary).toHaveBeenCalledTimes(4);
});
