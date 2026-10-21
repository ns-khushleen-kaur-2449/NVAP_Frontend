import { screen, waitFor } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import CallbacksPage from './Callbacks';
import AppointmentsPage from './Appointments';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const callback = {
  id: 7, name: 'Lata', status: 'MISSED', status_label: 'Missed', source_label: 'Asked for on a call',
  scheduled_time: '2026-10-21T05:00:00Z', attempts: 3, max_attempts: null, assistant_id: 'asst-1',
  allowed_actions: ['requeue', 'reschedule', 'cancel', 'handled'], status_reason: 'No answer after 3 tries',
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getAssistants.mockResolvedValue({ data: [{ id: 1, name: 'Riya', vapi_assistant_id: 'asst-1', is_live: true }] });
  api.getScheduledCalls.mockResolvedValue({ data: { scheduled_calls: [callback] } });
  api.getVoiceCampaigns.mockResolvedValue({ data: { campaigns: [] } });
});

describe('Callbacks page', () => {
  it('highlights missed callbacks and gives a manager the row actions', async () => {
    renderWithAuth(<CallbacksPage />, { user: USERS.manager, path: '/callbacks' });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('1 callback missed — follow up'));
    expect(screen.queryByRole('button', { name: 'Actions for Lata' })).not.toBeInTheDocument(); // Pending tab is empty
  });

  it('shows a Super Admin the list without actions', async () => {
    renderWithAuth(<CallbacksPage />, { user: USERS.super_admin, path: '/callbacks?tab=missed' });
    expect(await screen.findByText('Lata')).toBeInTheDocument();
    expect(screen.getByText('No answer after 3 tries')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Lata' })).not.toBeInTheDocument();
  });

  it('shows the manager the actions on the Missed tab', async () => {
    renderWithAuth(<CallbacksPage />, { user: USERS.manager, path: '/callbacks?tab=missed' });
    expect(await screen.findByRole('button', { name: 'Actions for Lata' })).toBeInTheDocument();
  });
});

describe('Appointments page', () => {
  const appointment = {
    id: 'a1', status: 'CANCELLED', status_label: 'Cancelled', start: '2026-10-23T09:30:00Z',
    attendee: { name: 'Aditi Attri' }, executive: { name: 'Exec' }, prospect: null, campaign: null,
    cancel_reason_display: 'No reason given (cancelled from calendar)', allowed_actions: ['restore', 'relink'],
    late_cancel: false, needs_outcome: false, version: 2, events: [],
  };

  it('shows tab counts, the reason on the Cancelled tab and the calendar banner', async () => {
    api.getAppointments.mockResolvedValue({ data: {
      items: [appointment], total: 1, page: 1, page_size: 25, tab: 'cancelled',
      counts: { upcoming: 4, rescheduled: 1, cancelled: 1, past: 0, needs_outcome: 2 },
      calendar: { disconnected: 1, message: 'Calendar disconnected — reconnect in Settings' },
    } });
    renderWithAuth(<AppointmentsPage />, { user: USERS.manager, path: '/appointments?tab=cancelled' });
    expect(await screen.findByText('No reason given (cancelled from calendar)')).toBeInTheDocument();
    expect(screen.getByText('Calendar disconnected — reconnect in Settings')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Needs outcome/ })).toHaveTextContent('2');
  });

  it('opens the drawer with only the actions the backend allows', async () => {
    api.getAppointments.mockResolvedValue({ data: { items: [appointment], total: 1, page: 1, page_size: 25, counts: {}, calendar: {} } });
    api.getAppointment.mockResolvedValue({ data: appointment });
    renderWithAuth(<AppointmentsPage />, { user: USERS.manager, path: '/appointments?tab=cancelled&open=a1' });
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.getAppointment).toHaveBeenCalledWith('a1'));
  });
});
