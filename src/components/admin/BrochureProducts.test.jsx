import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BrochureProducts from './BrochureProducts';
import * as api from '@/lib/api';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
// Radix Select does not open in jsdom; a native select stands in.
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, disabled }) => (
    <div data-disabled={disabled ? 'y' : 'n'} onChange={(e) => onValueChange?.(e.target.value)}>{children}</div>),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ children }) => <span>{children}</span>,
  SelectContent: ({ children }) => <select aria-label="sender options">{children}</select>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));

const nexon = { id: 'p-1', name: 'Nexon EV', aliases: ['Nexon electric'], is_active: true,
  brochure: { id: 'b-9', filename: 'nexon.pdf', size_bytes: 400 * 1024, description: 'Range and charging.' } };
const punch = { id: 'p-2', name: 'Punch EV', aliases: [], is_active: false, brochure: null };
const candidates = [{ user_id: 7, name: 'Riya', email: 'riya@apex.example', calendar_connected: true },
  { user_id: 8, name: 'No Cal', email: 'n@apex.example', calendar_connected: false }];

beforeEach(() => {
  jest.resetAllMocks();
  api.listProducts.mockResolvedValue({ data: [nexon, punch] });
  api.getAppointmentRules.mockResolvedValue({ data: { rules: { brochure_sender_user_id: null, send_booking_emails: true } } });
});

it('lists products with aliases, their brochure and description, and the fallback for one without', async () => {
  render(<BrochureProducts canEdit candidates={candidates} />);
  expect(await screen.findByText('Nexon EV')).toBeInTheDocument();
  expect(screen.getByText('Nexon electric')).toBeInTheDocument();
  expect(screen.getByText('nexon.pdf')).toBeInTheDocument();
  expect(screen.getByText('About it: Range and charging.')).toBeInTheDocument();
  expect(screen.getByText('No brochure: leads asking for it get the company brochure')).toBeInTheDocument();
  expect(screen.getByText('Inactive')).toBeInTheDocument();
});

it('adds a product with its aliases', async () => {
  api.createProduct.mockResolvedValue({ data: {} });
  render(<BrochureProducts canEdit candidates={candidates} />);
  fireEvent.click(await screen.findByRole('button', { name: /Add product/ }));
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Harrier EV' } });
  fireEvent.change(screen.getByLabelText('New alias'), { target: { value: 'Harrier electric' } });
  fireEvent.keyDown(screen.getByLabelText('New alias'), { key: 'Enter' });
  fireEvent.change(screen.getByLabelText('New alias'), { target: { value: 'harrier ELECTRIC' } });  // a repeat
  fireEvent.keyDown(screen.getByLabelText('New alias'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith({ name: 'Harrier EV', aliases: ['Harrier electric'] }));
});

it("uploads a product's brochure", async () => {
  api.uploadProductBrochure.mockResolvedValue({ data: {} });
  render(<BrochureProducts canEdit candidates={candidates} />);
  const row = (await screen.findByText('Punch EV')).closest('[role="listitem"]');
  const file = new File(['%PDF-1.7'], 'punch.pdf', { type: 'application/pdf' });
  fireEvent.change(within(row).getByLabelText('Brochure file'), { target: { files: [file] } });
  await waitFor(() => expect(api.uploadProductBrochure).toHaveBeenCalledWith('p-2', file));
});

it('changes the brochure sender only with a reason, offering only people with a connected mailbox', async () => {
  api.updateAppointmentRules.mockResolvedValue({ data: { rules: { brochure_sender_user_id: 7 } } });
  render(<BrochureProducts canEdit candidates={candidates} />);
  const options = await screen.findByRole('combobox', { name: 'sender options' });
  expect(within(options).queryByText(/No Cal/)).not.toBeInTheDocument();
  fireEvent.change(options, { target: { value: '7' } });
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Riya handles brochures' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.updateAppointmentRules).toHaveBeenCalledWith(
    { brochure_sender_user_id: 7, send_booking_emails: true, reason: 'Riya handles brochures' }));
});

it('gives a viewer no add, edit or upload', async () => {
  render(<BrochureProducts canEdit={false} candidates={candidates} />);
  expect(await screen.findByText('Nexon EV')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Add product|Edit Nexon EV|Upload PDF|Replace|Deactivate/ })).not.toBeInTheDocument();
});
