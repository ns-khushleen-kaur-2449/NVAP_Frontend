import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Link, Route } from 'react-router-dom';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import LeadsPage from './Leads';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const prospect = { prospect_id: 'p1', full_name: 'Aditi Attri', phone: '+918091790024', status: 'NEW' };

beforeEach(() => {
  jest.resetAllMocks();
  api.getProspects.mockResolvedValue({ data: { prospects: [prospect], total: 1 } });
  api.getProspect.mockResolvedValue({ data: prospect });
  api.getProspectTimeline.mockResolvedValue({ data: { items: [], counts: {} } });
});

const routes = [
  <Route key="review" path="/operations/intent-review" element={<Link to="/leads?prospect=p1">Open Aditi</Link>} />,
  <Route key="leads" path="/leads" element={<LeadsPage />} />,
];

describe('Leads page opened from another screen', () => {
  it('offers Back to the screen it came from', async () => {
    renderWithAuth(<p>Elsewhere</p>, { user: USERS.manager, path: '/operations/intent-review', routes });
    fireEvent.click(screen.getByRole('link', { name: 'Open Aditi' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('link', { name: 'Open Aditi' })).toBeInTheDocument();
  });

  it('has no Back when the address was opened directly', async () => {
    renderWithAuth(<p>Elsewhere</p>, { user: USERS.manager, path: '/leads?prospect=p1', routes });
    expect(await screen.findByRole('button', { name: 'Close the lead' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

describe('Editing a lead', () => {
  const full = { ...prospect, email: 'aditi@x.co', source: 'website', custom_fields: { budget_min: 800000, timeline: '3 months' } };

  it('saves only what changed and shows the saved lead', async () => {
    api.getProspect.mockResolvedValue({ data: full });
    api.updateProspect.mockResolvedValue({ data: { ...full, full_name: 'Aditi A.', custom_fields: { budget_min: 900000 } } });
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads?prospect=p1' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Timeline')).toHaveValue('3 months');
    fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Aditi A.' } });
    fireEvent.change(dialog.getByLabelText('Budget min'), { target: { value: '900000' } });
    fireEvent.change(dialog.getByLabelText('Timeline'), { target: { value: '' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateProspect).toHaveBeenCalledWith('p1', {
      full_name: 'Aditi A.', custom_fields: { budget_min: 900000, timeline: null },
    }));
    expect(await screen.findByRole('heading', { name: 'Aditi A.' })).toBeInTheDocument();
  });

  it('keeps Save off until something changes, and shows the backend error', async () => {
    api.getProspect.mockResolvedValue({ data: full });
    api.updateProspect.mockRejectedValue({ response: { data: { detail: 'Prospect not found' } } });
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads?prospect=p1' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Budget max'), { target: { value: 'lots' } });
    expect(screen.getByText('Budgets must be numbers.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Budget max'), { target: { value: '1200000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Prospect not found');
  });
});
