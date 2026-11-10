import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import CallbackFollowUp from './CallbackFollowUp';
import * as api from '@/lib/api';
import { notificationLink } from '@/lib/ops';

jest.mock('@/lib/api');

const unscheduled = { requested: true, unscheduled: true, callback_task_id: null, scheduled_call_id: null, prospect_id: 'p-1' };
const renderAs = (user, props = {}) =>
  renderWithAuth(<CallbackFollowUp callId={121} assistantId="asst-1" {...props} />, { user, path: '/voice_agent?tab=logs' });

beforeEach(() => jest.resetAllMocks());

it('shows nothing when the callback was scheduled or never asked for', async () => {
  api.getCallCallbackFollowUp.mockResolvedValue({ data: { ...unscheduled, unscheduled: false, scheduled_call_id: 7 } });
  renderAs(USERS.manager);
  await waitFor(() => expect(api.getCallCallbackFollowUp).toHaveBeenCalledWith(121));
  expect(screen.queryByText(/asked for a callback/)).not.toBeInTheDocument();
});

it('warns and schedules the callback through the normal schedule path', async () => {
  api.getCallCallbackFollowUp.mockResolvedValue({ data: unscheduled });
  api.scheduleVoiceCall.mockResolvedValue({ data: { id: 9 } });
  renderAs(USERS.rep);
  expect(await screen.findByText(/asked for a callback on this call, but none was scheduled/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Schedule callback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
  await waitFor(() => expect(api.scheduleVoiceCall).toHaveBeenCalled());
  const body = api.scheduleVoiceCall.mock.calls[0][0];
  expect(body).toMatchObject({ prospect_id: 'p-1', assistant_id: 'asst-1' });
  expect(new Date(body.scheduled_at).getTime()).toBeGreaterThan(Date.now());
});

it('shows the backend refusal instead of closing', async () => {
  api.getCallCallbackFollowUp.mockResolvedValue({ data: unscheduled });
  api.scheduleVoiceCall.mockRejectedValue({ response: { data: { detail: 'Prospect has no phone number to call' } } });
  renderAs(USERS.manager);
  fireEvent.click(await screen.findByRole('button', { name: 'Schedule callback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Prospect has no phone number to call');
});

it('offers no button when the lead is not visible to the viewer', async () => {
  api.getCallCallbackFollowUp.mockResolvedValue({ data: { ...unscheduled, prospect_id: null } });
  renderAs(USERS.manager);
  await screen.findByText(/none was scheduled/);
  expect(screen.queryByRole('button', { name: 'Schedule callback' })).not.toBeInTheDocument();
});

it('a call-log notification opens that call', () => {
  expect(notificationLink({ entity_type: 'call_log', entity_id: '121' })).toBe('/voice_agent?tab=logs&call=121');
});
