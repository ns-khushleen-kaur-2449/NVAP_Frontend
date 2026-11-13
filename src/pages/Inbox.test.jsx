import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import InboxPage from './Inbox';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');

const brochure = {
  id: 'e-1', kind: 'brochure', kind_label: 'Brochure', status: 'sent', status_label: 'Sent',
  subject: 'Your Nexon EV brochure from XYZ Automobile', to_name: 'Aditi', to_email: 'aditi@gmail.com', from_name: 'Riya',
  attachment: 'nexon-ev.pdf', reason: 'Asked for "the nexon" on a call: Nexon EV (matched by name).', problem: null,
  sent_at: '2030-01-06T06:30:00Z', prospect_id: 'p-1', prospect_name: 'Aditi Attri', vapi_call_id: '01a181dc', call_log_id: 81,
};
const failed = { ...brochure, id: 'e-2', status: 'failed', status_label: 'Failed', problem: 'no_sender_mailbox',
  vapi_call_id: null, call_log_id: null, prospect_id: null };

beforeEach(() => {
  jest.resetAllMocks();
  api.listLeadEmails.mockResolvedValue({ data: [brochure, failed] });
});

const renderInbox = (user = USERS.rep, path = '/inbox') => renderWithAuth(<InboxPage />, { user, path });

it('shows each email with why it went, what was attached and links to its call and lead', async () => {
  renderInbox();
  const row = await screen.findByTestId('lead-email-e-1');
  expect(within(row).getByText('Your Nexon EV brochure from XYZ Automobile')).toBeInTheDocument();
  expect(row).toHaveTextContent('Why: Asked for "the nexon" on a call: Nexon EV (matched by name).');
  expect(row).toHaveTextContent('Attached: nexon-ev.pdf');
  expect(row).toHaveTextContent("To Aditi <aditi@gmail.com> · from Riya's mailbox");
  expect(within(row).getByRole('link', { name: /Open call log/ })).toHaveAttribute('href', '/voice_agent?tab=logs&call=01a181dc');
  expect(within(row).getByRole('link', { name: /Open Aditi Attri/ })).toHaveAttribute('href', '/leads?prospect=p-1');
});

it('shows why an email did not go, and no links when there is no call or lead', async () => {
  renderInbox();
  const row = await screen.findByTestId('lead-email-e-2');
  expect(within(row).getByText('no_sender_mailbox')).toBeInTheDocument();
  expect(within(row).queryByRole('link')).not.toBeInTheDocument();
});

it('filters by kind', async () => {
  renderInbox();
  await screen.findByTestId('lead-email-e-1');
  fireEvent.click(screen.getByRole('tab', { name: 'Brochures' }));
  await waitFor(() => expect(api.listLeadEmails).toHaveBeenLastCalledWith({ kind: 'brochure' }));
});

it('has the brochure requests for Tenant Admins and Managers, opened from a follow-up email', async () => {
  const waiting = { ...brochure, id: 'e-3', status: 'needs_follow_up', status_label: 'Needs follow-up' };
  api.listLeadEmails.mockResolvedValue({ data: [waiting] });
  api.listBrochureRequests.mockResolvedValue({ data: [{ id: 'r-1', lead_name: 'Aditi Attri', status: 'email_not_confirmed',
    product_name_spoken: 'the nexon', match_type: 'exact', created_at: '2030-01-06T06:30:00Z' }] });
  renderInbox(USERS.manager);
  const row = await screen.findByTestId('lead-email-e-3');
  fireEvent.click(within(row).getByRole('button', { name: /Confirm and send in Brochure requests/ }));
  expect(await screen.findByTestId('brochure-request-r-1')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Brochure requests' })).toHaveAttribute('aria-selected', 'true');
});

it('opens the requests from the link, and gives a Sales Rep no requests tab', async () => {
  api.listBrochureRequests.mockResolvedValue({ data: [] });
  const { unmount } = renderInbox(USERS.tenant_admin, '/inbox?view=requests');
  expect(await screen.findByText('No brochure requests yet.')).toBeInTheDocument();
  unmount();
  renderInbox(USERS.rep, '/inbox?view=requests');
  await screen.findByTestId('lead-email-e-1');
  expect(screen.queryByRole('tab', { name: 'Brochure requests' })).not.toBeInTheDocument();
  expect(api.listBrochureRequests).toHaveBeenCalledTimes(1);
});
