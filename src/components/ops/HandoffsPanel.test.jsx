import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import CallbacksPage from '@/pages/Callbacks';
import * as api from '@/lib/api';
import { notificationLink } from '@/lib/ops';

jest.mock('@/lib/api');

const handoff = {
  id: 'h-1', status: 'open', reason: 'wants_human', reason_label: 'Asked for a person',
  due_at: '2030-01-07T11:30:00+00:00', overdue: true, preferred_time_window: 'today at 5',
  notes: null, vapi_call_id: 'call-1', scheduled_call_id: null, prospect_id: 'p-1',
  lead_name: 'Aditi Attri', phone_number: '+918091790024', allowed_actions: ['done', 'schedule_call', 'cancel'],
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getAssistants.mockResolvedValue({ data: [] });
  api.getScheduledCalls.mockResolvedValue({ data: { scheduled_calls: [] } });
  api.getCallbackHandoffCount.mockResolvedValue({ data: { open: 1 } });
  api.getCallbackHandoffs.mockResolvedValue({ data: { handoffs: [handoff] } });
  api.callbackHandoffAction.mockResolvedValue({ data: { ...handoff, status: 'done', allowed_actions: [] } });
});

const renderAt = (path, user = USERS.manager) => renderWithAuth(<CallbacksPage />, { user, path });

it('pending tab points to leads waiting for a person', async () => {
  renderAt('/operations/callbacks');
  expect(await screen.findByText('1 lead waiting for a call from a person')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Needs a person/ })).toHaveTextContent('1');
});

it('lists open hand-offs and marks one done with a reason', async () => {
  renderAt('/operations/callbacks?tab=handoffs');
  const row = (await screen.findByText('Aditi Attri')).closest('tr');
  expect(within(row).getByText('Asked for a person')).toBeInTheDocument();
  expect(within(row).getByText('Overdue')).toBeInTheDocument();
  expect(within(row).getByRole('link', { name: 'Open the call' })).toHaveAttribute('href', '/voice_agent?tab=logs&call=call-1');
  expect(api.getCallbackHandoffs).toHaveBeenCalledWith({ status: 'open' });

  fireEvent.keyDown(within(row).getByRole('button', { name: 'Actions for Aditi Attri' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark done' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Called her at 5' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Mark done' }));
  await waitFor(() => expect(api.callbackHandoffAction).toHaveBeenCalledWith('h-1', 'done', { reason: 'Called her at 5' }));
});

it('schedules an AI call instead with a time and a reason', async () => {
  renderAt('/operations/callbacks?tab=handoffs');
  const row = (await screen.findByText('Aditi Attri')).closest('tr');
  fireEvent.keyDown(within(row).getByRole('button', { name: 'Actions for Aditi Attri' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Schedule an AI call instead' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'She prefers the AI' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Schedule an AI call instead' }));
  await waitFor(() => expect(api.callbackHandoffAction).toHaveBeenCalled());
  const [id, path, body] = api.callbackHandoffAction.mock.calls[0];
  expect([id, path, body.reason]).toEqual(['h-1', 'schedule-call', 'She prefers the AI']);
  expect(body.scheduled_time).toMatch(/T10:00|T04:30|Z|\+/);
  expect(body.assistant_id).toBeUndefined(); // the agent that took the call
});

it('a hand-off notification opens its row', () => {
  expect(notificationLink({ entity_type: 'callback_task', entity_id: 'h-1' })).toBe('/operations/callbacks?tab=handoffs&open=h-1');
});
