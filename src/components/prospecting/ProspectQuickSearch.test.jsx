import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProspectQuickSearch, { RESULT_LIMIT } from './ProspectQuickSearch';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({ getProspects: jest.fn() }));

const MEERA = { prospect_id: 'p-1', full_name: 'Meera Kapoor', email: 'meera@example.com', phone: '+91 98765 43210',
  city: 'Solan', stage: 'QUALIFIED', job_title: 'Owner' };

const renderIt = () => render(<MemoryRouter><ProspectQuickSearch /></MemoryRouter>);
const type = (value) => fireEvent.change(screen.getByLabelText('Search prospects'), { target: { value } });
const settle = async () => { await act(async () => { jest.advanceTimersByTime(400); }); };

beforeEach(() => {
  jest.useFakeTimers();
  api.getProspects.mockResolvedValue({ data: { prospects: [MEERA], total: 1 } });
});
afterEach(() => jest.useRealTimers());

it('searches after a pause and links each match to the lead', async () => {
  renderIt();
  type('98765 43210');
  expect(api.getProspects).not.toHaveBeenCalled();
  await settle();
  expect(api.getProspects).toHaveBeenCalledWith({ search: '98765 43210', limit: RESULT_LIMIT });
  const list = screen.getByRole('list', { name: 'Matching prospects' });
  expect(within(list).getByRole('link', { name: 'Meera Kapoor' })).toHaveAttribute('href', '/leads?prospect=p-1');
  expect(within(list).getByText('meera@example.com')).toBeInTheDocument();
  expect(within(list).getByText('+91 98765 43210')).toBeInTheDocument();
  expect(within(list).getByText('Qualified')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 match');
});

it('sends only the last text typed, and not under two characters', async () => {
  renderIt();
  type('m');
  await settle();
  expect(api.getProspects).not.toHaveBeenCalled();
  expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
  type('me');
  type('mee');
  await settle();
  expect(api.getProspects).toHaveBeenCalledTimes(1);
  expect(api.getProspects).toHaveBeenCalledWith({ search: 'mee', limit: RESULT_LIMIT });
});

it('says when nothing matches and when more matches exist', async () => {
  api.getProspects.mockResolvedValueOnce({ data: { prospects: [], total: 0 } });
  renderIt();
  type('zzz');
  await settle();
  expect(screen.getByRole('status')).toHaveTextContent('No prospects match “zzz”.');
  api.getProspects.mockResolvedValueOnce({ data: { prospects: [MEERA], total: 42 } });
  type('meera');
  await settle();
  expect(screen.getByRole('status')).toHaveTextContent('42 matches · showing the newest 1');
});

it('clears with the button or Escape', async () => {
  renderIt();
  type('meera');
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByLabelText('Search prospects')).toHaveValue('');
  expect(screen.queryByRole('list', { name: 'Matching prospects' })).not.toBeInTheDocument();
  type('meera');
  await settle();
  fireEvent.keyDown(screen.getByLabelText('Search prospects'), { key: 'Escape' });
  expect(screen.getByLabelText('Search prospects')).toHaveValue('');
});

it('shows an error the API returns', async () => {
  api.getProspects.mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Database unavailable' } } });
  renderIt();
  type('meera');
  await settle();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
