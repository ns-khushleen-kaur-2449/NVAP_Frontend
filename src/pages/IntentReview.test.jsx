import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithAuth, USERS } from '@/test/renderWithAuth';
import IntentReviewPage from './IntentReview';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const item = {
  review_id: 'r1', assessment_id: 'a1', prospect_id: 'p1', prospect_name: 'Aditi Attri',
  review_status: 'pending', reason: 'Confidence below the acceptance threshold', reviewed_by: null,
  created_at: '2026-10-21T05:00:00Z', reviewed_at: null,
};
const assessment = {
  assessment_id: 'a1', prospect_id: 'p1', primary_intent: 'demo_request', secondary_intents: ['pricing_inquiry'],
  customer_status: 'high_intent', buying_signals: ['demo_requested'], objections: ['price: Thinks it is costly'],
  evidence: [{ quote: 'Please schedule a demo next Tuesday.', supports: 'intent', label: 'demo_request' }],
  rationale: 'Asked for a demo.', confidence: 70, recommended_action: 'qualification_review',
  assessment_source: 'ai', assessment_status: 'pending_review', requires_review: true, created_at: '2026-10-21T05:00:00Z',
};
const queue = (items, extra = {}) => ({ data: { items, total: items.length, page: 1, page_size: 25, total_pages: 1, ...extra } });

beforeEach(() => {
  jest.resetAllMocks();
  api.getIntentReviewQueue.mockResolvedValue(queue([item]));
  api.getIntentAssessment.mockResolvedValue({ data: assessment });
  api.listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-9', name: 'Acme' }] } });
});

const PATH = '/operations/intent-review';

async function openRow() {
  fireEvent.click(await screen.findByRole('button', { name: 'Show details for Aditi Attri' }));
  return screen.findByText(/Please schedule a demo next Tuesday/);
}

async function decide(button, reason) {
  fireEvent.click(screen.getByRole('button', { name: button }));
  const dialog = await screen.findByRole('dialog');
  const confirm = within(dialog).getByRole('button', { name: button });
  expect(confirm).toBeDisabled(); // a reason is required
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: reason } });
  fireEvent.click(confirm);
  return dialog;
}

describe('Intent review', () => {
  it('lists pending items and loads details only when a row is opened', async () => {
    renderWithAuth(<IntentReviewPage />, { user: USERS.manager, path: PATH });
    expect(await screen.findByText('Aditi Attri')).toBeInTheDocument();
    expect(screen.getByText('Confidence below the acceptance threshold')).toBeInTheDocument();
    expect(api.getIntentReviewQueue).toHaveBeenCalledWith({ status: 'pending', page: 1, page_size: 25 });
    expect(api.getIntentAssessment).not.toHaveBeenCalled();

    await openRow();
    expect(api.getIntentAssessment).toHaveBeenCalledWith('a1', undefined);
    const intentField = screen.getByText('Intent', { selector: 'dt' }).closest('div');
    expect(intentField).toHaveTextContent('Demo request');
    expect(intentField).toHaveTextContent('Also: Pricing inquiry');
    expect(screen.getByText('High intent')).toBeInTheDocument();
    expect(screen.getByText('Confidence', { selector: 'dt' }).closest('div')).toHaveTextContent('70 / 100');
    expect(screen.getByText('Price')).toBeInTheDocument();

    // Closing and reopening uses what was loaded.
    fireEvent.click(screen.getByRole('button', { name: 'Hide details for Aditi Attri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show details for Aditi Attri' }));
    expect(api.getIntentAssessment).toHaveBeenCalledTimes(1);
  });

  it('approves with a required reason and refreshes', async () => {
    api.reviewIntentAssessment.mockResolvedValue({ data: { ...item, review_status: 'approved' } });
    const onReviewed = jest.fn();
    renderWithAuth(<IntentReviewPage onReviewed={onReviewed} />, { user: USERS.tenant_admin, path: PATH });
    await openRow();
    api.getIntentReviewQueue.mockResolvedValue(queue([]));

    await decide('Approve', 'Evidence checked');
    await waitFor(() => expect(api.reviewIntentAssessment).toHaveBeenCalledWith('a1', 'approved', 'Evidence checked', undefined));
    expect(await screen.findByText('Nothing waiting for review.')).toBeInTheDocument();
    expect(onReviewed).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains a 409 when someone else reviewed it first', async () => {
    api.reviewIntentAssessment.mockRejectedValue({ response: { status: 409, data: { detail: 'Assessment has already been reviewed' } } });
    renderWithAuth(<IntentReviewPage />, { user: USERS.manager, path: PATH });
    await openRow();
    api.getIntentReviewQueue.mockResolvedValue(queue([]));

    await decide('Reject', 'Not what they said');
    expect(await screen.findByRole('status')).toHaveTextContent('Someone else reviewed this assessment first');
    expect(api.reviewIntentAssessment).toHaveBeenCalledWith('a1', 'rejected', 'Not what they said', undefined);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Nothing waiting for review.')).toBeInTheDocument();
  });

  it('filters by status from the address and offers no decisions on decided items', async () => {
    api.getIntentReviewQueue.mockResolvedValue(queue([{ ...item, review_status: 'approved', reviewed_at: '2026-10-21T06:00:00Z' }]));
    renderWithAuth(<IntentReviewPage />, { user: USERS.manager, path: `${PATH}?tab=approved` });
    await openRow();
    expect(api.getIntentReviewQueue).toHaveBeenCalledWith({ status: 'approved', page: 1, page_size: 25 });
    expect(screen.getByRole('tab', { name: /Approved/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Rejected' }));
    await waitFor(() => expect(api.getIntentReviewQueue).toHaveBeenLastCalledWith({ status: 'rejected', page: 1, page_size: 25 }));
  });

  it('lets a Super Admin pick a tenant and view without deciding', async () => {
    renderWithAuth(<IntentReviewPage />, { user: USERS.super_admin, path: PATH });
    await waitFor(() => expect(api.getIntentReviewQueue).toHaveBeenCalledWith({ status: 'pending', page: 1, page_size: 25, tenant_id: 't-9' }));
    await openRow();
    expect(api.getIntentAssessment).toHaveBeenCalledWith('a1', { tenant_id: 't-9' });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('says when the details are gone', async () => {
    api.getIntentAssessment.mockRejectedValue({ response: { status: 404, data: { detail: 'Assessment not found' } } });
    renderWithAuth(<IntentReviewPage />, { user: USERS.manager, path: PATH });
    fireEvent.click(await screen.findByRole('button', { name: 'Show details for Aditi Attri' }));
    expect(await screen.findByText('It is no longer available.')).toBeInTheDocument();
  });
});
