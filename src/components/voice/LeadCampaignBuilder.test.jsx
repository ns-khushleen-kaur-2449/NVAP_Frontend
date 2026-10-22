import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { checkCampaignSchedule, createVoiceCampaign } from '@/lib/api';
import LeadCampaignBuilder from './LeadCampaignBuilder';

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
