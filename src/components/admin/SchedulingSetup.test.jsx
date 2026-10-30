import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SchedulingSetup from './SchedulingSetup';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const demo = {
  id: 'mt-1', key: 'demo', name: 'Product demo', duration_minutes: 30, buffer_minutes: 15, min_notice_minutes: 120,
  booking_window_days: 14, slots_offered: 3, slot_interval_minutes: 30, assignment_method: 'round_robin',
  fallback_method: null, cancellation_action: 'offer_rebook', reminder_offsets_minutes: [60], active: true,
  meeting_link: null, location: 'Apex Motors, MG Road',
};
const testDrive = { ...demo, id: 'mt-2', key: 'test_drive', name: 'Test drive', location: null };
const companyBrochure = { id: 'b-1', meeting_type_id: null, is_default: true, filename: 'Apex.pdf', size_bytes: 2 * 1024 * 1024 };
const demoBrochure = { id: 'b-2', meeting_type_id: 'mt-1', filename: 'Demo.pdf', size_bytes: 300 * 1024 };

beforeEach(() => {
  jest.resetAllMocks();
  api.listMeetingTypes.mockResolvedValue({ data: [demo, testDrive] });
  api.listExecutives.mockResolvedValue({ data: [] });
  api.listExecutiveCandidates.mockResolvedValue({ data: [] });
  api.listBrochures.mockResolvedValue({ data: [companyBrochure, demoBrochure] });
  // The products, brochure sender and brochure requests sections (BrochureProducts, BrochureRequests).
  api.listProducts.mockResolvedValue({ data: [] });
  api.listBrochureRequests.mockResolvedValue({ data: [] });
  api.getAppointmentRules.mockResolvedValue({ data: { rules: { brochure_sender_user_id: null } } });
});

const rowOf = async (name) => (await screen.findByText(name)).closest('div.p-3');

describe('Brochures for the overview email', () => {
  it('points to the Catalog page for the company brochure; shows each type’s own and the fallback', async () => {
    render(<SchedulingSetup canEdit />);
    expect((await screen.findByRole('link', { name: 'Catalog' })).getAttribute('href')).toBe('/catalog');
    expect(within(await rowOf('Product demo')).getByText('Demo.pdf')).toBeInTheDocument();
    expect(within(await rowOf('Test drive')).getByText('Uses the company brochure (Apex.pdf)')).toBeInTheDocument();
  });

  it('uploads a PDF for one meeting type', async () => {
    api.uploadBrochure.mockResolvedValue({ data: {} });
    render(<SchedulingSetup canEdit />);
    const row = within(await rowOf('Test drive'));
    const file = new File(['%PDF-1.7'], 'Drive.pdf', { type: 'application/pdf' });
    fireEvent.change(row.getByLabelText('Brochure file'), { target: { files: [file] } });
    // The uploader names it first: the suggestion is the meeting type's name.
    expect(api.uploadBrochure).not.toHaveBeenCalled();
    expect(row.getByLabelText('Name in emails')).toHaveValue('Test drive Brochure');
    fireEvent.click(row.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(api.uploadBrochure).toHaveBeenCalledWith('mt-2', file, 'Test drive Brochure'));
    await waitFor(() => expect(api.listBrochures).toHaveBeenCalledTimes(2));
  });

  it('sends the name the uploader typed, and needs one', async () => {
    api.uploadBrochure.mockResolvedValue({ data: {} });
    render(<SchedulingSetup canEdit />);
    const row = within(await rowOf('Test drive'));
    const file = new File(['%PDF-1.7'], 'scan_0042.pdf', { type: 'application/pdf' });
    fireEvent.change(row.getByLabelText('Brochure file'), { target: { files: [file] } });
    fireEvent.change(row.getByLabelText('Name in emails'), { target: { value: '  ' } });
    fireEvent.click(row.getByRole('button', { name: 'Upload' }));
    expect(api.uploadBrochure).not.toHaveBeenCalled();
    fireEvent.change(row.getByLabelText('Name in emails'), { target: { value: 'Apex Test Drive Guide' } });
    fireEvent.click(row.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(api.uploadBrochure).toHaveBeenCalledWith('mt-2', file, 'Apex Test Drive Guide'));
  });

  it('renames an uploaded brochure', async () => {
    api.renameBrochure.mockResolvedValue({ data: {} });
    render(<SchedulingSetup canEdit />);
    const row = within(await rowOf('Product demo'));
    fireEvent.click(row.getByRole('button', { name: 'Rename Demo.pdf' }));
    expect(row.getByLabelText('Name in emails')).toHaveValue('Demo');
    fireEvent.change(row.getByLabelText('Name in emails'), { target: { value: 'Product Demo Brochure' } });
    fireEvent.click(row.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.renameBrochure).toHaveBeenCalledWith(expect.anything(), 'Product Demo Brochure'));
  });

  it('refuses a file over the limit before uploading', async () => {
    render(<SchedulingSetup canEdit />);
    const row = within(await rowOf('Test drive'));
    const big = new File(['x'], 'Huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(row.getByLabelText('Brochure file'), { target: { files: [big] } });
    expect(api.uploadBrochure).not.toHaveBeenCalled();
  });

  it('gives a viewer no upload or remove', async () => {
    render(<SchedulingSetup canEdit={false} />);
    expect(await screen.findByText('Demo.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload PDF|Replace|Remove/ })).not.toBeInTheDocument();
  });
});

describe('Meeting link and location', () => {
  it('sends them with the meeting type, blank as null', async () => {
    api.updateMeetingType.mockResolvedValue({ data: demo });
    render(<SchedulingSetup canEdit />);
    const row = within(await rowOf('Product demo'));
    expect(row.getByText('Apex Motors, MG Road')).toBeInTheDocument();
    fireEvent.click(row.getByTitle('Edit'));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByPlaceholderText('https://meet.google.com/…'), { target: { value: ' https://meet.example.com/x ' } });
    fireEvent.change(dialog.getByPlaceholderText('Online, or the showroom address'), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateMeetingType).toHaveBeenCalledWith('mt-1', expect.objectContaining({
      meeting_link: 'https://meet.example.com/x', location: null,
    })));
  });
});
