import { fireEvent, screen } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import CallLogDetail from './CallLogDetail';
import { useCallLogDetail } from '@/hooks/useCallLogs';
import * as api from '@/lib/api';

jest.mock('@/lib/api');
jest.mock('@/hooks/useCallLogs');

const log = {
  id: 42, vapi_call_id: 'call-abc', status: 'answered', customer_name: 'Aditi Attri', customer_number: '+918091790024',
  started_at: '2026-10-21T05:00:00Z', ended_at: '2026-10-21T05:00:33Z', duration_seconds: 33,
  summary: 'Asked for a demo.', transcript: 'AI: Hello\nUser: Please schedule a demo next Tuesday.',
};
const assessment = {
  assessment_id: 'a1', prospect_id: 'p1', primary_intent: 'demo_request', secondary_intents: [],
  customer_status: 'high_intent', buying_signals: ['demo_requested'], objections: [],
  evidence: [{ quote: 'Please schedule a demo next Tuesday.', supports: 'intent', label: 'demo_request' }],
  rationale: 'Asked for a demo.', confidence: 70, recommended_action: 'qualification_review',
  assessment_source: 'ai', assessment_status: 'pending_review', requires_review: true, created_at: '2026-10-21T05:01:00Z',
};
const review = {
  review_id: 'r1', assessment_id: 'a1', prospect_id: 'p1', review_status: 'pending',
  reason: 'Confidence below the acceptance threshold', created_at: '2026-10-21T05:01:00Z',
};

beforeEach(() => {
  jest.resetAllMocks();
  useCallLogDetail.mockReturnValue({ detail: log, loading: false, error: null });
  api.getCallRecordingUrl.mockResolvedValue({ data: { url: 'https://example.com/r.wav' } });
});

const renderAs = (user) => renderWithAuth(<CallLogDetail callId="call-abc" onBack={jest.fn()} />, { user, path: '/voice_agent?tab=logs' });

describe('Call log intent assessment', () => {
  it("shows the call's assessment and sends a manager to review it", async () => {
    api.getCallIntentAssessment.mockResolvedValue({ data: { assessment, review } });
    renderAs(USERS.manager);
    expect(await screen.findByText('Waiting for review')).toBeInTheDocument();
    expect(api.getCallIntentAssessment).toHaveBeenCalledWith('call-abc');
    expect(screen.getByText('Confidence below the acceptance threshold')).toBeInTheDocument();
    expect(screen.getByText('Confidence', { selector: 'dt' }).closest('div')).toHaveTextContent('70 / 100');
    expect(screen.getByRole('link', { name: 'Review it in Operations' })).toHaveAttribute('href', '/operations/intent-review');

    // Compact: the quotes and reasons wait behind "Show details".
    expect(screen.queryByText('Evidence from the call')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Evidence from the call')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a Sales Rep the assessment without the review link', async () => {
    api.getCallIntentAssessment.mockResolvedValue({ data: { assessment: { ...assessment, assessment_status: 'accepted' }, review: null } });
    renderAs(USERS.rep);
    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review it in Operations' })).not.toBeInTheDocument();
  });

  it('says when the call was not assessed', async () => {
    api.getCallIntentAssessment.mockResolvedValue({ data: { assessment: null, review: null } });
    renderAs(USERS.manager);
    expect(await screen.findByText(/This call has no intent assessment/)).toBeInTheDocument();
  });

  it('says when the assessment is outside what the user may see', async () => {
    api.getCallIntentAssessment.mockRejectedValue({ response: { status: 404 } });
    renderAs(USERS.manager);
    expect(await screen.findByText('The assessment of this call is not available to you.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
