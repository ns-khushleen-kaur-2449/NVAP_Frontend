import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  approveAssistantChangeRequest, getAssistant, getAssistantChangeRequest, getAssistants, listAssistantChangeRequests,
  rejectAssistantChangeRequest, submitAssistantChangeRequest,
} from '@/lib/api';
import AssistantChangeRequests from './AssistantChangeRequests';

jest.mock('@/lib/api', () => ({
  getAssistants: jest.fn(),
  getAssistant: jest.fn(),
  listAssistantChangeRequests: jest.fn(),
  getAssistantChangeRequest: jest.fn(),
  submitAssistantChangeRequest: jest.fn(),
  approveAssistantChangeRequest: jest.fn(),
  rejectAssistantChangeRequest: jest.fn(),
  withdrawAssistantChangeRequest: jest.fn(),
}));

// Radix Select does not open in jsdom; a native select stands in for it.
jest.mock('@/components/ui/select', () => {
  const React = require('react');
  const Ctx = React.createContext({});
  return {
    Select: ({ value, onValueChange, children }) => <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>,
    SelectTrigger: ({ children, ...props }) => <div data-trigger={props['aria-label']}>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }) => {
      const { value, onValueChange } = React.useContext(Ctx);
      return <select aria-label="choose" value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="">—</option>{children}</select>;
    },
    SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
  };
});

const REP = { id: 3, role: 'rep' };
const MANAGER = { id: 2, role: 'manager' };
const ASSISTANT = { id: 7, name: 'Riya', firstMessage: 'Hello!', systemPrompt: 'Be brief.', modelTemperature: 0.7,
  maxDurationSeconds: 600, vapi_assistant_id: 'asst-1', isLive: true };
const REQUEST = {
  id: 12, assistant_id: 7, assistant_name: 'Riya', requested_by: 3, requested_by_name: 'Raj', reviewer_user_id: 2,
  reviewer_name: 'Mira', routed_to: 'manager', proposed_changes: { first_message: 'Hi, is now a good time?' },
  base_values: { first_message: 'Hello!' }, current_values: { first_message: 'Hello!' }, stale_fields: [],
  reason: 'Leads ask about the price first', status: 'pending', review_feedback: null, created_at: '2026-10-22T05:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  getAssistants.mockResolvedValue({ data: [ASSISTANT] });
  getAssistant.mockResolvedValue({ data: ASSISTANT });
  listAssistantChangeRequests.mockResolvedValue({ data: { requests: [REQUEST] } });
  getAssistantChangeRequest.mockResolvedValue({ data: REQUEST });
  submitAssistantChangeRequest.mockResolvedValue({ data: REQUEST });
});

const chooseAssistant = async () => {
  await screen.findByText('Published assistants');
  const pickers = await screen.findAllByLabelText('choose');
  fireEvent.change(pickers[0], { target: { value: '7' } });
  await screen.findByText('Be brief.');
};

describe('Sales Rep', () => {
  it('shows a published assistant read-only and sends only the changed fields with a reason', async () => {
    render(<AssistantChangeRequests user={REP} />);
    await chooseAssistant();
    // Read-only first: no inputs until the Rep chooses to propose.
    expect(screen.queryByLabelText('First message')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Propose a change' }));
    fireEvent.change(screen.getByLabelText(/^First message/), { target: { value: 'Hi, is now a good time?' } });
    const send = screen.getByRole('button', { name: /send for review/i });
    expect(send).toBeDisabled(); // no reason yet
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Leads ask about the price first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send for review (1)' }));
    await waitFor(() => expect(submitAssistantChangeRequest).toHaveBeenCalledWith(
      7, { firstMessage: 'Hi, is now a good time?' }, 'Leads ask about the price first'));
  });

  it('lists their requests with status and feedback, and offers no review actions', async () => {
    getAssistantChangeRequest.mockResolvedValue({ data: { ...REQUEST, status: 'rejected', review_feedback: 'Keep it short',
      reviewed_by_name: 'Mira' } });
    render(<AssistantChangeRequests user={REP} />);
    expect(await screen.findByText('My requests')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Open request for Riya' }));
    expect(await screen.findByText('Keep it short')).toBeInTheDocument();
    expect(screen.getByText(/from Mira/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
});

describe('Manager', () => {
  it('compares current and proposed values and approves', async () => {
    approveAssistantChangeRequest.mockResolvedValue({ data: { ...REQUEST, status: 'applied' } });
    render(<AssistantChangeRequests user={MANAGER} />);
    expect(screen.queryByText('Published assistants')).not.toBeInTheDocument();
    await waitFor(() => expect(listAssistantChangeRequests).toHaveBeenCalledWith({ status: 'pending' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open request for Riya' }));
    expect(await screen.findByText('Hi, is now a good time?')).toBeInTheDocument();
    expect(screen.getAllByText('Hello!').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Approve and apply' }));
    await waitFor(() => expect(approveAssistantChangeRequest).toHaveBeenCalledWith(12, ''));
  });

  it('needs feedback to reject', async () => {
    rejectAssistantChangeRequest.mockResolvedValue({ data: { ...REQUEST, status: 'rejected', review_feedback: 'Too long' } });
    render(<AssistantChangeRequests user={MANAGER} openRequestId="12" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    expect(rejectAssistantChangeRequest).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Feedback for the Sales Rep'), { target: { value: 'Too long' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(rejectAssistantChangeRequest).toHaveBeenCalledWith('12', 'Too long'));
  });

  it('blocks approval when the assistant changed after the request', async () => {
    getAssistantChangeRequest.mockResolvedValue({ data: { ...REQUEST, current_values: { first_message: 'Admin edit' },
      stale_fields: ['first_message'] } });
    render(<AssistantChangeRequests user={MANAGER} openRequestId="12" />);
    expect(await screen.findByText(/changed after this request was made/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and apply' })).toBeDisabled();
    expect(screen.getByText('Changed since request')).toBeInTheDocument();
  });
});

it('shows nothing to a Super Admin', () => {
  render(<AssistantChangeRequests user={{ id: 1, role: 'super_admin' }} />);
  expect(screen.getByText('Not available')).toBeInTheDocument();
  expect(listAssistantChangeRequests).not.toHaveBeenCalled();
});
