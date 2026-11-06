import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { checkCampaignSchedule, createVoiceCampaign } from '@/lib/api';
import LeadCampaignBuilder, { compareAdded } from './LeadCampaignBuilder';

jest.mock('@/lib/api', () => ({
  checkCampaignSchedule: jest.fn(),
  createVoiceCampaign: jest.fn(),
  createProspect: jest.fn(),
}));

// The picker has its own tests; here it stands in for "the user picked these prospects".
jest.mock('./AiFilterPickerDialog', () => ({
  __esModule: true,
  default: ({ open, onConfirm }) => (open ? <button type="button" onClick={() => onConfirm(['p-1', 'p-2'])}>Pick two</button> : null),
}));

// Lead names link to /leads, so the builder renders inside a router.
const render = (ui) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const ASSISTANTS = [{ vapi_assistant_id: 'asst-1', name: 'Riya' }];
const LEADS = [{ id: 'table-lead', name: 'Table Lead', phone: '+919800000009', created_at: '2026-10-01T00:00:00Z' }];

beforeEach(() => {
  jest.clearAllMocks();
  checkCampaignSchedule.mockResolvedValue({ data: {} });
  createVoiceCampaign.mockResolvedValue({ data: { id: 'c-1', total_leads: 2, skipped_contacts: 0 } });
});

const fillAndStart = async () => {
  fireEvent.change(screen.getByPlaceholderText(/october site-visit/i), { target: { value: 'AI picks' } });
  fireEvent.change(screen.getByPlaceholderText(/invite leads/i), { target: { value: 'Call the AI Filtering picks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start campaign' }));
  await waitFor(() => expect(createVoiceCampaign).toHaveBeenCalledTimes(1));
  return createVoiceCampaign.mock.calls[0][0];
};

it('launches a campaign with the prospects imported from AI Filtering', async () => {
  const onCampaignStarted = jest.fn();
  render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} onCampaignStarted={onCampaignStarted} />);
  fireEvent.click(screen.getByRole('button', { name: /import from ai filtering/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Pick two' }));

  expect(await screen.findByText('2 selected leads')).toBeInTheDocument();
  const body = await fillAndStart();
  expect(body.prospect_ids).toEqual(['p-1', 'p-2']);
  expect(body).not.toHaveProperty('contacts');
  expect(body.assistant_id).toBe('asst-1');
  await waitFor(() => expect(onCampaignStarted).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1' })));
});

it('disables importing and launching for a role that may not create campaigns', () => {
  render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} canCreateCampaigns={false} />);
  expect(screen.getByRole('button', { name: /import from ai filtering/i })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  expect(screen.getByRole('button', { name: /launch campaign for 1 lead/i })).toBeDisabled();
  expect(screen.getByText('Campaigns are created by Tenant Admins, Managers and Sales Reps.')).toBeInTheDocument();
});

it('still launches the leads ticked in the table when nothing is imported', async () => {
  render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} />);
  fireEvent.click(screen.getAllByRole('checkbox')[1]); // the table row (index 0 is "select all")
  fireEvent.click(screen.getByRole('button', { name: /launch campaign for 1 lead/i }));
  const body = await fillAndStart();
  expect(body.prospect_ids).toEqual(['table-lead']);
});

it('links each lead name to its page on /leads', () => {
  render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} onCampaignStarted={jest.fn()} />);
  expect(screen.getByRole('link', { name: 'Table Lead' })).toHaveAttribute('href', '/leads?prospect=table-lead');
});

it('builds its filters from the leads and shows their real details, not placeholders', () => {
  const custom = (fuel, model) => ({ fuel_preference: fuel, interested_in: model });
  const leads = [
    { id: 'a', name: 'Asha', stage: 'new', city: 'Mohali', created_at: '2026-10-01T00:00:00Z', custom_fields: custom('electric', 'Nexon EV') },
    { id: 'b', name: 'Bal', stage: 'engaged', city: 'Chandigarh', created_at: '2026-10-02T00:00:00Z', custom_fields: custom('diesel', 'XUV700') },
  ];
  render(<LeadCampaignBuilder leads={leads} assistants={ASSISTANTS} />);
  expect(screen.getByText('Interested in')).toBeInTheDocument();
  expect(screen.getByText('Nexon EV')).toBeInTheDocument();
  expect(screen.queryByText('Signature')).not.toBeInTheDocument();
  // Quick filters come from the data; the old real-estate ones are gone.
  expect(screen.getByRole('combobox', { name: 'Quick filter: Stage' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Quick filter: City' })).toBeInTheDocument();
  expect(screen.queryByText(/All Projects|All Categories/)).not.toBeInTheDocument();
});

describe('prospects handed over from Prospecting', () => {
  const PICKED = [
    { id: 'p-7', name: 'Asha Rao', phone: '+919800000007', created_at: '2026-11-01T00:00:00Z' },
    { id: 'p-8', name: 'Ravi Kumar', phone: '+919800000008' },
  ];

  it('lists them in the table, ticked, and launches with exactly those ids', async () => {
    const onDone = jest.fn();
    render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} fromProspecting={PICKED} onFromProspectingDone={onDone} />);
    expect(screen.getByText('2 prospects added from Prospecting')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    expect(screen.getAllByText('From Prospecting')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /launch campaign for 2 leads/i }));
    const body = await fillAndStart();
    expect(body.prospect_ids).toEqual(['p-7', 'p-8']);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['p-7', 'p-8']));
  });

  it('keeps picked prospects that were unticked when the others are launched', async () => {
    const onDone = jest.fn();
    render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} fromProspecting={PICKED} onFromProspectingDone={onDone} />);
    // Rows newest first: Asha Rao (p-7), Table Lead, Ravi Kumar (p-8, no date); [0] is "select all".
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /launch campaign for 1 lead/i }));
    const body = await fillAndStart();
    expect(body.prospect_ids).toEqual(['p-8']);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['p-8']));
  });

  it('can be removed again', () => {
    const onDone = jest.fn();
    render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} fromProspecting={PICKED} onFromProspectingDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove them' }));
    expect(onDone).toHaveBeenCalledWith(['p-7', 'p-8']);
    expect(screen.getByRole('button', { name: /launch campaign for 0 leads/i })).toBeDisabled();
  });

  it('does not list a prospect twice when it is already a lead', () => {
    render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} fromProspecting={[{ id: 'table-lead', name: 'Table Lead' }]} />);
    expect(screen.getAllByText('Table Lead')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /launch campaign for 1 lead/i })).toBeEnabled();
  });
});

describe('sorting by date added', () => {
  const rows = [
    { id: 'old', name: 'Old', created_at: '2026-01-01T00:00:00Z' },
    { id: 'none', name: 'No date' },
    { id: 'new', name: 'New', created_at: '2026-11-01T00:00:00Z' },
    { id: 'bad', name: 'Bad date', created_at: 'not a date' },
    { id: 'mid', name: 'Mid', created_at: '2026-06-01T00:00:00Z' },
  ];

  it('puts the newest first and leads without a date last', () => {
    expect([...rows].sort((a, b) => compareAdded(a, b, -1)).map((r) => r.id)).toEqual(['new', 'mid', 'old', 'bad', 'none']);
  });

  it('puts the oldest first and leads without a date last', () => {
    expect([...rows].sort((a, b) => compareAdded(a, b, 1)).map((r) => r.id)).toEqual(['old', 'mid', 'new', 'bad', 'none']);
  });

  it('orders the table newest first by default, picked prospects included', () => {
    const picked = [{ id: 'p-new', name: 'Picked New', phone: '+919800000001', created_at: '2026-11-04T00:00:00Z' },
      { id: 'p-old', name: 'Picked Old', phone: '+919800000002', created_at: '2025-01-01T00:00:00Z' }];
    render(<LeadCampaignBuilder leads={LEADS} assistants={ASSISTANTS} fromProspecting={picked} />);
    const names = screen.getAllByTitle('Open this lead').map((link) => link.textContent);
    expect(names).toEqual(['Picked New', 'Table Lead', 'Picked Old']);
  });
});
