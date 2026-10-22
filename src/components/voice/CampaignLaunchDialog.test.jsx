import { render, screen } from '@testing-library/react';
import CampaignLaunchDialog from './CampaignLaunchDialog';

jest.mock('@/lib/api', () => ({
  checkCampaignSchedule: jest.fn().mockResolvedValue({ data: {} }),
  createVoiceCampaign: jest.fn(),
}));

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
