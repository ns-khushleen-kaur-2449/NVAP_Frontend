import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Link, Route } from 'react-router-dom';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import LeadsPage from './Leads';
import * as api from '@/lib/api';
import { currentScore } from '@/test/leadScoreFixtures';

jest.mock('@/lib/api');

const prospect = { prospect_id: 'p1', full_name: 'Aditi Attri', phone: '+918091790024', status: 'NEW' };

beforeEach(() => {
  jest.resetAllMocks();
  api.getProspects.mockResolvedValue({ data: { prospects: [prospect], total: 1 } });
  api.getProspect.mockResolvedValue({ data: prospect });
  api.getProspectTimeline.mockResolvedValue({ data: { items: [], counts: {} } });
  api.getConversionHistory.mockResolvedValue({ data: { items: [] } });
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

describe('Adding a lead', () => {
  it('sends the job title and department as lead columns, not details', async () => {
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads' });
    fireEvent.click(await screen.findByTestId('add-lead-button'));
    fireEvent.change(screen.getByTestId('lead-name-input'), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByPlaceholderText('Phone'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByPlaceholderText('Job Title'), { target: { value: 'Sales Manager' } });
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Sales' } });
    fireEvent.click(screen.getByTestId('create-lead-submit'));
    await waitFor(() => expect(api.createProspect).toHaveBeenCalledTimes(1));
    const body = api.createProspect.mock.calls[0][0];
    expect(body).toMatchObject({ full_name: 'Asha Rao', phone: '+919876543210', job_title: 'Sales Manager', department: 'Sales' });
    expect(body.custom_fields).not.toHaveProperty('job_title');
    expect(body.custom_fields).not.toHaveProperty('department');
  });
});

describe('A lead whose score is being calculated', () => {
  const lead = (summary) => ({ prospect_id: 'p9', full_name: 'Asha Rao', phone: '+919876543210', is_lead: true,
    lead_score_summary: summary });
  const PENDING = { lead_score: null, status: null, calculated_at: null, classification: 'pending_calculation',
    temperature_display: null, freshness_indicator: null, recalculation_due: false };
  const SCORED = { lead_score: 40, status: 'current', calculated_at: '2026-11-06T10:00:00Z', classification: 'provisional',
    temperature_display: { label: 'PROVISIONAL', provisional: true, reason: null }, freshness_indicator: null,
    recalculation_due: false };
  const listOf = (...leads) => ({ data: { prospects: leads, total: leads.length } });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is read again until its score is calculated, then no more', async () => {
    api.getProspects
      .mockResolvedValueOnce(listOf(lead(PENDING)))
      .mockResolvedValueOnce(listOf(lead(PENDING)))
      .mockResolvedValue(listOf(lead(SCORED)));
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads' });
    await waitFor(() => expect(api.getProspects).toHaveBeenCalledTimes(2));
    await act(async () => { jest.advanceTimersByTime(10000); });
    await waitFor(() => expect(within(screen.getByTestId('score-cell-p9')).getByText('40')).toBeInTheDocument());
    const calls = api.getProspects.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(120000); });
    expect(api.getProspects).toHaveBeenCalledTimes(calls);
  });

  it('is not polled when no lead is pending, and stops after a few checks', async () => {
    api.getProspects.mockResolvedValue(listOf(lead(SCORED)));
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads' });
    await waitFor(() => expect(api.getProspects).toHaveBeenCalledTimes(1));
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(api.getProspects).toHaveBeenCalledTimes(1);

    api.getProspects.mockResolvedValue(listOf(lead(PENDING)));
    fireEvent.click(screen.getByTestId('add-lead-button'));
    fireEvent.change(screen.getByTestId('lead-name-input'), { target: { value: 'Ravi' } });
    fireEvent.click(screen.getByTestId('create-lead-submit'));
    for (let i = 0; i < 10; i += 1) {
      await act(async () => { jest.advanceTimersByTime(10000); });
    }
    // The list after creating, then at most six checks while the lead stays pending.
    expect(api.getProspects.mock.calls.length).toBeLessThanOrEqual(1 + 1 + 6);
    expect(api.getProspects.mock.calls.length).toBeGreaterThan(2);
    // Checks over, still not calculated: the row keeps saying so.
    expect(within(screen.getByTestId('score-cell-p9')).getByText('Pending Calculation')).toBeInTheDocument();
  });

  it('shows the open lead as due for recalculation right after an edit, then its new current score', async () => {
    const DUE = { ...SCORED, freshness_indicator: 'recalculation_due', recalculation_due: true };
    const AFTER = { ...SCORED, lead_score: 52, calculated_at: '2026-11-06T11:00:00Z' };
    api.getProspects.mockResolvedValue(listOf(lead(SCORED)));
    api.getProspect.mockResolvedValue({ data: lead(SCORED) });
    api.getLeadScore
      .mockResolvedValueOnce({ data: currentScore({ lead_score: 40 }) })
      .mockResolvedValueOnce({ data: currentScore({ lead_score: 40, freshness_indicator: 'recalculation_due',
        recalculation: { due: true, reasons: ['details_changed'] } }) })
      .mockResolvedValue({ data: currentScore({ lead_score: 52, calculated_at: '2026-11-06T11:00:00Z' }) });
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads?prospect=p9' });
    await waitFor(() => expect(screen.getByTestId('score-status')).toHaveTextContent('Current'));

    api.updateProspect.mockResolvedValue({ data: lead(DUE) });
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Job title'), { target: { value: 'Sales Director' } });
    // The worker has not finished at the first re-read; it has by the next.
    api.getProspects.mockResolvedValueOnce(listOf(lead(DUE))).mockResolvedValue(listOf(lead(AFTER)));
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('score-status')).toHaveTextContent('Recalculation due'));
    // On the list row and in the open panel alike.
    expect(screen.getAllByTestId('freshness-chip').map((chip) => chip.textContent))
      .toEqual(['RECALCULATION DUE', 'RECALCULATION DUE']);

    await act(async () => { jest.advanceTimersByTime(10000); });
    await waitFor(() => expect(screen.getByTestId('score-status')).toHaveTextContent('Current'));
    expect(api.getLeadScore).toHaveBeenCalledTimes(3);
    expect(within(screen.getByTestId('score-cell-p9')).getByText('52')).toBeInTheDocument();
  });

  it('waits for the recalculation of the lead just edited, but not for other scores due one', async () => {
    const DUE = { ...SCORED, freshness_indicator: 'recalculation_due', recalculation_due: true };
    api.getProspects.mockResolvedValue(listOf(lead(DUE)));
    api.getProspect.mockResolvedValue({ data: lead(DUE) });
    renderWithAuth(<LeadsPage />, { user: USERS.rep, path: '/leads?prospect=p9' });
    await waitFor(() => expect(api.getProspects).toHaveBeenCalledTimes(1));
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(api.getProspects).toHaveBeenCalledTimes(1); // due, but no edit here queued anything to wait for

    api.updateProspect.mockResolvedValue({ data: { ...lead(DUE), full_name: 'Asha R.' } });
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Asha R.' } });
    api.getProspects.mockResolvedValue(listOf(lead({ ...SCORED, lead_score: 52, calculated_at: '2026-11-06T11:00:00Z' })));
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(within(screen.getByTestId('score-cell-p9')).getByText('52')).toBeInTheDocument());
  });
});
