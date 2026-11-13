import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ConversionWorkspace from './ConversionWorkspace';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
// The decision dialogs are covered by their own behaviour; here we only check they open.
jest.mock('@/components/ops/ReasonDialog', () => ({ title, open }) => (open ? <div role="dialog">{title}</div> : null));

const prospect = (id, name, stage, extra = {}) => ({
  prospect_id: id, full_name: name, email: `${name.split(' ')[0].toLowerCase()}@demo.test`, current_stage: stage,
  updated_at: '2030-01-06T06:30:00Z', pending_decision_id: null, pending_target_stage: null, unverified_evidence_count: 0, ...extra,
});

const MAYA = prospect('p-1', 'Maya Khan', 'QUALIFIED');
const NIKHIL = prospect('p-2', 'Nikhil Joshi', 'CONTACTED', { unverified_evidence_count: 2 });
const DIYA = prospect('p-3', 'Diya Khan', 'DO_NOT_CONTACT');
const PENDING = prospect('p-4', 'Pia Rao', 'QUALIFIED', { pending_decision_id: 'd-9', pending_target_stage: 'CONVERTED', unverified_evidence_count: 1 });

const workspace = (prospects, summary = {}) => ({
  data: {
    summary: { awaiting_approvals: 0, evidence_to_verify: 0, qualified_prospects: 6, converted_prospects: 5, ...summary },
    prospects, total: prospects.length, page: 1, page_size: 50, total_pages: 1,
  },
});

const decisionItem = {
  id: 'd-9', type: 'decision', title: 'Conversion decision created', occurred_at: '2030-01-06T06:30:00Z',
  detail: { decision_status: 'PENDING_APPROVAL', qualification_status: 'QUALIFIED', current_stage: 'QUALIFIED', target_stage: 'CONVERTED',
    reason_codes: ['POLICY_MET'], missing_criteria: [], conflicting_criteria: [] },
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, NIKHIL, DIYA]));
  api.getConversionTimeline.mockResolvedValue({ data: { items: [] } });
  api.getConversionEvidenceCandidates.mockResolvedValue({ data: { items: [] } });
});

const renderPage = (user = USERS.tenant_admin) => renderWithAuth(<ConversionWorkspace />, { user, path: '/conversion' });
// React renders `Showing {n} of {m}` as several text nodes; match the whole paragraph's text instead.
const paragraph = (text) => (_, element) => element.tagName === 'P'
  && (text instanceof RegExp ? text.test(element.textContent) : element.textContent.trim() === text);
const explorer = () => screen.getByRole('complementary', { name: 'Prospect explorer' });

it('shows the number of decisions needing review', async () => {
  api.getConversionWorkspace.mockResolvedValue(workspace([MAYA], { awaiting_approvals: 1, needs_review: 2 }));
  renderPage();
  const kpis = await screen.findByRole('region', { name: 'Conversion summary' });
  expect(kpis).toHaveTextContent('Needs review2');
});

it('shows the summary numbers the backend returned and does not invent any', async () => {
  api.getConversionWorkspace.mockResolvedValue(workspace([MAYA], { awaiting_approvals: 3, evidence_to_verify: 7, qualified_prospects: 11, converted_prospects: 2 }));
  renderPage();
  const kpis = await screen.findByRole('region', { name: 'Conversion summary' });
  expect(kpis).toHaveTextContent('Pending approvals3');
  expect(kpis).toHaveTextContent('Evidence review7');
  expect(kpis).toHaveTextContent('Qualified prospects11');
  expect(kpis).toHaveTextContent('Converted prospects2');
});

it('lists the prospects, with the total, and opens the first one', async () => {
  renderPage();
  const list = within(await waitFor(() => explorer()));
  expect(await list.findByText('Maya Khan')).toBeInTheDocument();
  expect(list.getByText('Nikhil Joshi')).toBeInTheDocument();
  expect(list.getByText(paragraph('Showing 3 of 3'))).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Maya Khan', level: 2 })).toBeInTheDocument();
  await waitFor(() => expect(api.getConversionTimeline).toHaveBeenCalledWith('p-1', {}));
});

it('switches the details when another prospect is chosen', async () => {
  renderPage();
  fireEvent.click(await within(await waitFor(() => explorer())).findByText('Nikhil Joshi'));
  expect(await screen.findByRole('heading', { name: 'Nikhil Joshi', level: 2 })).toBeInTheDocument();
  await waitFor(() => expect(api.getConversionTimeline).toHaveBeenCalledWith('p-2', {}));
});

it('shows a loading state, then the data', async () => {
  let release;
  api.getConversionWorkspace.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  renderPage();
  expect(screen.getByLabelText('Loading Conversion Workspace')).toBeInTheDocument();
  release(workspace([MAYA]));
  expect(await screen.findByRole('region', { name: 'Conversion summary' })).toBeInTheDocument();
});

it('says so when there are no prospects', async () => {
  api.getConversionWorkspace.mockResolvedValue(workspace([]));
  renderPage();
  expect(await screen.findByText('No prospects yet.')).toBeInTheDocument();
  expect(screen.getByText('Select a prospect to inspect conversion activity.')).toBeInTheDocument();
});

it('says so when a search matches nothing', async () => {
  renderPage();
  const search = await screen.findByLabelText('Search prospects');
  api.getConversionWorkspace.mockResolvedValue(workspace([]));
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(await screen.findByText('No prospects match “zzz”.')).toBeInTheDocument();
  expect(api.getConversionWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'zzz' }));
});

it('shows the error and lets the visitor retry', async () => {
  api.getConversionWorkspace.mockRejectedValueOnce({ response: { data: { detail: 'Backend is down' } } });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Backend is down');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Conversion summary' })).toBeInTheDocument();
});

it('filters to prospects needing attention and sorts by name', async () => {
  renderPage();
  const list = within(await waitFor(() => explorer()));
  await list.findByText('Maya Khan');
  fireEvent.change(list.getByLabelText('Filter'), { target: { value: 'attention' } });
  expect(list.queryByText('Maya Khan')).not.toBeInTheDocument();
  expect(list.getByText('Nikhil Joshi')).toBeInTheDocument();
  fireEvent.change(list.getByLabelText('Filter'), { target: { value: 'all' } });
  fireEvent.change(list.getByLabelText('Sort'), { target: { value: 'name' } });
  const names = list.getAllByRole('button').map((button) => button.textContent).filter((text) => /Khan|Joshi/.test(text));
  expect(names[0]).toMatch(/Diya Khan/);
});

it('has no pipeline strip above the prospect list', async () => {
  renderPage();
  await waitFor(() => explorer());
  expect(screen.queryByRole('navigation', { name: 'Prospects by stage' })).not.toBeInTheDocument();
});

it('offers no contact actions for a Do Not Contact prospect and says why', async () => {
  renderPage();
  fireEvent.click(await within(await waitFor(() => explorer())).findByText('Diya Khan'));
  expect(await screen.findByText(/must not be contacted/)).toBeInTheDocument();
  expect(screen.getByText('Outreach blocked')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /call|contact now|follow/i })).not.toBeInTheDocument();
});

describe('Approval desk', () => {
  const openDesk = async () => {
    await screen.findByRole('region', { name: 'Conversion summary' });
    fireEvent.click(screen.getByRole('button', { name: /Approval desk/ }));
    return screen.findByRole('dialog', { name: /Approval desk/ });
  };

  it('says all is clear when nothing is waiting', async () => {
    renderPage();
    const desk = within(await openDesk());
    expect(desk.getByText('All caught up!')).toBeInTheDocument();
    expect(desk.getByText('There are no conversion decisions waiting for review.')).toBeInTheDocument();
  });

  it('lets a tenant admin approve or reject a pending decision', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, PENDING], { awaiting_approvals: 1 }));
    renderPage(USERS.tenant_admin);
    const desk = within(await openDesk());
    expect(desk.getByText('Pia Rao')).toBeInTheDocument();
    expect(desk.getByText('Converted')).toBeInTheDocument();
    fireEvent.click(desk.getByRole('button', { name: /Approve/ }));
    expect(await screen.findByText('Approve conversion decision')).toBeInTheDocument();
  });

  it('never offers Approve or Reject to someone who may not review', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, PENDING], { awaiting_approvals: 1 }));
    renderPage(USERS.manager);
    const desk = within(await openDesk());
    expect(desk.getByText('Pia Rao')).toBeInTheDocument();
    expect(desk.getByText(/read-only access/)).toBeInTheDocument();
    expect(desk.queryByRole('button', { name: /Approve|Reject/ })).not.toBeInTheDocument();
  });

  const REVIEW = prospect('p-5', 'Rhea Sen', 'CONTACTED', {
    review_decision_id: 'd-5',
    review_reason_codes: ['INTENT_MISSING', 'LEAD_SCORE_GATE_SKIPPED_RECALCULATION_DUE',
      'LEAD_SCORE_RECALCULATION_RECOMMENDED', 'LEAD_SCORE_GATE_NOT_EVALUATED'],
    review_score_gate: { evaluated: false, situation: 'recalculation_due', recommended_action: 'recalculate_score' },
  });

  it('shows decisions waiting for review, with why and what to do, but nothing to approve', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, REVIEW], { needs_review: 1 }));
    renderPage();
    const desk = within(await openDesk());
    const card = within(desk.getByTestId('review-p-5'));
    expect(card.getByText('Needs review')).toBeInTheDocument();
    expect(card.getByText(/due for recalculation/)).toBeInTheDocument();
    expect(card.getByText(/minimum could not be checked/)).toBeInTheDocument();
    expect(card.getByText(/Recalculate the lead.s score/)).toBeInTheDocument();
    expect(card.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(card.getByText(/nothing to approve/)).toBeInTheDocument();
  });

  it('lets a reviewer recalculate, reassess or dismiss it', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, REVIEW], { needs_review: 1 }));
    api.calculateLeadScore.mockResolvedValue({ data: {} });
    api.reassessConversion.mockResolvedValue({ data: { decision_status: 'PENDING_APPROVAL' } });
    renderPage();
    let card = within((within(await openDesk())).getByTestId('review-p-5'));
    fireEvent.click(card.getByRole('button', { name: 'Recalculate score' }));
    await waitFor(() => expect(api.calculateLeadScore).toHaveBeenCalledWith('p-5'));
    card = within(screen.getByTestId('review-p-5'));
    fireEvent.click(card.getByRole('button', { name: /Reassess/ }));
    await waitFor(() => expect(api.reassessConversion).toHaveBeenCalledWith('p-5', expect.objectContaining({
      idempotency_key: expect.any(String) })));
    fireEvent.click(within(screen.getByTestId('review-p-5')).getByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByText('Dismiss review')).toBeInTheDocument();
  });

  it('offers no review actions to someone who may not review', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, REVIEW], { needs_review: 1 }));
    renderPage(USERS.manager);
    const card = within(within(await openDesk()).getByTestId('review-p-5'));
    expect(card.queryByRole('button', { name: /Reassess|Dismiss|Recalculate/ })).not.toBeInTheDocument();
    expect(card.getByRole('button', { name: 'View prospect' })).toBeInTheDocument();
  });

  it('warns on a pending approval whose score is no longer usable, and still offers approval', async () => {
    const warned = { ...PENDING, pending_score_warning: { situation: 'provisional', recommended_action: 'obtain_assessed_conversation' } };
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, warned], { awaiting_approvals: 1 }));
    renderPage();
    const desk = within(await openDesk());
    const warning = desk.getByTestId('score-warning');
    expect(warning).toHaveTextContent('The score used for this proposal is no longer usable.');
    expect(warning).toHaveTextContent('The score is provisional');
    expect(warning).toHaveTextContent('You can still approve it.');
    expect(desk.getByRole('button', { name: /Approve/ })).toBeEnabled();
  });

  it('shows no warning on a pending approval whose score is usable', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, PENDING], { awaiting_approvals: 1 }));
    renderPage();
    expect(within(await openDesk()).queryByTestId('score-warning')).not.toBeInTheDocument();
  });

  it('warns when more decisions are waiting than the loaded list shows', async () => {
    api.getConversionWorkspace.mockResolvedValue(workspace([MAYA, PENDING], { awaiting_approvals: 4 }));
    renderPage();
    expect(within(await openDesk()).getByText(paragraph(/3 more decisions are waiting outside the loaded list/))).toBeInTheDocument();
  });
});

it('shows the decision and its review outcome on the Decisions tab, and approve only on the pending one', async () => {
  api.getConversionWorkspace.mockResolvedValue(workspace([PENDING], { awaiting_approvals: 1 }));
  api.getConversionTimeline.mockResolvedValue({ data: { items: [
    decisionItem,
    { id: 'r-1', type: 'review', title: 'Conversion rejected', occurred_at: '2030-01-05T06:30:00Z', detail: { decision_id: 'd-0', action: 'REJECTED', reason: 'Budget unconfirmed' } },
    { ...decisionItem, id: 'd-0', occurred_at: '2030-01-04T06:30:00Z', detail: { ...decisionItem.detail, decision_status: 'REJECTED' } },
  ] } });
  renderPage();
  fireEvent.click(await screen.findByRole('tab', { name: /Decisions/ }));
  const panel = within(await screen.findByRole('tabpanel'));
  expect(await panel.findByText(/Budget unconfirmed/)).toBeInTheDocument();
  expect(panel.getAllByRole('button', { name: /Approve/ })).toHaveLength(1);
});

it('says when there is no call evidence, and shows Verify only to reviewers', async () => {
  const candidate = {
    evidence_candidate_id: 'e-1', criterion_code: 'BUSINESS_NEED', source_kind: 'INTENT_ASSESSMENT', extraction_confidence: 82,
    verification_status: 'UNVERIFIED', extracted_at: '2030-01-06T06:30:00Z', extracted_value: { business_need_confirmed: true },
  };
  renderPage();
  fireEvent.click(await screen.findByRole('tab', { name: /Call evidence/ }));
  expect(await screen.findByText('No call evidence yet.')).toBeInTheDocument();

  api.getConversionEvidenceCandidates.mockResolvedValue({ data: { items: [candidate] } });
  fireEvent.click(screen.getByRole('button', { name: /Refresh data/ }));
  expect(await screen.findByText('Business Need')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Verify evidence/ })).toBeInTheDocument();
});
