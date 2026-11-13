import { render, screen } from '@testing-library/react';
import TemperatureChip from './TemperatureChip';
import ScoreFreshnessChip from './ScoreFreshnessChip';
import EngagementBadge from './EngagementBadge';
import { ENGAGEMENT_LABELS } from '@/lib/leadScoreLabels';

describe('TemperatureChip', () => {
  it('shows the temperature to display, PROVISIONAL dashed, and nothing without one', () => {
    const { rerender } = render(<TemperatureChip display={{ label: 'HOT', provisional: false }} />);
    expect(screen.getByTestId('temperature-chip')).toHaveTextContent('HOT');
    rerender(<TemperatureChip display={{ label: 'PROVISIONAL', provisional: true, reason: 'not_contacted' }} />);
    expect(screen.getByTestId('temperature-chip')).toHaveTextContent('PROVISIONAL');
    expect(screen.getByTestId('temperature-chip').className).toMatch(/border-dashed/);
    rerender(<TemperatureChip display={{ label: null, provisional: false, reason: 'score_stale' }} />);
    expect(screen.queryByTestId('temperature-chip')).not.toBeInTheDocument();
  });
});

describe('ScoreFreshnessChip', () => {
  it('shows RECALCULATION DUE and OUT OF DATE, and nothing for an up-to-date score', () => {
    const { rerender } = render(<ScoreFreshnessChip indicator="recalculation_due" />);
    expect(screen.getByTestId('freshness-chip')).toHaveTextContent('RECALCULATION DUE');
    rerender(<ScoreFreshnessChip indicator="out_of_date" />);
    expect(screen.getByTestId('freshness-chip')).toHaveTextContent('OUT OF DATE');
    rerender(<ScoreFreshnessChip indicator={null} />);
    expect(screen.queryByTestId('freshness-chip')).not.toBeInTheDocument();
  });
});

describe('EngagementBadge', () => {
  it('names each of the nine categories', () => {
    expect(Object.keys(ENGAGEMENT_LABELS)).toHaveLength(9);
    Object.entries(ENGAGEMENT_LABELS).forEach(([label, meta]) => {
      const { unmount } = render(<EngagementBadge label={label} latestAttempt={{ state: 'failed', confirmed: true }} />);
      expect(screen.getByTestId('engagement-badge')).toHaveTextContent(meta.label);
      unmount();
    });
  });

  it('shows Failed only for a recorded failure', () => {
    const { rerender } = render(<EngagementBadge label="failed" latestAttempt={{ state: 'failed', confirmed: true }} />);
    expect(screen.getByTestId('engagement-badge')).toHaveTextContent('Failed');
    rerender(<EngagementBadge label="failed" latestAttempt={{ state: 'failed', confirmed: false }} />);
    expect(screen.getByTestId('engagement-badge')).toHaveTextContent('No result recorded yet');
    expect(screen.getByTestId('engagement-badge')).not.toHaveTextContent('Failed');
    rerender(<EngagementBadge label="assessed" latestAttempt={{ state: 'failed' }}
      secondaryBadge={{ kind: 'latest_call', state: 'failed' }} />);
    expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Latest call: No result recorded yet');
  });

  it('explains No result recorded yet and Failed differently', () => {
    const { rerender } = render(<EngagementBadge label="no_result_recorded" latestAttempt={{
      state: 'no_result_recorded', confirmed: false, processing_window_minutes: 15, processing_window_final: false,
    }} />);
    const noResult = screen.getByTestId('engagement-badge').getAttribute('title');
    expect(noResult).toBe('The call ended more than 15 minutes ago and no assessment result has been recorded. '
      + 'This is not a confirmed failure; the result may still arrive. (processing window provisional)');
    expect(screen.getByTestId('engagement-badge').textContent).toContain('⧗');
    rerender(<EngagementBadge label="failed" latestAttempt={{ state: 'failed', confirmed: true }} />);
    const failed = screen.getByTestId('engagement-badge').getAttribute('title');
    expect(failed).toMatch(/failure was recorded/);
    expect(failed).not.toBe(noResult);
    expect(screen.getByTestId('engagement-badge').textContent).toContain('⚠');
  });

  it('keeps the secondary badge a separate element', () => {
    const { rerender } = render(<EngagementBadge label="assessed" latestAttempt={{ state: 'pending_review' }}
      secondaryBadge={{ kind: 'latest_call', state: 'pending' }} />);
    expect(screen.getByTestId('engagement-badge')).toHaveTextContent('Assessed');
    expect(screen.getByTestId('engagement-badge')).not.toHaveTextContent('Latest call');
    expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Latest call: Pending');
    rerender(<EngagementBadge label="pending" latestAttempt={{ state: 'pending_review' }}
      secondaryBadge={{ kind: 'earlier_assessment', state: 'outdated', age_days: 210 }} />);
    expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Earlier assessment: Outdated (210 days)');
    rerender(<EngagementBadge label="pending" latestAttempt={{ state: 'pending_review' }}
      secondaryBadge={{ kind: 'earlier_assessment', state: 'unknown', age_days: 3 }} />);
    expect(screen.getByTestId('secondary-badge')).toHaveTextContent('Earlier assessment: Unknown');
    rerender(<EngagementBadge label="not_contacted" latestAttempt={{ state: 'none' }} secondaryBadge={null} />);
    expect(screen.queryByTestId('secondary-badge')).not.toBeInTheDocument();
  });
});
