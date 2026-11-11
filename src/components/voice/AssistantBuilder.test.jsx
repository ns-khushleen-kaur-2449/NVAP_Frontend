import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AssistantBuilder, {
  formFromPayload, industryName, industryValue, presetMismatch, qualificationSuggestions, toPayload, unusedAfterSwitch,
} from './AssistantBuilder';
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
  getAssistants: jest.fn(),
  getCatalogItems: jest.fn(),
  getCatalogTable: jest.fn(),
  getCatalogSettings: jest.fn(),
  getLeadFieldRegistry: jest.fn(),
  getBuilderLanguages: jest.fn(),
}));
jest.mock('./AgentToolsPanel', () => () => null);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
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
// What GET /assistant-builder/languages answers a test tenant: approved en and hi, a draft Arabic pack.
const voice = (ready, needs = false) => (needs
  ? { needs_persona_gender: true, ready: false, voices: { female: { ready: true, problem: null },
    male: { ready: false, problem: 'no voice is configured for Arabic (male): add "ar-male" to VAPI_BUILDER_VOICES' } } }
  : { needs_persona_gender: false, ready, voices: { neutral: { ready, problem: ready ? null : 'VAPI_BUILDER_VOICE_ID missing' } } });
const LANGUAGES_API = [
  { code: 'en', version: 1, status: 'approved', name: 'English', native_name: 'English', direction: 'ltr', voice: voice(true) },
  { code: 'hi', version: 1, status: 'approved', name: 'Hindi', native_name: 'हिन्दी', direction: 'ltr', voice: voice(true) },
  { code: 'ar', version: 1, status: 'draft', name: 'Arabic', native_name: 'العربية', direction: 'rtl', voice: voice(false, true) },
];
const config = (payload) => ({ id: 'c1', name: 'Riya', current_version: 3, published_version: 3, active: true,
  latest: { payload, status: 'published', prompt: 'p', tools: [] } });

// CRA's Jest config resets mocks before each test, so the answers are set here.
beforeEach(() => {
  api.listBuilderConfigs.mockResolvedValue({ data: [] });
  api.getAssistants.mockResolvedValue({ data: [] });
  api.getKnowledgeFiles.mockResolvedValue({ data: [] });
  api.getCatalogItems.mockResolvedValue({ data: { items: [] } });
  api.getCatalogTable.mockResolvedValue({ data: { columns: [] } });
  api.getCatalogSettings.mockResolvedValue({ data: { preset: null } });
  api.getLeadFieldRegistry.mockResolvedValue({ data: { usages: [], standard: [], custom: [], unusable: [] } });
  api.previewBuilderConfig.mockResolvedValue({ data: { prompt: 'p', generated_prompt: 'p', first_message: 'Hi!', tools: [] } });
  api.getBuilderLanguages.mockResolvedValue({ data: LANGUAGES_API });
});

it('shows admin-assigned agents in the tenant list without edit actions', async () => {
  api.getAssistants.mockResolvedValue({ data: [{
    id: 77, name: 'Imported Riya', vapi_assistant_id: 'vapi-assigned-77', status: 'imported', is_live: true,
  }] });
  render(<AssistantBuilder />);
  expect(await screen.findByRole('heading', { name: 'Assigned agents' })).toBeInTheDocument();
  const card = await screen.findByRole('button', { name: /Imported Riya assigned by admin/ });
  expect(card).toHaveTextContent('Contact your admin for changes');
  expect(within(card).queryByText('Edit')).not.toBeInTheDocument();
  fireEvent.click(card);
  expect(require('sonner').toast.info).toHaveBeenCalledWith('Assigned to you by the admin', {
    description: 'Contact your admin for changes to this agent.',
  });
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
  fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'Automobile dealership' } });  // required
  fireEvent.change(screen.getByPlaceholderText(/Families and first-time/), { target: { value: 'Families' } });
  fireEvent.change(screen.getByLabelText('Custom opening line'), { target: { value: 'Hi {name}' } });
  const opening = screen.getByRole('heading', { name: 'Opening line' }).closest('section');
  await waitFor(() => expect(within(opening).getByRole('alert')).toHaveTextContent('unknown placeholder {name}'), { timeout: 3000 });
  // New agents start with customer details on, greeting by first name.
  expect(api.previewBuilderConfig.mock.calls.at(-1)[0].lead_fields).toEqual([{ key: 'first_name', usage: 'greet', mask: 'none', label: null }]);
});

it('takes any industry as typed, keeping the preset keys older versions use', () => {
  expect([industryValue('Textile'), industryValue('  Real estate'), industryValue('automobile dealership')])
    .toEqual(['Textile', 'real_estate', 'automobile']);
  // A case-insensitive match on a key or its name, trimmed, is the key, as picking the suggestion would be.
  expect(['AUTOMOBILE', ' automobile ', 'Automobile Dealership ', 'REAL_ESTATE', 'real estate'].map(industryValue))
    .toEqual(['automobile', 'automobile', 'automobile', 'real_estate', 'real_estate']);
  expect([industryName('automobile'), industryName('real_estate'), industryName('Textile')])
    .toEqual(['Automobile dealership', 'Real estate', 'Textile']);
  expect(toPayload(formFromPayload({ ...LEGACY, business: { ...LEGACY.business, vertical: ' Insurance ' } })).business.vertical)
    .toBe('Insurance');
});

it('shows a saved industry by name and sends a typed one', async () => {
  api.listBuilderConfigs.mockResolvedValue({ data: [config(LEGACY)] });
  api.getBuilderConfig.mockResolvedValue({ data: config(LEGACY) });
  render(<AssistantBuilder />);
  fireEvent.click(await screen.findByText('Riya'));
  const industry = await screen.findByLabelText('Industry');
  expect(industry).toHaveValue('Automobile dealership');
  fireEvent.change(industry, { target: { value: 'Textile' } });
  await waitFor(() => expect(api.previewBuilderConfig.mock.calls.at(-1)[0].business.vertical).toBe('Textile'));
  // An empty industry is missing: no preview is asked for with it.
  fireEvent.change(industry, { target: { value: '' } });
  await new Promise((resolve) => setTimeout(resolve, 800));
  expect(api.previewBuilderConfig.mock.calls.every(([sent]) => sent.business.vertical.trim())).toBe(true);
});

// The Catalog table's columns as GET /api/v1/catalog/table returns them (the fields that matter here).
const CAR_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'seats', label: 'Seats', ask_lead: false, position: 0 },
  { key: 'fuel_type', label: 'Fuel type', ask_lead: true, ask_order: 2, position: 1, labels: { hi: 'ईंधन' } },
  { key: 'transmission', label: 'Transmission', ask_lead: true, ask_order: 3, position: 2 },
  { key: 'body_type', label: 'Body type', ask_lead: true, ask_order: 1, position: 3 },
  { key: 'mileage', label: 'Mileage', ask_lead: false, position: 5 },
];
const RAYMOND_COLUMNS = [
  { key: 'colour', label: 'Colour', ask_lead: true, ask_order: null, position: 4 },
  { key: 'brand', label: 'Brand', ask_lead: false, position: 8 },
];

describe('What to qualify suggestions come from the catalog', () => {
  it('a car tenant gets its asked fields in order, then the generic ones', () => {
    expect(qualificationSuggestions(CAR_COLUMNS, 'en'))
      .toEqual(['body type', 'fuel type', 'transmission', 'budget', 'timeline', 'decision maker']);
    expect(qualificationSuggestions(CAR_COLUMNS, 'hi')[1]).toBe('ईंधन');  // the assistant's language
    expect(qualificationSuggestions(CAR_COLUMNS, 'ar')[1]).toBe('fuel type');  // else English
  });

  it('a Raymond-shape tenant gets its colour', () => {
    expect(qualificationSuggestions(RAYMOND_COLUMNS, 'en')).toEqual(['colour', 'budget', 'timeline', 'decision maker']);
  });

  it('a tenant with no fields gets the generic ones only, without repeats', () => {
    expect(qualificationSuggestions([], 'en')).toEqual(['budget', 'timeline', 'decision maker']);
    expect(qualificationSuggestions([{ key: 'budget', label: 'Budget', ask_lead: true }], 'en'))
      .toEqual(['budget', 'timeline', 'decision maker']);
  });

  it('the builder offers them from the tenant catalog', async () => {
    api.getCatalogTable.mockResolvedValue({ data: { columns: RAYMOND_COLUMNS } });
    api.listBuilderConfigs.mockResolvedValue({ data: [config(LEGACY)] });
    api.getBuilderConfig.mockResolvedValue({ data: config(LEGACY) });
    render(<AssistantBuilder />);
    fireEvent.click(await screen.findByText('Riya'));
    await waitFor(() => expect(api.getCatalogTable).toHaveBeenCalledWith({ rows: false }));  // fields, no products
    expect(await screen.findByRole('button', { name: /colour/ })).toBeInTheDocument();
  });
});

describe('the preset note', () => {
  it('appears only when the typed industry is not the catalog preset', () => {
    expect(presetMismatch('automobile', 'Textile'))
      .toBe("Your catalog uses the Automobile dealership setup; the agent's questions and words come from there.");
    expect(presetMismatch('automobile', 'automobile')).toBeNull();
    expect(presetMismatch('automobile', 'Automobile Dealership')).toBeNull();
    expect(presetMismatch(null, 'Textile')).toBeNull();  // no preset applied
    expect(presetMismatch('automobile', '')).toBeNull();
  });

  it('shows on the page without blocking anything', async () => {
    api.getCatalogSettings.mockResolvedValue({ data: { preset: 'real_estate' } });
    api.listBuilderConfigs.mockResolvedValue({ data: [config(LEGACY)] });
    api.getBuilderConfig.mockResolvedValue({ data: config(LEGACY) });
    render(<AssistantBuilder />);
    fireEvent.click(await screen.findByText('Riya'));
    expect(await screen.findByRole('note')).toHaveTextContent('Your catalog uses the Real estate setup');
    fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'real estate' } });
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
  });
});


describe('languages from the server', () => {
  const openNew = async () => {
    api.listBuilderConfigs.mockResolvedValue({ data: [] });
    render(<AssistantBuilder />);
    fireEvent.click(await screen.findByRole('button', { name: /Create agent/ }));
    await waitFor(() => expect(api.getBuilderLanguages).toHaveBeenCalled());
  };

  it('lists exactly what the API returns, drafts marked, and a stored language it no longer offers', async () => {
    await openNew();
    const select = (await screen.findAllByRole('combobox')).find((el) => within(el).queryByText(/العربية/));
    expect(within(select).getByText('English')).toBeInTheDocument();
    expect(within(select).getByText('Arabic · العربية (draft)')).toBeInTheDocument();
    expect(within(select).queryByText(/French/)).toBeNull();
  });

  it('writes an Arabic opener right to left, asks for the gender and says whether a voice is ready', async () => {
    const arabic = { ...LEGACY, assistant: { ...LEGACY.assistant, language: 'ar', persona_gender: 'female',
      first_message: '{agent_name} معكم من Apex Motors، عندكم دقيقتين؟' } };
    api.listBuilderConfigs.mockResolvedValue({ data: [config(arabic)] });
    api.getBuilderConfig.mockResolvedValue({ data: config(arabic) });
    api.previewBuilderConfig.mockResolvedValue({ data: { prompt: 'p', generated_prompt: 'p', tools: [],
      first_message: 'Riya معكم من Apex Motors، عندكم دقيقتين؟' } });
    render(<AssistantBuilder />);
    fireEvent.click(await screen.findByText('Riya'));
    const box = await screen.findByLabelText('Custom opening line');
    await waitFor(() => expect(box).toHaveAttribute('dir', 'rtl'));  // explicit: "auto" would read {agent_name} as ltr
    expect(screen.getByText(/Awaiting native review/)).toBeInTheDocument();
    expect(screen.getByText(/Required for Arabic/)).toBeInTheDocument();
    expect(screen.getByTestId('voice-status')).toHaveTextContent('Voice ready');  // the female Arabic voice is set
    const matches = await screen.findAllByText(/Riya معكم من Apex Motors/, {}, { timeout: 3000 });
    const card = matches[0].closest('p');  // the preview card's line (the build may wrap the text in a span)
    expect(card).toHaveAttribute('dir', 'rtl');  // mixed Arabic and Latin, read right to left
  });

  it('shows each refusal where it belongs: the language, the gender and the missing catalog words', async () => {
    api.previewBuilderConfig.mockRejectedValue({ response: { status: 422, data: { detail: [
      "assistant.language: 'hinglish' is not a language this builder speaks; pick one of English (en), Hindi (hi). The published agent keeps working as it is until you save.",
      'assistant.persona_gender: Arabic needs the agent\'s gender (its verbs follow it)',
      'catalog words: the agent says or reads label, field:fuel_type, demo_label, which have no Arabic text; add them in Catalog settings (words, demo label, field labels), or write your own opening line',
    ] } } });
    const legacy = { ...LEGACY, assistant: { ...LEGACY.assistant, language: 'hinglish' } };
    api.listBuilderConfigs.mockResolvedValue({ data: [config(legacy)] });
    api.getBuilderConfig.mockResolvedValue({ data: config(legacy) });
    render(<AssistantBuilder />);
    fireEvent.click(await screen.findByText('Riya'));
    // Under the language field and in the preview panel.
    expect((await screen.findAllByText(/'hinglish' is not a language this builder speaks/, {}, { timeout: 3000 })).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText('hinglish (not available: pick a language)').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs the agent's gender/).length).toBeGreaterThan(0);
    const notice = screen.getAllByText('Add these words in Arabic first')[0].closest('[role="alert"]');
    expect(within(notice).getByText('fuel_type')).toBeInTheDocument();
    expect(within(notice).getByText(/Catalog → field ⋯ → Field settings/)).toBeInTheDocument();
    expect(within(notice).getByText('demo label')).toBeInTheDocument();
  });
});


it('a Hindi or English agent needs no gender and keeps its "not set" choice', async () => {
  api.listBuilderConfigs.mockResolvedValue({ data: [config(LEGACY)] });
  api.getBuilderConfig.mockResolvedValue({ data: config(LEGACY) });
  render(<AssistantBuilder />);
  fireEvent.click(await screen.findByText('Riya'));
  await waitFor(() => expect(screen.getByTestId('voice-status')).toHaveTextContent('Voice ready'));
  expect(screen.getByText(/Match the voice/)).toBeInTheDocument();
  expect(screen.getAllByText('Not set (neutral)').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Custom opening line')).toHaveAttribute('dir', 'ltr');
});

describe('custom prompt mode', () => {
  const { AuthContext } = require('../../lib/AuthContext');
  const asRole = (role) => render(
    <AuthContext.Provider value={{ user: { role } }}><AssistantBuilder /></AuthContext.Provider>);
  const CUSTOM = { ...LEGACY, prompt_mode: 'custom', custom_system_prompt: 'Ask about their last service.',
    custom_first_message: 'Hi, Riya from Apex here. Got a minute?' };
  const open = async (role, payload) => {
    api.listBuilderConfigs.mockResolvedValue({ data: [config(payload)] });
    api.getBuilderConfig.mockResolvedValue({ data: config(payload) });
    asRole(role);
    fireEvent.click(await screen.findByText('Riya'));
    await screen.findByRole('heading', { name: 'Prompt mode' });
  };

  it('round-trips the mode and both custom texts; older payloads load as guided', () => {
    expect(toPayload(formFromPayload(LEGACY))).toMatchObject({ prompt_mode: 'guided', custom_system_prompt: null,
      custom_first_message: null, prompt_override_reason: null });
    expect(toPayload(formFromPayload(CUSTOM))).toMatchObject({ prompt_mode: 'custom',
      custom_system_prompt: CUSTOM.custom_system_prompt, custom_first_message: CUSTOM.custom_first_message });
  });

  it('lists what stops being used before switching', () => {
    expect(unusedAfterSwitch(formFromPayload(LEGACY), 'custom')).toEqual(['the opening line', 'what to qualify']);
    expect(unusedAfterSwitch(formFromPayload(CUSTOM), 'guided')).toEqual(['your instructions', 'your opening line']);
  });

  it('a Tenant Admin edits the custom prompt and opener; guided-only sections are hidden', async () => {
    await open('tenant_admin', CUSTOM);
    expect(screen.getByLabelText('Custom system prompt')).toHaveValue(CUSTOM.custom_system_prompt);
    expect(screen.getByLabelText('Custom opening line')).toHaveValue(CUSTOM.custom_first_message);
    expect(screen.queryByRole('heading', { name: 'What to pitch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Business notes' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guardrails' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Custom system prompt'), { target: { value: 'Be brief.' } });
    await waitFor(() => expect(api.previewBuilderConfig.mock.calls.at(-1)[0].custom_system_prompt).toBe('Be brief.'),
      { timeout: 3000 });
  });

  it('a Manager sees custom mode read-only', async () => {
    await open('manager', CUSTOM);
    expect(screen.getByLabelText('Custom system prompt')).toHaveAttribute('readonly');
    expect(screen.getByRole('radio', { name: /Guided/ })).toBeDisabled();
    expect(screen.getByText(/Only a Tenant Admin can change the prompt mode/)).toBeInTheDocument();
  });

  it('asks before switching modes when text would stop being used', async () => {
    await open('tenant_admin', LEGACY);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('radio', { name: /Custom prompt/ }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('the opening line'));
    expect(screen.queryByLabelText('Custom system prompt')).not.toBeInTheDocument();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('radio', { name: /Custom prompt/ }));
    expect(screen.getByLabelText('Custom system prompt')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('only a Super Admin gets the whole-prompt editor', async () => {
    await open('tenant_admin', LEGACY);
    await screen.findByText('Live preview of what the agent will be told');
    expect(screen.queryByTitle('Edit the whole prompt (Super Admin)')).not.toBeInTheDocument();
  });
});
