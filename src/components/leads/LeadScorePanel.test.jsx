import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LeadScorePanel from './LeadScorePanel';
import {
  S7_EXPLANATION,
  UNKNOWN_EXPLANATION,
  currentScore,
  historyItem,
} from '@/test/leadScoreFixtures';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const api = require('@/lib/api');

const OLDER = { ...UNKNOWN_EXPLANATION, calculated_at: '2026-10-01T09:00:00Z' };
const HISTORY = [historyItem('h-current', S7_EXPLANATION), historyItem('h-older', OLDER)];

beforeEach(() => {
  jest.clearAllMocks();
  api.getLeadScoreHistory.mockResolvedValue({ data: { items: [] } });
});

const show = async (score, history = []) => {
  api.getLeadScore.mockResolvedValue({ data: score });
  api.getLeadScoreHistory.mockResolvedValue({ data: { items: history } });
  const view = render(<LeadScorePanel prospectId="p1" />);
  await screen.findByTestId('score-calculation');
  return view;
};

it('shows the temperature to display, never the legacy band, when it is provisional', async () => {
  await show(currentScore({
    lead_score: 51, temperature: 'WARM',
    temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'not_contacted' },
    data_completeness: { recorded: true, stored_level: 'medium', display_level: 'medium', cap_reason: 'engagement_not_contacted' },
  }));
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
  expect(screen.queryByText('WARM')).not.toBeInTheDocument();
  expect(screen.getByTestId('provisional-reason')).toHaveTextContent('Provisional: No calls yet.');
  const now = screen.getByTestId('score-now');
  expect(within(now).getByTestId('data-completeness')).toHaveTextContent('Data Completeness: ●●○Medium');
  expect(within(now).getByTestId('data-completeness')).toHaveTextContent('shown as Medium at most: not contacted');
});

it('keeps the live layer and the recorded calculation separate', async () => {
  await show(currentScore());
  const now = screen.getByTestId('score-now');
  const calculation = screen.getByTestId('score-calculation');
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('HOT');
  expect(calculation).toHaveTextContent('How this score was calculated');
  expect(calculation).toHaveTextContent('with the settings in force then');
  expect(within(calculation).getByTestId('why-this-score')).toHaveTextContent('Total 71.6 → rounded to 72');
  expect(within(calculation).getByTestId('data-completeness')).toHaveTextContent('when calculated');
  expect(within(now).queryByTestId('why-this-score')).not.toBeInTheDocument();
  expect(within(now).queryByTestId('provisional-reason')).not.toBeInTheDocument();
});

it('says when the score needs recalculating, and why', async () => {
  await show(currentScore({
    freshness_indicator: 'recalculation_due',
    recalculation: { due: true, reasons: ['settings_changed', 'new_intent'] },
  }));
  expect(screen.getByTestId('recalculation-due'))
    .toHaveTextContent('Recalculation due: scoring settings changed; a newer call was assessed.');
});

it('shows a stale score as out of date, with no temperature', async () => {
  await show(currentScore({
    status: 'stale', temperature: null, freshness_indicator: 'out_of_date',
    temperature_display: { label: null, provisional: false, reason: 'score_stale' },
    recalculation: { due: true, reasons: ['details_changed'] },
  }));
  expect(screen.queryByTestId('temperature-chip')).not.toBeInTheDocument();
  expect(screen.getByTestId('out-of-date')).toHaveTextContent('Out of date: this is the last calculated value');
  expect(screen.getByTestId('out-of-date')).toHaveTextContent('Its details are back, so it can be recalculated.');
});

it('says a demo score has no explanation', async () => {
  await show(currentScore({ explanation: { available: false, reason: 'no_recorded_calculation' }, score_history_id: null }));
  expect(screen.getByTestId('explanation-unavailable')).toHaveTextContent('Score explanation unavailable.');
});

it('labels recent scores as historical and opens each one\'s own recorded explanation', async () => {
  await show(currentScore(), HISTORY);
  const history = screen.getByTestId('score-history');
  expect(within(history).getAllByText(/^Historical ·/)).toHaveLength(2);
  fireEvent.click(within(history).getAllByRole('button')[1]);
  const opened = screen.getByTestId('historical-explanation');
  expect(opened).toHaveTextContent('Total 39.5 → rounded to 40');
  expect(within(opened).getByTestId('factor-intent_customer_status')).toHaveTextContent('+8 of 40');
  // The current calculation is still the current one.
  expect(within(screen.getByTestId('score-calculation')).getByTestId('why-this-score'))
    .toHaveTextContent('Total 71.6 → rounded to 72');
});

it('never changes a historical explanation when the live state changes', async () => {
  const openOlder = async (score) => {
    const view = await show(score, HISTORY);
    fireEvent.click(within(screen.getByTestId('score-history')).getAllByRole('button')[1]);
    const text = screen.getByTestId('historical-explanation').textContent;
    view.unmount();
    return text;
  };
  const before = await openOlder(currentScore());
  const after = await openOlder(currentScore({
    lead_score: 51,
    temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'assessment_failed' },
    data_completeness: { recorded: true, stored_level: 'high', display_level: 'medium', cap_reason: 'latest_attempt_failed' },
    recalculation: { due: true, reasons: ['settings_changed'] }, freshness_indicator: 'recalculation_due',
  }));
  expect(after).toBe(before);
});

it('shows the new explanation after a recalculation', async () => {
  await show(currentScore(), []);
  const recalculated = currentScore({ lead_score: 40, explanation: UNKNOWN_EXPLANATION,
    temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'inconclusive_assessment' } });
  api.calculateLeadScore.mockResolvedValue({
    data: { current_score: recalculated, calculation: historyItem('h-new', UNKNOWN_EXPLANATION), is_current: true },
  });
  api.getLeadScoreHistory.mockResolvedValue({ data: { items: [historyItem('h-new', UNKNOWN_EXPLANATION)] } });
  fireEvent.click(screen.getByTestId('calculate-score'));
  await waitFor(() => expect(screen.getByTestId('why-this-score')).toHaveTextContent('Total 39.5 → rounded to 40'));
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
  expect(screen.getByTestId('provisional-reason'))
    .toHaveTextContent('The latest accepted assessment was inconclusive.');
});

it('shows the assessment, its secondary badge, the intent age and the freshness as separate elements', async () => {
  await show(currentScore({
    engagement_label: 'assessed',
    secondary_badge: { kind: 'latest_call', state: 'no_result_recorded', age_days: null },
    latest_attempt: { state: 'no_result_recorded', confirmed: false, processing_window_minutes: 15 },
    accepted_intent: { customer_status: 'medium_intent', age_days: 46, usable: true },
    freshness_indicator: 'recalculation_due', recalculation: { due: true, reasons: ['intent_aged'] },
  }));
  expect(screen.getByTestId('engagement-badge')).toHaveTextContent('Assessed');
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Latest call: No result recorded yet');
  expect(screen.getByTestId('intent-age')).toHaveTextContent('Assessed 46 days ago');
  expect(screen.getByTestId('freshness-chip')).toHaveTextContent('RECALCULATION DUE');
  // Due for recalculation: not presented as current.
  expect(screen.getByTestId('score-status')).toHaveTextContent('Recalculation due');
  expect(screen.getByTestId('score-status')).not.toHaveTextContent('Current');
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('HOT');
});

it('shows a stale score as Stale and OUT OF DATE', async () => {
  await show(currentScore({
    status: 'stale', freshness_indicator: 'out_of_date', recalculation: { due: false, reasons: [] },
    temperature_display: { label: null, provisional: false, reason: 'score_stale' },
  }));
  expect(screen.getByTestId('score-status')).toHaveTextContent('Stale');
  expect(screen.getByTestId('freshness-chip')).toHaveTextContent('OUT OF DATE');
});

it('shows the assessment status of a lead without a score', async () => {
  api.getLeadScore.mockRejectedValue({ response: { status: 404 } });
  api.getProspectAssessmentStatus.mockResolvedValue({ data: {
    engagement_label: 'failed', latest_attempt: { state: 'failed', confirmed: true },
    secondary_badge: { kind: 'earlier_assessment', state: 'outdated', age_days: 210 },
    accepted_intent: { customer_status: 'high_intent', age_days: 210, usable: false },
    thresholds: { pending_timeout_minutes: 15, pending_timeout_final: false },
  } });
  render(<LeadScorePanel prospectId="p1" />);
  expect(await screen.findByTestId('engagement-badge')).toHaveTextContent('Failed');
  expect(screen.getByText('This lead has not been scored yet.')).toBeInTheDocument();
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Earlier assessment: Outdated (210 days)');
  expect(api.getProspectAssessmentStatus).toHaveBeenCalledWith('p1');
  expect(screen.queryByTestId('temperature-chip')).not.toBeInTheDocument();
});

it('reads the score through the lead score API only', async () => {
  await show(currentScore(), HISTORY);
  expect(api.getLeadScore).toHaveBeenCalledWith('p1');
  expect(api.getLeadScoreHistory).toHaveBeenCalledWith('p1', { page: 1, page_size: 5 });
  expect(api.calculateLeadScore).not.toHaveBeenCalled();
});
