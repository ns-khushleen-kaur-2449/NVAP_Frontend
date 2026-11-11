import { fireEvent, screen, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import VoiceCampaignDetail from './VoiceCampaignDetail';

jest.mock('@/lib/api');
// Covered by their own tests; here only the contacts table matters.
jest.mock('./CampaignEditDialog', () => () => null);
jest.mock('./CampaignPitchCard', () => () => null);
const api = require('@/lib/api');

const CAMPAIGN = {
  id: 'c1', name: 'Autumn push', status: 'processing', timezone: 'Asia/Kolkata', allowed_actions: [],
  config: {}, stats: {}, created_at: '2026-11-01T09:00:00Z',
};

// GET /api/campaigns/{id}/contacts rows: the numeric lead_score plus the display fields beside it.
const contact = (id, name, score, status, chips) => ({
  contact_id: id, prospect_id: `p-${id}`, name, phone_number: `+15550000${id}`, status, status_label: status,
  attempts: 1, max_attempts: 3, lead_score: score, actions: [],
  score_status: null, temperature_display: null, freshness_indicator: null, assessment: null, ...chips,
});
const assessment = (label, extra = {}) => ({
  engagement_label: label, latest_attempt_state: 'accepted', latest_attempt_confirmed: null, latest_attempt_reason: null,
  age_band: 'recent', secondary_badge: null, ...extra,
});
const CONTACTS = [
  contact(1, 'Stale Sam', 64, 'pending', {
    score_status: 'stale', freshness_indicator: 'out_of_date',
    temperature_display: { label: null, provisional: false, reason: 'score_stale' }, assessment: assessment('not_contacted'),
  }),
  contact(2, 'Hot Hana', 91, 'completed', {
    score_status: 'current', temperature_display: { label: 'HOT', provisional: false, reason: null },
    assessment: assessment('assessed', { secondary_badge: { kind: 'latest_call', state: 'no_result_recorded' },
      latest_attempt_state: 'no_result_recorded', latest_attempt_confirmed: false }),
  }),
  contact(3, 'Provisional Priya', 85, 'pending', {
    score_status: 'current', freshness_indicator: 'recalculation_due',
    temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'assessment_failed' },
    assessment: assessment('failed', { latest_attempt_state: 'failed', latest_attempt_confirmed: true,
      age_band: 'outdated', secondary_badge: { kind: 'earlier_assessment', state: 'outdated', age_days: 210 } }),
  }),
  contact(4, 'No-score Noor', null, 'pending', {}),
];

beforeEach(() => {
  jest.clearAllMocks();
  api.getVoiceCampaign.mockResolvedValue({ data: CAMPAIGN });
  api.getVoiceCampaignContacts.mockResolvedValue({ data: { campaign_id: 'c1', total: CONTACTS.length, contacts: CONTACTS } });
  api.getVoiceCampaignEvents.mockResolvedValue({ data: [] });
});

const openContacts = async () => {
  renderWithAuth(null, { user: USERS.tenant_admin, path: '/voice-campaigns/c1',
    routes: [<Route key="detail" path="/voice-campaigns/:campaignId" element={<VoiceCampaignDetail />} />] });
  fireEvent.click(await screen.findByRole('tab', { name: /Contacts/ }));
  return screen.findByRole('table');
};
const row = (name) => screen.getByText(name).closest('tr');
// The Lead score column (the table's 7th).
const scoreCell = (name) => within(row(name)).getAllByRole('cell')[6];
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent.replace(/\+.*/, ''));

it('shows each contact’s lead score with its temperature, freshness and assessment', async () => {
  await openContacts();
  expect(screen.getByRole('columnheader', { name: 'Lead score' })).toBeInTheDocument();
  const hana = within(scoreCell('Hot Hana'));
  expect(hana.getByText('91')).toBeInTheDocument();
  expect(hana.getByTestId('temperature-chip')).toHaveTextContent('HOT');
  expect(hana.queryByTestId('freshness-chip')).not.toBeInTheDocument();
  expect(hana.getByTestId('engagement-badge')).toHaveTextContent('Assessed');
  expect(hana.getByTestId('secondary-badge')).toHaveTextContent('Latest call: No result recorded yet');

  const priya = within(scoreCell('Provisional Priya'));
  expect(priya.getByText('85')).toBeInTheDocument();
  expect(priya.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
  expect(priya.queryByText('HOT')).not.toBeInTheDocument();  // 85 provisional is never shown as HOT
  expect(priya.getByTestId('freshness-chip')).toHaveTextContent('RECALCULATION DUE');
  expect(priya.getByTestId('engagement-badge')).toHaveTextContent('Failed');
  expect(priya.getByTestId('secondary-badge')).toHaveTextContent('Earlier assessment: Outdated (210 days)');

  const sam = within(scoreCell('Stale Sam'));
  expect(sam.getByText('64')).toBeInTheDocument();
  expect(sam.queryByTestId('temperature-chip')).not.toBeInTheDocument();
  expect(sam.getByTestId('freshness-chip')).toHaveTextContent('OUT OF DATE');
  expect(sam.getByTestId('engagement-badge')).toHaveTextContent('Not contacted');

  expect(scoreCell('No-score Noor').textContent).toBe('—');
  const noor = within(scoreCell('No-score Noor'));
  expect(noor.queryByTestId('temperature-chip')).not.toBeInTheDocument();
  expect(noor.queryByTestId('engagement-badge')).not.toBeInTheDocument();
});

it('still sorts by the number and filters by status, whatever the chips say', async () => {
  await openContacts();
  expect(names()).toEqual(['Stale Sam', 'Hot Hana', 'Provisional Priya', 'No-score Noor']);  // queue order
  fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'score' } });
  // By lead score only: a provisional 85 above a stale 64, no score last.
  expect(names()).toEqual(['Hot Hana', 'Provisional Priya', 'Stale Sam', 'No-score Noor']);
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
  expect(names()).toEqual(['Hot Hana']);
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
  expect(names()).toEqual(['Provisional Priya', 'Stale Sam', 'No-score Noor']);
});
