import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BrochureRequests from './BrochureRequests';
import * as api from '@/lib/api';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const held = { id: 'r-1', status: 'awaiting_approval', lead_name: 'Aditi', product_name_spoken: 'the nexon',
  match_type: 'exact', matched_product: 'Nexon EV', brochure: 'nexon.pdf', email: 'aditi@gmail.com',
  can_approve: true, can_cancel: false, can_resend: false, created_at: '2030-01-06T06:30:00Z' };
const sent = { ...held, id: 'r-2', status: 'sent', match_type: 'fallback', matched_product: null, brochure: 'company.pdf',
  product_name_spoken: 'the electric one', can_approve: false, can_resend: true };

beforeEach(() => {
  jest.resetAllMocks();
  api.listBrochureRequests.mockResolvedValue({ data: [held, sent] });
});

it('lists what was asked, how it matched and what happened', async () => {
  render(<BrochureRequests canOperate />);
  const row = await screen.findByTestId('brochure-request-r-2');
  expect(within(row).getByText('Sent')).toBeInTheDocument();
  expect(row).toHaveTextContent('Asked for “the electric one” · company brochure · company.pdf');
  expect(within(screen.getByTestId('brochure-request-r-1')).getByText('Waiting for approval')).toBeInTheDocument();
});

it('approves a held request only with a reason', async () => {
  api.decideBrochureRequest.mockResolvedValue({ data: {} });
  render(<BrochureRequests canOperate />);
  const row = await screen.findByTestId('brochure-request-r-1');
  fireEvent.click(within(row).getByRole('button', { name: 'Approve' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Approve and send' })).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Lead is waiting' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve and send' }));
  await waitFor(() => expect(api.decideBrochureRequest).toHaveBeenCalledWith('r-1', 'approve', 'Lead is waiting', {}));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(within(screen.getByTestId('brochure-request-r-2')).getByRole('button', { name: 'Resend' })).toBeInTheDocument();
});

it('offers no actions to someone who cannot operate', async () => {
  render(<BrochureRequests canOperate={false} />);
  await screen.findByTestId('brochure-request-r-1');
  expect(screen.queryByRole('button', { name: /Approve|Reject|Cancel|Resend/ })).not.toBeInTheDocument();
});

it('confirms and sends an unconfirmed request, with a corrected email', async () => {
  const unconfirmed = { ...held, id: 'r-3', status: 'email_not_confirmed', needs_follow_up: true, can_confirm_send: true,
    can_approve: false, brochure: null, product_name_spoken: 'Tata Punch EV' };
  api.listBrochureRequests.mockResolvedValue({ data: [unconfirmed] });
  api.decideBrochureRequest.mockResolvedValue({ data: {} });
  render(<BrochureRequests canOperate />);
  const row = await screen.findByTestId('brochure-request-r-3');
  expect(within(row).getByText('Needs follow-up')).toBeInTheDocument();
  fireEvent.click(within(row).getByRole('button', { name: 'Confirm and send' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Corrected email'), { target: { value: 'aditi.new@gmail.com' } });
  fireEvent.change(within(dialog).getAllByRole('textbox').find((t) => t.tagName === 'TEXTAREA'), { target: { value: 'Called back' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm and send' }));
  await waitFor(() => expect(api.decideBrochureRequest).toHaveBeenCalledWith('r-3', 'confirm-send', 'Called back',
    { email: 'aditi.new@gmail.com' }));
});
