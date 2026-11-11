import { screen } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import CallLogsList from './CallLogsList';
import { useCallLogs } from '@/hooks/useCallLogs';

jest.mock('@/lib/api');
jest.mock('@/hooks/useCallLogs');

const log = (id, overrides = {}) => ({
  id, vapi_call_id: `call-${id}`, customer_name: `Caller ${id}`, phone_number: '+15550000000', status: 'answered',
  duration_seconds: 40, created_at: '2026-11-02T10:00:00Z', source_type: 'manual', ...overrides,
});

const show = (logs) => {
  useCallLogs.mockReturnValue({ logs, total: logs.length, totalPages: 1, loading: false, error: null, refresh: jest.fn() });
  renderWithAuth(<CallLogsList />, { user: USERS.manager, path: '/voice_agent?tab=logs' });
};

it('shows no lead status, and never "Warm Lead", for calls without one', () => {
  show([log(1), log(2, { lead_status: 'unexpected' })]);
  expect(screen.getByText('Caller 1')).toBeInTheDocument();
  expect(screen.queryByText(/Warm Lead/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Hot Lead|Cold Lead/)).not.toBeInTheDocument();
});

it('shows a lead status a call does carry', () => {
  show([log(1, { lead_status: 'cold' })]);
  expect(screen.getByText('❄️ Cold Lead')).toBeInTheDocument();
});
