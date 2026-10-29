import { cleanup as cleanupAll, fireEvent, screen, waitFor, within } from '@testing-library/react';
import CatalogPage from './Catalog';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// A textile shop (Raymond): its own fields, Colour still text until matching is turned on.
const fixed = [
  { key: 'name', label: 'Name', type: 'text', required: true, agent_visible: true, locked: true },
  { key: 'category', label: 'Category', type: 'text', agent_visible: false, locked: true },
  { key: 'price', label: 'Price (₹)', type: 'price', agent_visible: true, locked: false },
];
const field = (key, label, extra = {}) => ({
  key, label, type: 'text', position: 0, agent_visible: true, matchable: false, match_mode: 'exact', allowed_values: [],
  synonyms: {}, aliases: [], relax_priority: null, weight: 2, preset: null, ask_lead: false, ask_order: null, labels: {},
  matching: false, custom: true, locked: false, in_use: true, ...extra,
});
const COLOURS = ['black', 'blue', 'brown', 'charcoal', 'cream', 'green', 'grey', 'maroon', 'navy', 'olive', 'white'];
const colour = field('colour', 'Colour');
const fabric = field('fabric', 'Fabric', { type: 'choice', matchable: true, matching: true, custom: false,
  allowed_values: ['cotton', 'linen', 'wool'], options: ['cotton', 'linen', 'wool'], ask_lead: true, ask_order: 1 });
const twill = { id: 'i-1', name: 'Twill', category: 'fabric', price: 900, values: { colour: 'navy', fabric: 'cotton' },
  attrs: { fabric: 'cotton' }, extra: { colour: 'navy' }, active: true, source: 'import', stock: [] };
const table = (columns) => ({ data: { columns: [...fixed, ...columns], stock: { agent_visible: true, locked: false }, rows: [twill] } });
const agents = (extra = {}) => ({ republish_scheduled: true, delay_seconds: 30, drafts: [], ...extra });

const openFieldMenu = async (label) => {
  fireEvent.keyDown(screen.getByRole('button', { name: `Field actions for ${label}` }), { key: 'Enter' });
  return within(await screen.findByRole('menu'));
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getCatalogTable.mockResolvedValue(table([colour, fabric]));
  api.listBrochures.mockResolvedValue({ data: [] });
  api.listExecutiveCandidates.mockResolvedValue({ data: [] });
  api.listProducts.mockResolvedValue({ data: [] });
  api.getAppointmentRules.mockResolvedValue({ data: { rules: {} } });
});

describe('Agent can filter by this', () => {
  it('turns on matching for Colour and says it became a list of its 11 values (the Raymond case)', async () => {
    const matched = { ...colour, type: 'choice', matchable: true, matching: true, custom: false, allowed_values: COLOURS,
      options: COLOURS };
    api.updateCatalogField.mockResolvedValue({ data: { ...matched, agents: agents({ drafts: ['Riya'] }) } });
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    expect(screen.getByRole('columnheader', { name: /Colour/ })).not.toHaveTextContent('match');
    const menu = await openFieldMenu('Colour');
    const item = menu.getByRole('menuitemcheckbox', { name: 'Agent can filter by this' });
    expect(item).toHaveAttribute('aria-checked', 'false');
    api.getCatalogTable.mockResolvedValue(table([matched, fabric]));
    fireEvent.click(item);
    await waitFor(() => expect(api.updateCatalogField).toHaveBeenCalledWith('colour', { matchable: true }));
    const notice = await screen.findByRole('status', { name: 'Catalog change' });
    expect(notice).toHaveTextContent('Colour: converted to a list (pick one) with 11 values.');
    expect(notice).toHaveTextContent('Your agents will update in about 30 seconds.');
    expect(notice).toHaveTextContent('Not updated because it has unpublished changes: Riya.');
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /Colour/ })).toHaveTextContent('match'));
  });

  it('shows the API note when a field with many values stays text', async () => {
    api.updateCatalogField.mockResolvedValue({ data: { ...colour, matchable: true, matching: true,
      note: 'more than 50 different values, so it stays a text field', agents: agents() } });
    renderWithAuth(<CatalogPage />, { user: USERS.manager });
    await screen.findByTestId('catalog-row-i-1');
    fireEvent.click((await openFieldMenu('Colour')).getByRole('menuitemcheckbox', { name: 'Agent can filter by this' }));
    expect(await screen.findByRole('status', { name: 'Catalog change' }))
      .toHaveTextContent('Colour: more than 50 different values, so it stays a text field.');
  });

  it('turns matching off from the same item, ticked for a matchable field', async () => {
    api.updateCatalogField.mockResolvedValue({ data: { ...fabric, matchable: false, agents: agents({ republish_scheduled: false }) } });
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    const item = (await openFieldMenu('Fabric')).getByRole('menuitemcheckbox', { name: 'Agent can filter by this' });
    expect(item).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(item);
    await waitFor(() => expect(api.updateCatalogField).toHaveBeenCalledWith('fabric', { matchable: false }));
    expect(screen.queryByRole('status', { name: 'Catalog change' })).not.toBeInTheDocument(); // nothing to say
  });

  it('gives a Sales Rep the badge but no menu', async () => {
    renderWithAuth(<CatalogPage />, { user: USERS.rep });
    await screen.findByTestId('catalog-row-i-1');
    expect(screen.getByRole('columnheader', { name: /Fabric/ })).toHaveTextContent('match');
    expect(screen.queryByRole('button', { name: /Field actions/ })).not.toBeInTheDocument();
  });

  it('shows a refusal as an error and changes nothing', async () => {
    const { toast } = jest.requireMock('sonner');
    api.updateCatalogField.mockRejectedValue({ response: { status: 403, data: { detail: 'Not allowed' } } });
    renderWithAuth(<CatalogPage />, { user: USERS.manager });
    await screen.findByTestId('catalog-row-i-1');
    fireEvent.click((await openFieldMenu('Colour')).getByRole('menuitemcheckbox', { name: 'Agent can filter by this' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not allowed'));
    expect(screen.queryByRole('status', { name: 'Catalog change' })).not.toBeInTheDocument();
  });
});

describe('Field settings', () => {
  const openSettings = async (label) => {
    fireEvent.click((await openFieldMenu(label)).getByRole('menuitem', { name: 'Field settings' }));
    return within(await screen.findByRole('dialog', { name: `Field settings: ${label}` }));
  };
  const modeNames = (dialog) => within(dialog.getByLabelText('How to match')).getAllByRole('option').map((o) => o.textContent);

  it('edits every setting in plain words and sends only what changed', async () => {
    api.updateCatalogField.mockResolvedValue({ data: { ...colour, agents: agents() } });
    api.setCatalogVisibility.mockResolvedValue({ data: {} });
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    const dialog = await openSettings('Colour');
    expect(dialog.queryByLabelText('How to match')).not.toBeInTheDocument(); // only once the agent filters by it
    fireEvent.click(dialog.getByRole('switch', { name: 'Agent can filter by this' }));
    expect(modeNames(dialog)).toEqual(['Must match', 'Contains']);
    fireEvent.change(dialog.getByLabelText('Type'), { target: { value: 'choice' } });
    expect(modeNames(dialog)).toEqual(['Must match']);
    const add = dialog.getByLabelText('Add an option');
    for (const option of ['Navy', 'white']) {
      fireEvent.change(add, { target: { value: option } });
      fireEvent.keyDown(add, { key: 'Enter' });
    }
    fireEvent.change(dialog.getByLabelText('Importance'), { target: { value: '3' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add a word' }));
    fireEvent.change(dialog.getByLabelText('Word leads use 1'), { target: { value: 'Dark blue' } });
    fireEvent.change(dialog.getByLabelText('Means 1'), { target: { value: 'navy' } });
    const header = dialog.getByLabelText('Add a column header');
    fireEvent.change(header, { target: { value: 'Shade' } });
    fireEvent.keyDown(header, { key: 'Enter' });
    fireEvent.click(dialog.getByRole('switch', { name: 'Agent asks the lead about this' }));
    fireEvent.click(dialog.getByRole('switch', { name: 'Agent can mention this' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Names in other languages' }));
    fireEvent.change(dialog.getByLabelText('Name in Hindi'), { target: { value: 'रंग' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateCatalogField).toHaveBeenCalledWith('colour', {
      labels: { hi: 'रंग' }, type: 'choice', matchable: true, allowed_values: ['navy', 'white'],
      synonyms: { 'dark blue': 'navy' }, aliases: ['Shade'], ask_lead: true, weight: 3,
    }));
    expect(api.setCatalogVisibility).toHaveBeenCalledWith('colour', false);
    expect(await screen.findByRole('status', { name: 'Catalog change' })).toHaveTextContent('Your agents will update in about 30 seconds.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a refusal in plain language, naming the products in the way, and stays open', async () => {
    api.updateCatalogField.mockRejectedValue({ response: { status: 422, data: {
      detail: '2 product(s) have a Fabric that would not fit, for example Tweed, Velvet. Change those values first.' } } });
    renderWithAuth(<CatalogPage />, { user: USERS.manager });
    await screen.findByTestId('catalog-row-i-1');
    const dialog = await openSettings('Fabric');
    fireEvent.click(dialog.getByRole('button', { name: 'Remove wool' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert'))
      .toHaveTextContent('2 product(s) have a Fabric that would not fit, for example Tweed, Velvet. Change those values first.');
    expect(api.updateCatalogField).toHaveBeenCalledWith('fabric', { allowed_values: ['cotton', 'linen'] });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says so when the account may not change it', async () => {
    api.updateCatalogField.mockRejectedValue({ response: { status: 403, data: { detail: 'Forbidden' } } });
    renderWithAuth(<CatalogPage />, { user: USERS.manager });
    await screen.findByTestId('catalog-row-i-1');
    const dialog = await openSettings('Colour');
    fireEvent.change(dialog.getByLabelText('Name in English'), { target: { value: 'Shade' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('You can view this but not change it.');
  });

  it('offers only the number modes for a number field and keeps a custom importance', async () => {
    const gsm = field('gsm', 'GSM', { type: 'number', matchable: true, matching: true, custom: false, match_mode: 'at_least', weight: 5 });
    api.getCatalogTable.mockResolvedValue(table([colour, gsm]));
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    const dialog = await openSettings('GSM');
    expect(modeNames(dialog)).toEqual(['Must match', 'At least', 'At most', 'Within a range']);
    expect(dialog.getByLabelText('How to match')).toHaveValue('at_least');
    expect(dialog.getByLabelText('Importance')).toHaveDisplayValue('Custom (5)');
    expect(dialog.queryByLabelText('Add an option')).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Add a word' })).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('How to match'), { target: { value: 'range' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateCatalogField).toHaveBeenCalledWith('gsm', { match_mode: 'range' }));
  });

  it('sends nothing when nothing changed', async () => {
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    const dialog = await openSettings('Fabric');
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.updateCatalogField).not.toHaveBeenCalled();
    expect(api.setCatalogVisibility).not.toHaveBeenCalled();
  });
});

describe('Matching order', () => {
  // Asked: Fabric (1), Colour (2), Width (no order: last). Relaxed: Width then Colour; Fabric always required.
  const ordered = [
    field('colour', 'Colour', { type: 'choice', matchable: true, matching: true, ask_lead: true, ask_order: 2, relax_priority: 2, position: 1 }),
    { ...fabric, relax_priority: null, position: 0 },
    field('width', 'Width', { type: 'number', matchable: true, matching: true, ask_lead: true, relax_priority: 1, position: 2 }),
    field('weave', 'Weave', { position: 3 }),
  ];
  const names = (list) => within(list).getAllByRole('listitem').map((li) => li.textContent.replace(/^\d+\.\s*/, '').replace(/Always required|Allow dropping/, '').trim());
  const open = async (user) => {
    api.getCatalogTable.mockResolvedValue(table(ordered));
    renderWithAuth(<CatalogPage />, { user });
    await screen.findByTestId('catalog-row-i-1');
    fireEvent.click(screen.getByRole('button', { name: /Matching order/ }));
    return within(await screen.findByRole('dialog', { name: 'Matching order' }));
  };

  it('reorders both lists and saves them together', async () => {
    api.orderCatalogFields.mockResolvedValue({ data: { columns: [], agents: agents() } });
    const sheet = await open(USERS.tenant_admin);
    const asks = sheet.getByRole('list', { name: 'Questions the agent asks' });
    expect(names(asks)).toEqual(['Fabric', 'Colour', 'Width']);
    expect(names(sheet.getByRole('list', { name: 'Relax in this order' }))).toEqual(['Width', 'Colour']);
    expect(names(sheet.getByRole('list', { name: 'Always required' }))).toEqual(['Fabric']);
    fireEvent.click(sheet.getByRole('button', { name: 'Move Colour up in Questions the agent asks' }));
    // Drag Width onto the first place.
    const items = within(asks).getAllByRole('listitem');
    fireEvent.dragStart(items[2]);
    fireEvent.dragOver(items[0]);
    fireEvent.drop(items[0]);
    expect(names(asks)).toEqual(['Width', 'Colour', 'Fabric']);
    fireEvent.click(sheet.getByRole('button', { name: 'Always require Colour' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Allow dropping Fabric' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Save order' }));
    await waitFor(() => expect(api.orderCatalogFields).toHaveBeenCalledWith({
      ask_order: ['width', 'colour', 'fabric'], relax_order: ['width', 'fabric'], never_relax: ['colour'] }));
    expect(api.updateCatalogField).not.toHaveBeenCalled(); // one request, never one per field
    expect(await screen.findByRole('status', { name: 'Catalog change' })).toHaveTextContent('Your agents will update');
  });

  it('keeps the sheet open with the reason when the order is refused', async () => {
    api.orderCatalogFields.mockRejectedValue({ response: { status: 422, data: { detail: 'Say whether to relax Width too.' } } });
    const sheet = await open(USERS.manager);
    fireEvent.click(sheet.getByRole('button', { name: 'Save order' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent('Say whether to relax Width too.');
  });

  it('shows a Sales Rep the order without changing it', async () => {
    const sheet = await open(USERS.rep);
    expect(names(sheet.getByRole('list', { name: 'Questions the agent asks' }))).toEqual(['Fabric', 'Colour', 'Width']);
    expect(sheet.queryByRole('button', { name: /Move|Always require|Allow dropping|Save order/ })).not.toBeInTheDocument();
    expect(sheet.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });
});

describe('Presets', () => {
  const presets = { data: { presets: [
    { name: 'shop_a', label: 'fabric shop', demo_label: 'Sample visit',
      fields: [{ key: 'fabric', label: 'Fabric', type: 'choice' }, { key: 'gsm', label: 'GSM', type: 'number' }],
      words: { product: 'fabric', products: 'fabrics', visit: 'sample visit', ask: { gsm: 'how heavy' } } },
    { name: 'shop_b', label: 'property developer', demo_label: null, fields: [], words: { product: 'home' } },
  ] } };
  const open = async (user) => {
    api.getCatalogPresets.mockResolvedValue(presets);
    api.getCatalogSettings.mockResolvedValue({ data: { words: { product: 'cloth' }, demo_label: null } });
    renderWithAuth(<CatalogPage />, { user });
    await screen.findByTestId('catalog-row-i-1');
    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Start from a preset' }));
    await dialog.findByLabelText('fabric shop');
    return dialog;
  };

  it('shows what applying adds, keeps what the tenant has, and shows the result', async () => {
    api.applyCatalogPreset.mockResolvedValue({ data: { preset: 'shop_a', added: ['gsm'], agents: agents() } });
    const dialog = await open(USERS.tenant_admin);
    expect(dialog.getByText('Nothing you already have is changed or removed.', { exact: false })).toBeInTheDocument();
    const preview = dialog.getByLabelText('What it adds');
    const item = (text) => within(preview).getAllByRole('listitem').find((li) => li.textContent.includes(text));
    expect(item('GSM')).toHaveTextContent('GSM (Number)');
    expect(preview).toHaveTextContent('Already yours, left as they are: Fabric.');
    expect(item('What you sell (one)')).toHaveTextContent('What you sell (one): fabric (you have your own; it stays)');
    expect(item('The visit you offer')).not.toHaveTextContent('it stays');
    expect(preview).toHaveTextContent('The visit is called: Sample visit');
    fireEvent.click(dialog.getByRole('button', { name: 'Add these fields' }));
    await waitFor(() => expect(api.applyCatalogPreset).toHaveBeenCalledWith('shop_a'));
    expect(await dialog.findByRole('status', { name: 'Preset result' })).toHaveTextContent('Added 1 field from fabric shop: GSM.');
    // Behind the dialog (hidden from assistive tech until it closes), the page says it too.
    expect(screen.getByRole('status', { name: 'Catalog change', hidden: true })).toHaveTextContent('Your agents will update');
  });

  it('says when every field was already there', async () => {
    api.applyCatalogPreset.mockResolvedValue({ data: { preset: 'shop_b', added: [], agents: agents({ republish_scheduled: false }) } });
    const dialog = await open(USERS.tenant_admin);
    fireEvent.click(dialog.getByLabelText('property developer'));
    expect(dialog.getByText('None: you already have all of them.')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
    expect(await dialog.findByRole('status', { name: 'Preset result' }))
      .toHaveTextContent('You already had every field of property developer; nothing was added.');
  });

  it('lets a Manager look but not apply, and gives a Sales Rep no picker', async () => {
    const dialog = await open(USERS.manager);
    expect(dialog.getByText('Only a Tenant Admin can apply a preset.')).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /Add these fields|Apply/ })).not.toBeInTheDocument();
    cleanupAll();
    renderWithAuth(<CatalogPage />, { user: USERS.rep });
    await screen.findByTestId('catalog-row-i-1');
    expect(screen.queryByRole('button', { name: /Presets/ })).not.toBeInTheDocument();
  });

  it('shows a refused apply', async () => {
    api.applyCatalogPreset.mockRejectedValue({ response: { status: 403, data: { detail: 'Forbidden' } } });
    const dialog = await open(USERS.tenant_admin);
    fireEvent.click(dialog.getByRole('button', { name: 'Add these fields' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('You can view this but not change it.');
  });
});

describe('Catalog settings', () => {
  const current = {
    currency: 'INR', price_format: 'indian', price_format_set: false, budget_tolerance_up: 0.1, budget_tolerance_down: 0.35,
    demo_label: null, stock_unit: 'units', words: { product: 'cloth' }, preset: null, overridden: ['words'],
    options: { currencies: ['AED', 'INR', 'USD'], price_formats: ['indian', 'international'], languages: ['en', 'hi', 'ar', 'fr', 'es'] },
  };
  const spokenFor = ({ currency }) => ({ data: { spoken: currency === 'AED' ? '1.25 million dirhams' : '12.5 lakh' } });
  const open = async (user) => {
    api.getCatalogSettings.mockResolvedValue({ data: current });
    api.getCatalogPricePreview.mockImplementation((params) => Promise.resolve(spokenFor(params)));
    renderWithAuth(<CatalogPage />, { user });
    fireEvent.click(await screen.findByRole('button', { name: /Catalog settings/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Catalog settings' }));
    await sheet.findByLabelText('Currency');
    return sheet;
  };

  it('changes prices, budget and words with a reason, and previews the spoken price', async () => {
    api.updateCatalogSettings.mockResolvedValue({ data: { ...current, currency: 'AED', changed: ['currency'], agents: agents() } });
    const sheet = await open(USERS.tenant_admin);
    expect(await sheet.findByRole('note', { name: 'Spoken price' })).toHaveTextContent('A price of 1,250,000 will be spoken as “12.5 lakh”.');
    fireEvent.change(sheet.getByLabelText('Currency'), { target: { value: 'AED' } });
    await waitFor(() => expect(sheet.getByRole('note', { name: 'Spoken price' })).toHaveTextContent('“1.25 million dirhams”'));
    expect(api.getCatalogPricePreview).toHaveBeenLastCalledWith({ amount: 1250000, currency: 'AED', price_format: undefined });
    fireEvent.change(sheet.getByLabelText('Above the budget (%)'), { target: { value: '20' } });
    expect(screen.getByRole('dialog', { name: 'Catalog settings' })).toHaveTextContent('still counts prices from 65 to 120 as within budget');
    fireEvent.change(sheet.getByLabelText('What you sell (one)'), { target: { value: 'fabric' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Hindi' }));
    fireEvent.change(sheet.getByLabelText('What you sell (one)'), { target: { value: 'कपड़ा' } });
    fireEvent.change(sheet.getByLabelText('The visit is called'), { target: { value: 'नमूना' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Save catalog settings' }));
    expect(confirm.getByText('Currency: INR → AED')).toBeInTheDocument();
    expect(confirm.getByText('Up to 10% above the budget → 20%')).toBeInTheDocument();
    expect(confirm.getByText('What you sell (one): cloth → fabric')).toBeInTheDocument();
    const save = confirm.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled(); // a reason is required
    fireEvent.change(confirm.getByLabelText(/Reason/), { target: { value: 'Dubai showroom' } });
    fireEvent.click(save);
    await waitFor(() => expect(api.updateCatalogSettings).toHaveBeenCalledWith({
      currency: 'AED', budget_tolerance_up: 0.2, demo_label: { hi: 'नमूना' },
      words: { product: { en: 'fabric', hi: 'कपड़ा' } }, reason: 'Dubai showroom' }, undefined));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save catalog settings' })).not.toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'Catalog change', hidden: true })).toHaveTextContent('Your agents will update');
  });

  it('shows a refused save in the reason dialog', async () => {
    api.updateCatalogSettings.mockRejectedValue({ response: { status: 422, data: { detail: 'words.visit: no prices here; prices come only from the catalog.' } } });
    const sheet = await open(USERS.tenant_admin);
    fireEvent.change(sheet.getByLabelText('The visit you offer'), { target: { value: 'a visit for 500 rupees' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Save catalog settings' }));
    fireEvent.change(confirm.getByLabelText(/Reason/), { target: { value: 'x' } });
    fireEvent.click(confirm.getByRole('button', { name: 'Save' }));
    expect(await confirm.findByRole('alert')).toHaveTextContent('words.visit: no prices here');
  });

  it('shows the history with who changed what and why', async () => {
    api.getCatalogSettingsHistory.mockResolvedValue({ data: { events: [
      { id: 2, actor_name: 'Asha Rao', reason: 'Dubai showroom', created_at: '2026-10-29T10:00:00Z',
        old: { currency: null, budget_tolerance_up: null }, new: { currency: 'AED', budget_tolerance_up: 0.2 } },
      { id: 1, actor_name: null, reason: 'Our words', created_at: '2026-10-28T10:00:00Z',
        old: { words: null }, new: { words: { product: 'fabric' } } },
    ] } });
    const sheet = await open(USERS.manager);
    fireEvent.click(sheet.getByRole('button', { name: 'History' }));
    const rows = within(await sheet.findByRole('list', { name: 'Settings history' })).getAllByRole('listitem')
      .filter((li) => li.parentElement.getAttribute('aria-label') === 'Settings history');
    expect(rows[0]).toHaveTextContent('Asha Rao');
    expect(rows[0]).toHaveTextContent('“Dubai showroom”');
    expect(rows[0]).toHaveTextContent('Currency: default → AED');
    expect(rows[0]).toHaveTextContent('Above the budget: default → 20%');
    expect(rows[1]).toHaveTextContent('Unknown user');
    expect(rows[1]).toHaveTextContent('What you sell (one): default → fabric');
  });

  it('lets a Manager look but not change anything', async () => {
    const sheet = await open(USERS.manager);
    expect(sheet.getByText('Only a Tenant Admin can change these.')).toBeInTheDocument();
    expect(sheet.getByLabelText('Currency')).toBeDisabled();
    expect(sheet.getByLabelText('What you sell (one)')).toBeDisabled();
    expect(sheet.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('lets a Super Admin pick the tenant and change its settings', async () => {
    api.listTenants.mockResolvedValue({ data: { tenants: [{ tenant_id: 't-9', name: 'Raymond' }, { tenant_id: 't-8', name: 'Apex' }] } });
    api.updateCatalogSettings.mockResolvedValue({ data: { ...current, agents: agents({ republish_scheduled: false }) } });
    const sheet = await open(USERS.super_admin);
    expect(screen.queryByTestId('catalog-row-i-1')).not.toBeInTheDocument();
    expect(api.getCatalogTable).not.toHaveBeenCalled(); // the table needs a tenant of one's own
    await waitFor(() => expect(api.getCatalogSettings).toHaveBeenCalledWith({ tenant_id: 't-9' }));
    fireEvent.change(sheet.getByLabelText('Tenant'), { target: { value: 't-8' } });
    await waitFor(() => expect(api.getCatalogSettings).toHaveBeenCalledWith({ tenant_id: 't-8' }));
    fireEvent.change(await sheet.findByLabelText('Currency'), { target: { value: 'USD' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Save catalog settings' }));
    fireEvent.change(confirm.getByLabelText(/Reason/), { target: { value: 'US branch' } });
    fireEvent.click(confirm.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateCatalogSettings).toHaveBeenCalledWith(
      { currency: 'USD', reason: 'US branch' }, { tenant_id: 't-8' }));
  });

  it('gives a Sales Rep no settings', async () => {
    renderWithAuth(<CatalogPage />, { user: USERS.rep });
    await screen.findByTestId('catalog-row-i-1');
    expect(screen.queryByRole('button', { name: /Catalog settings/ })).not.toBeInTheDocument();
  });
});

describe('Import result', () => {
  const upload = async (report) => {
    api.importCatalog.mockResolvedValue({ data: report });
    renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('catalog-row-i-1');
    fireEvent.change(screen.getByLabelText('Catalog CSV file'), { target: { files: [new File(['Name\n'], 'f.csv', { type: 'text/csv' })] } });
    return screen.findByRole('status', { name: 'Import result' });
  };

  it('lists possible typos apart, with a link to that field’s settings', async () => {
    const result = await upload({ imported: 1, updated: 4, deactivated: 0, rejected: 0, errors: [], columns: [],
      warnings: [
        { row: 6, column: 'Colour', reason: "'Whitee' added; similar to 'white'", kind: 'similar_choice', field: 'colour',
          value: 'whitee', similar_to: 'white' },
        { row: 3, column: 'Price', reason: "'on request' is not a price; left empty" },
      ],
      agents: agents({ drafts: ['Zed', 'Riya'] }) });
    const typos = within(result).getByLabelText('Possible typos');
    expect(typos).toHaveTextContent('Possible typos (1)');
    expect(typos).toHaveTextContent('Row 6, Colour: “whitee” was added; it looks like “white”.');
    expect(typos).not.toHaveTextContent('on request');
    expect(result).toHaveTextContent('Left empty (1): these cells did not fit their column.');
    expect(result).toHaveTextContent("Row 3, Price: 'on request' is not a price; left empty");
    expect(result).toHaveTextContent('Your agents will update in about 30 seconds.');
    expect(result).toHaveTextContent('Not updated because they have unpublished changes: Zed, Riya.');
    fireEvent.click(within(typos).getByRole('button', { name: 'Open Colour settings' }));
    expect(await screen.findByRole('dialog', { name: 'Field settings: Colour' })).toBeInTheDocument();
  });

  it('says nothing about agents when nothing they use changed', async () => {
    const result = await upload({ imported: 1, updated: 0, deactivated: 0, rejected: 0, errors: [], warnings: [], columns: [],
      agents: agents({ republish_scheduled: false }) });
    expect(result).not.toHaveTextContent('agents');
    expect(within(result).queryByLabelText('Possible typos')).not.toBeInTheDocument();
  });
});
