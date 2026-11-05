import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createVoiceCampaign, previewCampaignOffer } from '@/lib/api';
import CampaignLaunchDialog from './CampaignLaunchDialog';

jest.mock('@/lib/api', () => ({
  checkCampaignSchedule: jest.fn().mockResolvedValue({ data: {} }),
  createVoiceCampaign: jest.fn(),
  previewCampaignOffer: jest.fn().mockResolvedValue({ data: { offer_name: 'Creta SX', offer: '₹50,000 off',
    valid_until_spoken: 'Thursday, January thirty-first', expired: false, sample_line: 'By the way…', missing: [],
    assistant_warning: null, direction: 'ltr' } }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn(), warning: jest.fn() } }));

// Radix Select does not open in jsdom; a native select shows which assistants are offered.
jest.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <select aria-label="assistant options">{children}</select>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));

it('leaves out a local-only assistant that has no Vapi id', () => {
  const assistants = [
    { id: 1, name: 'Local Demo Assistant', vapi_assistant_id: null, is_live: false },
    { id: 2, name: 'Riya', vapi_assistant_id: 'asst-1', is_live: true },
  ];
  render(<CampaignLaunchDialog open onOpenChange={() => {}} source={{ type: 'leads', prospectIds: ['p-1'] }}
    assistants={assistants} />);
  const options = screen.getAllByRole('option').map((o) => o.textContent);
  expect(options).toContain('Riya');
  expect(options).not.toContain('Local Demo Assistant');
});

describe('the campaign offer', () => {
  const ASSISTANTS = [{ id: 2, name: 'Riya', vapi_assistant_id: 'asst-1', is_live: true }];
  const open = () => render(<CampaignLaunchDialog open onOpenChange={() => {}} source={{ type: 'leads', prospectIds: ['p-1'] }}
    assistants={ASSISTANTS} />);
  const fillDetails = () => {
    fireEvent.change(screen.getByPlaceholderText(/october site-visit/i), { target: { value: 'Q1 internal push' } });
    fireEvent.change(screen.getByPlaceholderText(/invite leads/i), { target: { value: 'Offer calls' } });
  };

  it('sits below the campaign details and sends one source of truth', async () => {
    createVoiceCampaign.mockResolvedValue({ data: { id: 'c-1', total_leads: 1 } });
    open();
    fillDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Tell leads about this campaign' }));
    fireEvent.change(screen.getByLabelText('Offer name'), { target: { value: 'Creta SX' } });
    fireEvent.change(screen.getByLabelText('Offer details'), { target: { value: '₹50,000 off' } });
    fireEvent.change(screen.getByLabelText('Offer valid until'), { target: { value: '2030-01-31' } });
    expect(await screen.findByText('What the agent will tell leads')).toBeInTheDocument();
    await waitFor(() => expect(previewCampaignOffer).toHaveBeenCalledWith(expect.objectContaining({ assistant_id: 'asst-1' })));
    fireEvent.click(screen.getByRole('button', { name: 'Start campaign' }));
    await waitFor(() => expect(createVoiceCampaign).toHaveBeenCalled());
    expect(createVoiceCampaign.mock.calls[0][0]).toMatchObject({
      announce_to_leads: true, offer_valid_until: '2030-01-31', pitch: { offering_name: 'Creta SX', offer_text: '₹50,000 off' } });
  });

  it('asks for the offer before starting with the toggle on', async () => {
    open();
    fillDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Tell leads about this campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start campaign' }));
    expect(await screen.findByText(/fill in the offer name and offer details, or turn it off/)).toBeInTheDocument();
    expect(createVoiceCampaign).not.toHaveBeenCalled();
  });

  it('lists every pre-flight problem when the start is refused', async () => {
    createVoiceCampaign.mockRejectedValue({ response: { status: 409, data: { detail:
      "Can't start this campaign:\nRiya was published before campaign offers existed. Publish it again.\nSet the last day the offer is valid before starting." } } });
    open();
    fillDetails();
    fireEvent.click(screen.getByRole('switch', { name: 'Tell leads about this campaign' }));
    fireEvent.change(screen.getByLabelText('Offer name'), { target: { value: 'Creta SX' } });
    fireEvent.change(screen.getByLabelText('Offer details'), { target: { value: '₹50,000 off' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start campaign' }));
    expect(await screen.findByText("Can't start this campaign.")).toBeInTheDocument();
    expect(screen.getByText(/Publish it again/)).toBeInTheDocument();
    expect(screen.getByText(/Set the last day the offer is valid/)).toBeInTheDocument();
  });

  it('explains an amount typed outside the offer details', async () => {
    createVoiceCampaign.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'pitch', 'offering_name'], msg: 'Value error, must not contain a price; prices come only from tools' }] } } });
    open();
    fillDetails();
    fireEvent.change(screen.getByLabelText('Offer name'), { target: { value: 'Creta at ₹9 lakh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start campaign' }));
    expect(await screen.findByText("Offer name can't include a price or amount. Put amounts only in Offer details."))
      .toBeInTheDocument();
  });
});
