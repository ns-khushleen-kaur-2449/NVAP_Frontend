import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { operationsRoutes } from './Operations';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const callback = {
  id: 7, name: 'Lata', status: 'MISSED', status_label: 'Missed', source_label: 'Asked for on a call',
  scheduled_time: '2026-10-21T05:00:00Z', attempts: 3, max_attempts: null, assistant_id: 'asst-1',
  allowed_actions: ['requeue'], status_reason: 'No answer after 3 tries',
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getAssistants.mockResolvedValue({ data: [] });
  api.getScheduledCalls.mockResolvedValue({ data: { scheduled_calls: [callback] } });
  api.getDoNotCallEntries.mockResolvedValue({ data: { entries: [{ id: 1 }, { id: 2 }] } });
  api.getDoNotCallHistory.mockResolvedValue({ data: { events: [] } });
  api.getIntentReviewQueue.mockResolvedValue({ data: { items: [], total: 12, page: 1, page_size: 1, total_pages: 12 } });
  api.listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-9', name: 'Acme' }] } });
  api.getVoiceCampaigns.mockResolvedValue({ data: { campaigns: [] } });
  api.getAppointments.mockResolvedValue({ data: {
    items: [], total: 0, page: 1, page_size: 25, counts: { needs_outcome: 3 }, calendar: {},
  } });
});

function renderAt(path, user = USERS.manager) {
  return renderWithAuth(<p>Somewhere else</p>, {
    user, path,
    routes: [...operationsRoutes(), <Route key="403" path="/403" element={<p>Forbidden page</p>} />],
  });
}

const tabLink = (name) => screen.getByRole('link', { name: new RegExp(`^${name}`) });

describe('Operations page', () => {
  it('opens the first tab from /operations', async () => {
    renderAt('/operations');
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
    expect(tabLink('Appointments')).toHaveAttribute('aria-current', 'page');
  });

  it('switches tabs through the URL', async () => {
    renderAt('/operations/callbacks');
    await screen.findByRole('heading', { name: 'Callbacks' });

    fireEvent.click(tabLink('Intent review'));
    expect(await screen.findByRole('heading', { name: 'Intent review' })).toBeInTheDocument();
    expect(tabLink('Intent review')).toHaveAttribute('aria-current', 'page');
    expect(tabLink('Callbacks')).not.toHaveAttribute('aria-current');

    fireEvent.click(tabLink('Do-not-call'));
    expect(await screen.findByRole('heading', { name: 'Do-not-call' })).toBeInTheDocument();

    fireEvent.click(tabLink('Appointments'));
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
  });

  it('opens a tab named in the address, and sends an unknown tab to the first', async () => {
    renderAt('/operations/intent-review');
    expect(await screen.findByRole('heading', { name: 'Intent review' })).toBeInTheDocument();
  });

  it('sends an unknown tab to the first one', async () => {
    renderAt('/operations/nope');
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
  });

  it('redirects the old /appointments address and keeps its query', async () => {
    renderAt('/appointments?tab=cancelled');
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
    await waitFor(() => expect(api.getAppointments).toHaveBeenCalledWith(expect.objectContaining({ tab: 'cancelled' })));
    expect(tabLink('Appointments')).toHaveAttribute('aria-current', 'page');
  });

  it('redirects the old /callbacks address and keeps its query', async () => {
    renderAt('/callbacks?tab=missed');
    expect(await screen.findByText('Lata')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Missed/ })).toHaveAttribute('aria-selected', 'true');
    expect(tabLink('Callbacks')).toHaveAttribute('aria-current', 'page');
  });

  it('redirects the old /do-not-call address and keeps its query', async () => {
    renderAt('/do-not-call?tab=history');
    expect(await screen.findByRole('heading', { name: 'Do-not-call' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });

  it.each(['/operations/intent-review', '/operations/callbacks', '/callbacks', '/do-not-call'])(
    'sends a Sales Rep from %s to 403', async (path) => {
      renderAt(path, USERS.rep);
      expect(await screen.findByText('Forbidden page')).toBeInTheDocument();
      expect(api.getIntentReviewQueue).not.toHaveBeenCalled();
      expect(api.getScheduledCalls).not.toHaveBeenCalled();
    });

  it('gives a Sales Rep only the Appointments tab', async () => {
    renderAt('/operations', USERS.rep);
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^(Appointments|Callbacks|Do-not-call|Intent review)/ })).toHaveLength(1);
    await waitFor(() => expect(tabLink('Appointments')).toHaveTextContent('3'));
    expect(api.getIntentReviewQueue).not.toHaveBeenCalled();
    expect(api.getDoNotCallEntries).not.toHaveBeenCalled();
  });

  it('shows what is waiting on the tabs that can be counted cheaply', async () => {
    renderAt('/operations/callbacks');
    await waitFor(() => expect(tabLink('Intent review')).toHaveTextContent('12'));
    expect(tabLink('Do-not-call')).toHaveTextContent('2');
    expect(tabLink('Appointments')).toHaveTextContent('3');
    expect(tabLink('Callbacks')).toHaveTextContent(/^Callbacks$/);
    expect(api.getAppointments).toHaveBeenCalledWith({ tab: 'needs_outcome', page_size: 1 });
    expect(api.getIntentReviewQueue).toHaveBeenCalledWith({ status: 'pending', page_size: 1 });
  });

  it('gives a Super Admin no counts (no tenant chosen yet)', async () => {
    renderAt('/operations/callbacks', USERS.super_admin);
    await screen.findByRole('heading', { name: 'Callbacks' });
    expect(api.getIntentReviewQueue).not.toHaveBeenCalled();
    expect(tabLink('Intent review')).toHaveTextContent(/^Intent review$/);
    expect(api.getAppointments).not.toHaveBeenCalledWith({ tab: 'needs_outcome', page_size: 1 });
  });
});

describe('Sidebar', () => {
  it.each(['manager', 'rep'])('has one Operations entry (and no separate screens) for a %s', (role) => {
    renderWithAuth(<Sidebar />, { user: USERS[role], path: '/dashboard' });
    expect(screen.getByRole('link', { name: 'Operations' })).toHaveAttribute('href', '/operations');
    for (const name of ['Appointments', 'Callbacks', 'Do-not-call']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });
});
