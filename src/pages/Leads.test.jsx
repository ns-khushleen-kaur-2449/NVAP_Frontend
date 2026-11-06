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

describe('Leads list scores', () => {
  const scored = (id, summary, status) => ({
    prospect_id: id, full_name: `Lead ${id}`, phone: '+15550000000', is_lead: true,
    lead_score_summary: summary, intent_assessment_status: status,
  });
  const summary = (overrides) => ({
    lead_score: 72, status: 'current', calculated_at: '2026-11-02T10:00:00Z', classification: 'classified',
    temperature_display: { label: 'HOT', provisional: false, reason: null }, freshness_indicator: null,
    recalculation_due: false, data_completeness: { recorded: true, stored_level: 'high', display_level: 'high' },
    ...overrides,
  });

  it('asks for the summaries and shows the number with its temperature, assessment and freshness', async () => {
    api.getProspects.mockResolvedValue({ data: { total: 3, prospects: [
      scored('a', summary(), { engagement_label: 'assessed', latest_attempt: { state: 'accepted' },
        secondary_badge: { kind: 'latest_call', state: 'failed' } }),
      scored('b', summary({ lead_score: 51, classification: 'provisional', freshness_indicator: 'recalculation_due',
        temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'not_contacted' } }),
      { engagement_label: 'not_contacted', latest_attempt: { state: 'none' }, secondary_badge: null }),
      scored('c', summary({ lead_score: 64, status: 'stale', classification: 'stale', freshness_indicator: 'out_of_date',
        temperature_display: { label: null, provisional: false, reason: 'score_stale' } }), null),
    ] } });
    renderWithAuth(<LeadsPage />, { user: USERS.manager, path: '/leads' });
    const a = await screen.findByTestId('score-cell-a');
    expect(api.getProspects).toHaveBeenCalledWith(expect.objectContaining({ include: 'score_summary,assessment_status' }));
    expect(a).toHaveTextContent('72');
    expect(within(a).getByTestId('temperature-chip')).toHaveTextContent('HOT');
    expect(within(a).getByTestId('engagement-badge')).toHaveTextContent('Assessed');
    // A failure the list cannot show as confirmed is not called Failed.
    expect(within(a).getByTestId('secondary-badge')).toHaveTextContent('Latest call: No result recorded yet');
    const b = screen.getByTestId('score-cell-b');
    expect(within(b).getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
    expect(within(b).getByTestId('freshness-chip')).toHaveTextContent('RECALCULATION DUE');
    expect(within(b).getByTestId('engagement-badge')).toHaveTextContent('Not contacted');
    const c = screen.getByTestId('score-cell-c');
    expect(c).toHaveTextContent('64');
    expect(within(c).queryByTestId('temperature-chip')).not.toBeInTheDocument();
    expect(within(c).getByTestId('freshness-chip')).toHaveTextContent('OUT OF DATE');
  });

  it('never colours a score by a cut-off of its own', async () => {
    api.getProspects.mockResolvedValue({ data: { total: 1, prospects: [
      scored('p', summary({ lead_score: 85, classification: 'provisional',
        temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'assessment_failed' } }), null),
    ] } });
    renderWithAuth(<LeadsPage />, { user: USERS.manager, path: '/leads' });
    const cell = await screen.findByTestId('score-cell-p');
    expect(cell.querySelector('[style*="173"]')).toBeNull();
    expect(within(cell).getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
    expect(cell).not.toHaveTextContent('HOT');
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
    expect(screen.getByText('Number fields must be numbers.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Budget max'), { target: { value: '1200000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Prospect not found');
  });
});
