import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getAgentMetrics, listTenants } from '@/lib/api';
import AgentCalls, { ownNumbers } from './AgentCalls';

jest.mock('@/lib/api', () => ({
  getAgentMetrics: jest.fn(),
  listTenants: jest.fn(),
}));

const metricsFor = (dialed) => ({
  data: {
    agents: [{
      id: 'a-hiring', key: 'hiring', name: 'Hiring', has_code: true,
      calls: { dialed, connected: 0, connect_rate: dialed ? 0 : null, avg_talk_seconds: null, inbound: 0 },
      metrics: {},
    }],
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  getAgentMetrics.mockResolvedValue(metricsFor(1));
  listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-1', name: 'Acme' }, { tenant_id: 't-2', name: 'Globex' }] } });
});

test('a Super Admin picks the tenant: nothing is asked before one is chosen', async () => {
  getAgentMetrics.mockImplementation(({ tenant_id: tenant }) => Promise.resolve(metricsFor(tenant === 't-2' ? 7 : 3)));
  render(<AgentCalls range="today" superAdmin />);
  // The picker chooses the first tenant, then the numbers are asked for it.
  expect(await screen.findByText('3')).toBeInTheDocument();
  expect(getAgentMetrics).toHaveBeenCalledTimes(1);
  expect(getAgentMetrics.mock.calls[0][0]).toEqual(expect.objectContaining({ tenant_id: 't-1' }));

  fireEvent.change(screen.getByRole('combobox', { name: /Tenant/ }), { target: { value: 't-2' } });
  expect(await screen.findByText('7')).toBeInTheDocument();
  expect(getAgentMetrics.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ tenant_id: 't-2' }));
});

test('a tenant user names no tenant and gets no picker', async () => {
  render(<AgentCalls range="today" />);
  expect(await screen.findByRole('table', { name: 'Calls by agent' })).toBeInTheDocument();
  expect(getAgentMetrics.mock.calls[0][0].tenant_id).toBeUndefined();
  expect(listTenants).not.toHaveBeenCalled();
});

test('another range asks for that period', async () => {
  const { rerender } = render(<AgentCalls range="today" />);
  await screen.findByRole('table', { name: 'Calls by agent' });
  rerender(<AgentCalls range="30d" />);
  await waitFor(() => expect(getAgentMetrics).toHaveBeenCalledTimes(2));
  const { from, to } = getAgentMetrics.mock.calls[1][0];
  expect((new Date(to) - new Date(from)) / 86400000).toBeCloseTo(30, 0);
});

test('a role without access is told so', async () => {
  getAgentMetrics.mockRejectedValue({ response: { status: 403 } });
  render(<AgentCalls range="today" />);
  expect(await screen.findByText('Your role cannot view these numbers.')).toBeInTheDocument();
});

test('an agent\'s own numbers: non-zero ones, in words; an unknown one is still readable', () => {
  expect(ownNumbers({ interviews_completed: 2, needs_review: 1, not_interviewed: 0 }))
    .toBe('2 interviews completed · 1 needing review');
  expect(ownNumbers({ awaiting_result: 1, new_thing_counted: 4 })).toBe('1 awaiting the summary · 4 new thing counted');
  expect(ownNumbers({})).toBe('');
  expect(ownNumbers(undefined)).toBe('');
});
