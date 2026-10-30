import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createProspect } from '@/lib/api';
import AddLeadDialog from './AddLeadDialog';

jest.mock('@/lib/api', () => ({ createProspect: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^add lead$/i }));

beforeEach(() => {
  jest.clearAllMocks();
  createProspect.mockResolvedValue({ data: {} });
});

it('shows email next to name and phone, without opening the optional details', () => {
  render(<AddLeadDialog open onOpenChange={jest.fn()} />);
  expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
  expect(screen.getByText('(optional)')).toBeInTheDocument();
  expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
});

it('saves a lead without an email', async () => {
  render(<AddLeadDialog open onOpenChange={jest.fn()} />);
  fill(/Lead Name/, 'Asha Rao');
  fill(/Contact Number/, '9876543210');
  submit();
  await waitFor(() => expect(createProspect).toHaveBeenCalledTimes(1));
  expect(createProspect.mock.calls[0][0]).not.toHaveProperty('email');
});

it('sends the email when given, and refuses an invalid one', async () => {
  render(<AddLeadDialog open onOpenChange={jest.fn()} />);
  fill(/Lead Name/, 'Asha Rao');
  fill(/Contact Number/, '9876543210');
  fill(/^Email/, 'not-an-email');
  submit();
  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  expect(createProspect).not.toHaveBeenCalled();
  fill(/^Email/, 'asha@example.com');
  submit();
  await waitFor(() => expect(createProspect).toHaveBeenCalledTimes(1));
  expect(createProspect.mock.calls[0][0].email).toBe('asha@example.com');
});
