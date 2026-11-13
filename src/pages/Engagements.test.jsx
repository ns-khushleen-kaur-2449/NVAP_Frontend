import { screen, within } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import EngagementsPage, { getCallEngagement } from './Engagements';
import { useCallLogs } from '@/hooks/useCallLogs';

jest.mock('@/hooks/useCallLogs');

const call = (id, overrides) => ({
  id, customer_name: `Caller ${id}`, phone_number: `+1555000${id}`, created_at: '2026-11-02T10:00:00Z',
  status: 'answered', duration_seconds: 30, appointment_booked: false, ...overrides,
});

describe('Call engagement', () => {
  it('keeps the same duration rules under call-level names', () => {
    expect(getCallEngagement(call(1, { appointment_booked: true })).label).toBe('Strong engagement');
    expect(getCallEngagement(call(2, { duration_seconds: 300 })).label).toBe('Strong engagement');
    expect(getCallEngagement(call(3, { duration_seconds: 120 })).label).toBe('Moderate engagement');
    expect(getCallEngagement(call(4, { duration_seconds: 30 })).label).toBe('Short call');
    expect(getCallEngagement(call(5, { status: 'no_answer', duration_seconds: 0 })).label).toBe('Not connected');
    expect(getCallEngagement(call(6, { status: 'failed' })).label).toBe('Not connected');
    // A legacy "completed" call is not proven unanswered: a short or incomplete conversation, as before.
    expect(getCallEngagement(call(7, { status: 'completed' })).label).toBe('Short call');
  });

  it('never calls a call Hot, Warm, Cold or a lead temperature', () => {
    useCallLogs.mockReturnValue({
      logs: [call(1, { appointment_booked: true }), call(2, { duration_seconds: 150 }), call(3),
        call(4, { status: 'busy', duration_seconds: 0 })],
      loading: false, error: null, refresh: jest.fn(),
    });
    renderWithAuth(<EngagementsPage />, { user: USERS.manager, path: '/engagements' });
    expect(screen.getByText('Call engagement and outcome summary.')).toBeInTheDocument();
    const labels = screen.getAllByTestId('call-engagement').map((badge) => badge.textContent.trim());
    expect(labels).toEqual(['Strong engagement', 'Moderate engagement', 'Short call', 'Not connected']);
    const page = document.body.textContent;
    expect(page).not.toMatch(/\b(Hot|Warm|Cold)\b/);
    expect(page).not.toMatch(/Lead temperature/i);
    expect(within(document.body).queryByText(/Cold/)).not.toBeInTheDocument();
  });
});
