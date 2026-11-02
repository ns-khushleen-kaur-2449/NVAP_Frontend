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

it('shows the stage counts only when the whole list is loaded', async () => {
  renderPage();
  const pipeline = await screen.findByRole('navigation', { name: 'Prospects by stage' });
  expect(within(pipeline).getByRole('button', { name: /Qualified\s*1/ })).toBeInTheDocument();
  api.getConversionWorkspace.mockResolvedValue({ data: { ...workspace([MAYA]).data, total: 200 } });
  fireEvent.change(screen.getByLabelText('Search prospects'), { target: { value: 'ma' } });
  await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Prospects by stage' })).not.toBeInTheDocument());
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
