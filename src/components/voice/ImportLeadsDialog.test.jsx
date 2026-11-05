import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { importLeads, previewLeadImport } from '@/lib/api';
import ImportLeadsDialog, { leadMappingProblems } from './ImportLeadsDialog';

jest.mock('@/lib/api', () => ({ previewLeadImport: jest.fn(), importLeads: jest.fn() }));

const PREVIEW = { data: { row_count: 2, uses: [], columns: [
  { column: 'First Name', samples: ['Asha'], filled: 2, suggested: 'first_name' },
  { column: 'Mobile', samples: ['98765 43210'], filled: 2, suggested: 'phone' },
  { column: 'Budget', samples: ['700000'], filled: 2, suggested: 'detail', values: null },
  { column: 'Lead Status', samples: ['Hot', 'Junk'], filled: 2, suggested: 'stage',
    values: [{ value: 'Hot', count: 1, suggested_stage: 'ENGAGED' }, { value: 'Junk', count: 1, suggested_stage: 'DISQUALIFIED' }] },
] } };

beforeEach(() => jest.clearAllMocks());

const chooseFile = async () => {
  const file = new File(['x'], 'leads.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Leads CSV file'), { target: { files: [file] } });
  await screen.findByText('e.g. Asha');
  return file;
};

it('reads the file, lets the user match columns, imports and reports', async () => {
  previewLeadImport.mockResolvedValue(PREVIEW);
  importLeads.mockResolvedValue({ data: { created: 1, skipped_existing: 1, skipped_duplicate_in_file: 0, rejected: 0,
    errors: [], prospect_ids: ['p-1'] } });
  const onImported = jest.fn();
  render(<ImportLeadsDialog open onOpenChange={jest.fn()} onImported={onImported} />);
  const file = await chooseFile();
  fireEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));
  await waitFor(() => expect(importLeads).toHaveBeenCalledWith(file,
    { 'First Name': 'first_name', Mobile: 'phone', Budget: 'detail', 'Lead Status': 'stage' },
    { Hot: 'ENGAGED', Junk: 'DISQUALIFIED' }));
  const result = await screen.findByRole('status', { name: 'Lead import result' });
  expect(result).toHaveTextContent('1 lead added and ticked in the list.');
  expect(result).toHaveTextContent('1 skipped: a lead with that phone number already exists.');
  expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ prospect_ids: ['p-1'] }));
});

it('needs a phone and a name column before importing', async () => {
  previewLeadImport.mockResolvedValue(PREVIEW);
  render(<ImportLeadsDialog open onOpenChange={jest.fn()} />);
  await chooseFile();
  fireEvent.click(screen.getByRole('combobox', { name: 'Use of column Mobile' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Don’t import' }));
  expect(screen.getByText('Choose the column with the phone number.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeDisabled();
});

it('shows why a file could not be read', async () => {
  previewLeadImport.mockRejectedValue({ response: { data: { detail: 'The file has no header row.' } } });
  render(<ImportLeadsDialog open onOpenChange={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Leads CSV file'), { target: { files: [new File(['x'], 'a.csv')] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('The file has no header row.');
});

it('spots a missing name and a column set twice', () => {
  expect(leadMappingProblems({ A: 'phone', B: 'phone', C: 'full_name' }))
    .toEqual(['A and B are all set to “Phone number (required)”; choose one.']);
  expect(leadMappingProblems({ A: 'phone' })).toEqual(['Choose the column with the name (full name, or first/last name).']);
});

it('lets the user match each lead status in the file to an SDR stage', async () => {
  previewLeadImport.mockResolvedValue(PREVIEW);
  importLeads.mockResolvedValue({ data: { created: 2, skipped_existing: 0, skipped_duplicate_in_file: 0, rejected: 0,
    errors: [], prospect_ids: ['a', 'b'], stages: { MEETING: 1, DISQUALIFIED: 1 } } });
  render(<ImportLeadsDialog open onOpenChange={jest.fn()} />);
  const file = await chooseFile();
  expect(screen.getByLabelText('Stages for Lead Status')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Stage for Hot' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Meeting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));
  await waitFor(() => expect(importLeads).toHaveBeenCalledWith(file, expect.objectContaining({ 'Lead Status': 'stage' }),
    { Hot: 'MEETING', Junk: 'DISQUALIFIED' }));
  expect(await screen.findByRole('status', { name: 'Lead import result' })).toHaveTextContent('By stage: Meeting 1, Disqualified 1.');
});

it('refuses a stage column with too many different values', () => {
  expect(leadMappingProblems({ A: 'phone', B: 'full_name', C: 'stage' }, [{ column: 'C', values: null }]))
    .toEqual(['C has too many different values to be the SDR stage; keep it as a lead detail.']);
});
