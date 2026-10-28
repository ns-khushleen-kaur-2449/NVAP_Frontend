import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AssistantBuilder, { formFromPayload, toPayload } from './AssistantBuilder';
import * as api from '../../lib/api';

jest.mock('../../lib/api', () => ({
  listBuilderConfigs: jest.fn(),
  getBuilderConfig: jest.fn(),
  createBuilderConfig: jest.fn(),
  updateBuilderConfig: jest.fn(),
  previewBuilderConfig: jest.fn(),
  publishBuilderConfig: jest.fn(),
  rollbackBuilderConfig: jest.fn(),
  retryBuilderConfig: jest.fn(),
  getKnowledgeFiles: jest.fn(),
  getCatalogItems: jest.fn(),
  getLeadFieldRegistry: jest.fn(),
}));
jest.mock('./AgentToolsPanel', () => () => null);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <select>{children}</select>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));

// A version saved before customer details existed (no lead_fields, no policy), as stored.
const LEGACY = {
  assistant: { name: 'Riya', language: 'en', goal: 'book_appointment', tone: 'friendly', sales_approach: 'consultative',
    conversation_length: 'balanced', first_message: 'Hi! This is Riya from Apex Motors. Is now a good time?' },
  business: { company: 'Apex Motors', vertical: 'automobile', locations: ['Solan'], description: null },
  target_customer: 'Families', qualification: ['budget'], custom_instructions: null, knowledge_ids: [],
  rules: { one_question_at_a_time: true, no_unlisted_pricing: true, check_stock_before_confirming: true, transfer_on_request: true },
  voice_stack: { stt: 'deepgram-nova-3', llm: 'groq', tts: '11labs' },
};
const config = (payload) => ({ id: 'c1', name: 'Riya', current_version: 3, published_version: 3, active: true,
  latest: { payload, status: 'published', prompt: 'p', tools: [] } });

// CRA's Jest config resets mocks before each test, so the answers are set here.
beforeEach(() => {
  api.getKnowledgeFiles.mockResolvedValue({ data: [] });
  api.getCatalogItems.mockResolvedValue({ data: { items: [] } });
  api.getLeadFieldRegistry.mockResolvedValue({ data: { usages: [], standard: [], custom: [], unusable: [] } });
  api.previewBuilderConfig.mockResolvedValue({ data: { prompt: 'p', generated_prompt: 'p', first_message: 'Hi!', tools: [] } });
});

it('loads a legacy config untouched: customer details off, nothing to save, null lead_fields sent', async () => {
  api.listBuilderConfigs.mockResolvedValue({ data: [config(LEGACY)] });
  api.getBuilderConfig.mockResolvedValue({ data: config(LEGACY) });
  render(<AssistantBuilder />);
  fireEvent.click(await screen.findByText('Riya'));
  expect(await screen.findByText(/keeps its current opener and call details/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Save new version/ })).toBeDisabled();
  expect(screen.getByLabelText('Custom opening line')).toHaveValue(LEGACY.assistant.first_message);
  expect(screen.queryByRole('button', { name: '+ {agent_name}' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.previewBuilderConfig).toHaveBeenCalled());
  const sent = api.previewBuilderConfig.mock.calls.at(-1)[0];
  expect(sent.lead_fields).toBeNull();
  expect(sent.policy).toBeNull();
  expect(sent.assistant.first_message).toBe(LEGACY.assistant.first_message);
});

it('round-trips a legacy payload and a personalized one', () => {
  expect(toPayload(formFromPayload(LEGACY))).toMatchObject({ lead_fields: null, policy: null,
    assistant: { persona_gender: null, default_call_reason: null, salutation_style: 'first_name' } });
  const personalized = { ...LEGACY, lead_fields: [{ key: 'email', usage: 'confirm_only', mask: 'email_hint', label: null }],
    policy: { opener_mentions_reason: true }, assistant: { ...LEGACY.assistant, persona_gender: 'female' } };
  expect(toPayload(formFromPayload(personalized))).toMatchObject({
    lead_fields: [{ key: 'email', usage: 'confirm_only', mask: 'email_hint', label: null }],
    policy: { opener_mentions_reason: true }, assistant: { persona_gender: 'female' } });
});

it('shows a 422 from preview against the opening line', async () => {
  api.listBuilderConfigs.mockResolvedValue({ data: [] });
  api.previewBuilderConfig.mockRejectedValue({ response: { status: 422, data: { detail: [
    'first_message: unknown placeholder {name}; use {salutation}, {customer_name}, {agent_name}, {company}, {call_reason}'] } } });
  render(<AssistantBuilder />);
  fireEvent.click(await screen.findByRole('button', { name: /Create agent/ }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Riya'), { target: { value: 'Riya' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Apex Motors'), { target: { value: 'Apex Motors' } });
  fireEvent.change(screen.getByPlaceholderText(/Families and first-time/), { target: { value: 'Families' } });
  fireEvent.change(screen.getByLabelText('Custom opening line'), { target: { value: 'Hi {name}' } });
  const opening = screen.getByRole('heading', { name: 'Opening line' }).closest('section');
  await waitFor(() => expect(within(opening).getByRole('alert')).toHaveTextContent('unknown placeholder {name}'), { timeout: 3000 });
  // New agents start with customer details on, greeting by first name.
  expect(api.previewBuilderConfig.mock.calls.at(-1)[0].lead_fields).toEqual([{ key: 'first_name', usage: 'greet', mask: 'none', label: null }]);
});
