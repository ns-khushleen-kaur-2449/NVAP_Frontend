import { render, screen } from '@testing-library/react';
import ScoreChips from './ScoreChips';
import ProspectResultRow from '@/components/prospecting/ProspectResultRow';

// A row of POST /api/ai/filter/search or GET /api/campaigns/{id}/contacts (display fields only).
const chips = (overrides = {}) => ({
  score_status: 'current',
  temperature_display: { label: 'PROVISIONAL', provisional: true, reason: 'assessment_failed' },
  freshness_indicator: 'recalculation_due',
  assessment: {
    engagement_label: 'failed', latest_attempt_state: 'failed', latest_attempt_confirmed: true,
    latest_attempt_reason: 'processing_error', age_band: 'outdated',
    secondary_badge: { kind: 'earlier_assessment', state: 'outdated', age_days: 210 },
  },
  ...overrides,
});

it('shows temperature, freshness and assessment as separate chips', () => {
  render(<ScoreChips chips={chips()} />);
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
  expect(screen.getByTestId('freshness-chip')).toHaveTextContent('RECALCULATION DUE');
  expect(screen.getByTestId('engagement-badge')).toHaveTextContent('Failed');
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Earlier assessment: Outdated (210 days)');
});

it('never shows Failed for an unconfirmed failure', () => {
  render(<ScoreChips chips={chips({ assessment: { ...chips().assessment, latest_attempt_confirmed: false } })} />);
  expect(screen.getByTestId('engagement-badge')).toHaveTextContent('No result recorded yet');
});

it('names why a skipped call was not assessed, only from its recorded reason', () => {
  const skipped = (reason) => chips({
    temperature_display: { label: 'WARM', provisional: false, reason: null },
    assessment: { engagement_label: 'outdated', latest_attempt_state: 'skipped', latest_attempt_confirmed: null,
      latest_attempt_reason: reason, age_band: 'outdated', secondary_badge: { kind: 'latest_call', state: 'skipped' } },
  });
  const { rerender } = render(<ScoreChips chips={skipped('disabled_by_config')} />);
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Latest call: Not assessed (assessment turned off)');
  rerender(<ScoreChips chips={skipped('missing_verified_prospect')} />);
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Latest call: Not assessed (no verified lead)');
  expect(screen.getByTestId('secondary-badge')).not.toHaveTextContent('turned off');
  rerender(<ScoreChips chips={skipped(null)} />);
  expect(screen.getByTestId('secondary-badge')).toHaveTextContent(/^Latest call: Not assessed$/);
});

it('shows nothing extra for a row without display fields', () => {
  const { container } = render(<ScoreChips chips={{ temperature_display: null, freshness_indicator: null, assessment: null }} />);
  expect(container.querySelector('[data-testid="temperature-chip"]')).toBeNull();
  expect(container.querySelector('[data-testid="engagement-badge"]')).toBeNull();
});

it('an AI Filter row keeps its number and adds the chips', () => {
  render(<ul><ProspectResultRow prospect={{
    prospect_id: 'p1', full_name: 'Aditi Attri', has_phone: true, is_decision_maker: false, status: 'NEW',
    created_at: '2026-11-01T00:00:00Z', score: 85, ...chips(),
  }} /></ul>);
  expect(screen.getByLabelText('Score 85')).toHaveTextContent('85');
  expect(screen.getByText('Lead score')).toBeInTheDocument();
  expect(screen.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
  expect(screen.queryByText('HOT')).not.toBeInTheDocument();  // 85 provisional is never HOT
});
