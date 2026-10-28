import { fireEvent, render, screen } from '@testing-library/react';
import CampaignPitchCard, { pitchEditState, pitchFrom } from './CampaignPitchCard';
import { updateVoiceCampaign } from '@/lib/api';

jest.mock('@/lib/api', () => ({ updateVoiceCampaign: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const rep = { id: 1, role: 'rep' };
const manager = { id: 2, role: 'manager' };
const admin = { id: 3, role: 'tenant_admin' };
const superAdmin = { id: 4, role: 'super_admin' };
const campaign = (status, extra = {}) => ({ id: 'cmp-1', status, pitch: { call_reason: "I'm calling about the Nexon EV." }, ...extra });

it('gates editing like the calling rules', () => {
  expect(pitchEditState(campaign('draft'), rep)).toEqual({ canEdit: true, needsReason: false, note: null });
  expect(pitchEditState(campaign('scheduled'), manager).canEdit).toBe(true);
  expect(pitchEditState(campaign('processing'), rep)).toMatchObject({ canEdit: false, note: expect.stringMatching(/Tenant Admin or Manager/) });
  expect(pitchEditState(campaign('paused'), manager)).toEqual({ canEdit: true, needsReason: true, note: null });
  expect(pitchEditState(campaign('processing'), admin).needsReason).toBe(true);
  expect(pitchEditState(campaign('completed'), admin).canEdit).toBe(false);
  expect(pitchEditState(campaign('draft'), superAdmin).canEdit).toBe(false);  // reads only
});

it('hides the editor from a Sales Rep while the campaign runs', () => {
  render(<CampaignPitchCard campaign={campaign('processing')} user={rep} />);
  expect(screen.getByText("I'm calling about the Nexon EV.")).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /pitch/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Only a Tenant Admin or Manager/)).toBeInTheDocument();
});

it('asks a Manager for a reason while the campaign runs, then sends it with the pitch', async () => {
  updateVoiceCampaign.mockResolvedValue({ data: {} });
  render(<CampaignPitchCard campaign={campaign('processing')} user={manager} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit pitch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Say why the pitch changes');
  expect(updateVoiceCampaign).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Why change the pitch now/), { target: { value: 'New launch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
  await screen.findByRole('button', { name: 'Edit pitch' });
  expect(updateVoiceCampaign).toHaveBeenCalledWith('cmp-1', expect.objectContaining({
    reason: 'New launch', pitch: expect.objectContaining({ call_reason: "I'm calling about the Nexon EV." }) }));
});

it('lets a draft be edited without a reason, and shows the objective/goal note', () => {
  render(<CampaignPitchCard campaign={campaign('draft', { pitch_warnings: ["This campaign's objective (site_visit) fits..."] })} user={rep} />);
  expect(screen.getByRole('status')).toHaveTextContent('objective (site_visit)');
  fireEvent.click(screen.getByRole('button', { name: 'Edit pitch' }));
  expect(screen.queryByLabelText(/Why change the pitch now/)).not.toBeInTheDocument();
});

it('builds the pitch from the form and keeps settings it does not edit', () => {
  const pitch = pitchFrom({
    objective: 'demo', objective_text: 'x', success_definition: '', call_reason: ' Hi ', offering_name: 'EV',
    offering_one_liner: '', audience: '', offer_text: '', cta: 'book a demo', benefits: 'Fast\n\nQuiet\n', proof_points: '',
    discovery_questions: '', project_name: '', project_location: '', project_one_liner: '', project_highlights: '',
    project_possession: '', objections: [{ objection: 'Pricey', response: 'Finance options' }, { objection: '', response: '' }],
  }, { max_objection_attempts: 1, cta_confirm: ['time'] });
  expect(pitch).toMatchObject({ objective: 'demo', objective_text: null, call_reason: 'Hi', benefits: ['Fast', 'Quiet'],
    project: null, objections: [{ objection: 'Pricey', response: 'Finance options' }], max_objection_attempts: 1, cta_confirm: ['time'] });
});
