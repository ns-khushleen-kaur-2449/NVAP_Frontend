import { fireEvent, screen } from '@testing-library/react';
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
