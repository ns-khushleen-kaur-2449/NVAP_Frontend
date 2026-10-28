import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

  describe("the lead's emails", () => {
    const booked = {
      ...appointment, status: 'CONFIRMED', status_label: 'Confirmed', cancel_reason_display: null,
      allowed_actions: ['cancel', 'reschedule'], attendee: { name: 'Aditi Attri', email: 'aditi@lead.example' },
      can_resend_email: true,
      emails: [
        { id: 'e1', kind: 'confirmation', trigger: 'booking', status: 'sent', status_label: 'Sent', attempts: 1,
          sent_at: '2026-10-22T09:30:00Z', send_at: '2026-10-22T09:30:00Z' },
        { id: 'e2', kind: 'overview', trigger: 'booking', status: 'skipped', status_label: 'Not sent', attempts: 1,
          skip_reason: 'no_brochure', skip_reason_label: 'No brochure is uploaded for this meeting type or the company.',
          send_at: '2026-10-22T09:40:00Z' },
      ],
    };

    beforeEach(() => {
      api.getAppointments.mockResolvedValue({ data: { items: [booked], total: 1, page: 1, page_size: 25, counts: {}, calendar: {} } });
    });

    it('lists each email with its status and why one was not sent', async () => {
      api.getAppointment.mockResolvedValue({ data: booked });
      renderWithAuth(<AppointmentsPage />, { user: USERS.manager, path: '/appointments?open=a1' });
      const section = within(await screen.findByRole('region', { name: 'Emails to the lead' }));
      expect(section.getByText('Confirmation')).toBeInTheDocument();
      expect(section.getByText('Sent')).toBeInTheDocument();
      expect(section.getByText('Overview with brochure')).toBeInTheDocument();
      expect(section.getByText('No brochure is uploaded for this meeting type or the company.')).toBeInTheDocument();
    });

    it('resends with a reason', async () => {
      api.getAppointment.mockResolvedValue({ data: booked });
      api.resendAppointmentEmail.mockResolvedValue({ data: booked });
      renderWithAuth(<AppointmentsPage />, { user: USERS.manager, path: '/appointments?open=a1' });
      fireEvent.click(await screen.findByRole('button', { name: 'Resend confirmation' }));
      const dialog = within(await screen.findByRole('dialog', { name: 'Resend confirmation' }));
      fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'Lead lost it' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(api.resendAppointmentEmail).toHaveBeenCalledWith('a1', { kind: 'confirmation', reason: 'Lead lost it' }));
    });

    it('offers no resend when the backend says it is not allowed', async () => {
      api.getAppointment.mockResolvedValue({ data: { ...booked, can_resend_email: false } });
      renderWithAuth(<AppointmentsPage />, { user: USERS.rep, path: '/appointments?open=a1' });
      expect(await screen.findByRole('region', { name: 'Emails to the lead' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Resend/ })).not.toBeInTheDocument();
    });
  });
});
