import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import CatalogPage, { changeFor, templateCsv } from './Catalog';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const columns = [
  { key: 'name', label: 'Name', type: 'text', required: true, agent_visible: true, locked: true },
  { key: 'category', label: 'Category', type: 'text', agent_visible: false, locked: true },
  { key: 'price', label: 'Price (₹)', type: 'price', agent_visible: true, locked: false },
  { key: 'fuel_type', label: 'Fuel type', type: 'enum', matching: true, options: ['petrol', 'diesel', 'electric', 'hybrid'],
    agent_visible: true, locked: true },
  { key: 'mileage', label: 'Mileage', type: 'text', custom: true, agent_visible: false, locked: false },
];
const stock = { agent_visible: true, locked: false };

/** Opens a column's ⋯ field menu (Radix opens it on Enter in jsdom). */
const openFieldMenu = async (label) => {
  fireEvent.keyDown(screen.getByRole('button', { name: `Field actions for ${label}` }), { key: 'Enter' });
  return within(await screen.findByRole('menu'));
};
const nexon = { id: 'i-1', name: 'Nexon EV', category: 'suv', price: 1450000, attrs: { fuel_type: 'electric' },
  extra: { mileage: '312 km range' }, active: true, source: 'import', stock: [{ location: 'Solan', units: 3 }] };

beforeEach(() => {
  jest.resetAllMocks();
  api.getCatalogTable.mockResolvedValue({ data: { columns, stock, rows: [nexon] } });
  // The brochures section (CatalogBrochures, BrochureProducts).
  api.listBrochures.mockResolvedValue({ data: [{ id: 'b-1', meeting_type_id: null, is_default: true, filename: 'Apex.pdf',
    size_bytes: 2048 }] });
  api.listExecutiveCandidates.mockResolvedValue({ data: [] });
  api.listProducts.mockResolvedValue({ data: [] });
  api.getAppointmentRules.mockResolvedValue({ data: { rules: { brochure_sender_user_id: null } } });
});

it('shows fixed, matching and custom columns with each product and its stock', async () => {
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  const row = await screen.findByTestId('catalog-row-i-1');
  expect(row).toHaveTextContent('Nexon EV');
  expect(row).toHaveTextContent('₹14,50,000');
  expect(row).toHaveTextContent('312 km range');
  expect(row).toHaveTextContent('Solan: 3');
  expect(screen.getByRole('columnheader', { name: /Fuel type/ })).toHaveTextContent('match');
});

it('edits a matching cell with a choice of its allowed values', async () => {
  api.updateCatalogItem.mockResolvedValue({ data: { ...nexon, attrs: { fuel_type: 'hybrid' } } });
  renderWithAuth(<CatalogPage />, { user: USERS.manager });
  const row = await screen.findByTestId('catalog-row-i-1');
  fireEvent.click(within(row).getByText('electric'));
  const select = screen.getByLabelText('Fuel type of Nexon EV');
  fireEvent.change(select, { target: { value: 'hybrid' } });
  fireEvent.blur(select);
  await waitFor(() => expect(api.updateCatalogItem).toHaveBeenCalledWith('i-1', { attrs: { fuel_type: 'hybrid' } }));
  await waitFor(() => expect(screen.queryByLabelText('Fuel type of Nexon EV')).not.toBeInTheDocument());
  expect(screen.getByTestId('catalog-row-i-1')).toHaveTextContent('hybrid');
});

it('edits a custom field and the price with Enter', async () => {
  api.updateCatalogItem.mockResolvedValue({ data: nexon });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  const row = await screen.findByTestId('catalog-row-i-1');
  fireEvent.click(within(row).getByText('312 km range'));
  const input = screen.getByLabelText('Mileage of Nexon EV');
  fireEvent.change(input, { target: { value: '320 km range' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(api.updateCatalogItem).toHaveBeenCalledWith('i-1', { extra: { mileage: '320 km range' } }));
  expect(changeFor(columns[2], '8.5 lakh')).toEqual({ price: '8.5 lakh' });
  expect(changeFor(columns[4], '')).toEqual({ extra: { mileage: null } });
});

it('adds a field with a type', async () => {
  api.addCatalogField.mockResolvedValue({ data: {} });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  fireEvent.click(await screen.findByRole('button', { name: /Add field/ }));
  fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'Warranty years' } });
  fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'number' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.addCatalogField).toHaveBeenCalledWith({ label: 'Warranty years', type: 'number' }));
});

it('imports a CSV and shows what happened', async () => {
  api.importCatalog.mockResolvedValue({ data: { imported: 2, updated: 1, deactivated: 0, rejected: 1,
    errors: [{ row: 4, reason: 'name is required' }] } });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  await screen.findByTestId('catalog-row-i-1');
  const file = new File(['name,price\n'], 'cars.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Catalog CSV file'), { target: { files: [file] } });
  const result = await screen.findByRole('status', { name: 'Import result' });
  expect(result).toHaveTextContent('2 added, 1 updated, 0 no longer in the file (deactivated), 1 rejected.');
  expect(result).toHaveTextContent('Row 4: name is required');
  expect(api.importCatalog).toHaveBeenCalledWith(file);
});

it('lets a Sales Rep look but not edit', async () => {
  renderWithAuth(<CatalogPage />, { user: USERS.rep });
  const row = await screen.findByTestId('catalog-row-i-1');
  fireEvent.click(within(row).getByText('electric'));
  expect(screen.queryByLabelText('Fuel type of Nexon EV')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Import CSV|Add field|Add product|Deactivate/ })).not.toBeInTheDocument();
});

it('builds a template from the current columns', () => {
  expect(templateCsv(columns)).toBe('source_row_id,name,category,price,fuel_type,Mileage,location,units,test_drive_available\n');
});

it('lets editors choose which columns the agent sees; matching columns stay locked', async () => {
  api.setCatalogVisibility.mockResolvedValue({ data: {} });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  await screen.findByTestId('catalog-row-i-1');
  expect(screen.queryByRole('button', { name: /Fuel type from the agent/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Fuel type: the agent always sees this')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hide Price (₹) from the agent' }));
  await waitFor(() => expect(api.setCatalogVisibility).toHaveBeenCalledWith('price', false));
  fireEvent.click(screen.getByRole('button', { name: 'Show Mileage to the agent' }));
  await waitFor(() => expect(api.setCatalogVisibility).toHaveBeenCalledWith('mileage', true));
  fireEvent.click(screen.getByRole('button', { name: 'Hide Stock from the agent' }));
  await waitFor(() => expect(api.setCatalogVisibility).toHaveBeenCalledWith('stock', false));
});

it('shows a sales rep what the agent sees without toggles', async () => {
  renderWithAuth(<CatalogPage />, { user: USERS.rep });
  await screen.findByTestId('catalog-row-i-1');
  expect(screen.queryByRole('button', { name: /from the agent|to the agent/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Mileage: hidden from the agent')).toBeInTheDocument();
});

it('puts the company brochure on top and a Brochure column per product', async () => {
  api.uploadCatalogItemBrochure.mockResolvedValue({ data: {} });
  const { unmount } = renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  expect(await screen.findByRole('heading', { name: 'Company brochure' })).toBeInTheDocument();
  expect(await screen.findByText('Apex.pdf')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Company brochure' }).compareDocumentPosition(screen.getByRole('table')))
    .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  const row = within(await screen.findByTestId('catalog-row-i-1'));
  expect(row.getByText('Uses the company brochure')).toBeInTheDocument();
  const file = new File(['%PDF-1.7'], 'Nexon.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Brochure for Nexon EV'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  await waitFor(() => expect(api.uploadCatalogItemBrochure).toHaveBeenCalledWith('i-1', file, 'Nexon EV Brochure'));
  unmount();

  const manager = renderWithAuth(<CatalogPage />, { user: USERS.manager });
  expect(await screen.findByText('Apex.pdf')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Brochure' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/Brochure for|Company brochure file/)).not.toBeInTheDocument();
  manager.unmount();

  renderWithAuth(<CatalogPage />, { user: USERS.rep });
  await screen.findByTestId('catalog-row-i-1');
  expect(screen.queryByRole('heading', { name: 'Company brochure' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Brochure' })).not.toBeInTheDocument();
});

it('shows a product brochure in its row', async () => {
  api.getCatalogTable.mockResolvedValue({ data: { columns, stock, rows: [{ ...nexon, brochure_product_id: 'p-1',
    brochure: { id: 'b-9', filename: 'Nexon.pdf', size_bytes: 4096 } }] } });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  const row = within(await screen.findByTestId('catalog-row-i-1'));
  expect(row.getByText('Nexon.pdf')).toBeInTheDocument();
  expect(row.getByRole('button', { name: /Replace/ })).toBeInTheDocument();
});

it('adds a product without a price and shows a dash for it', async () => {
  api.addCatalogItem.mockResolvedValue({ data: {} });
  api.getCatalogTable.mockResolvedValue({ data: { columns, stock, rows: [{ ...nexon, price: null }] } });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  const row = within(await screen.findByTestId('catalog-row-i-1'));
  expect(row.getAllByText('—').length).toBeGreaterThan(0);
  // The first "Add product" is the catalog's (the brochure section below has its own).
  fireEvent.click(screen.getAllByRole('button', { name: /Add product/ })[0]);
  const dialog = within(await screen.findByRole('dialog'));
  fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: 'Punch EV' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(api.addCatalogItem).toHaveBeenCalledWith({ name: 'Punch EV', price: null, category: null }));
});

it('shows which cells were left empty and how each column was read', async () => {
  api.importCatalog.mockResolvedValue({ data: { imported: 2, updated: 0, deactivated: 0, rejected: 0, errors: [],
    warnings: [{ row: 3, column: 'Price', reason: "'on request' is not a price; left empty" }],
    columns: [{ column: 'Name', used_as: 'name', note: null },
      { column: 'Units', used_as: 'field', note: 'Not stock (stock needs location and a whole number of units), so it is kept as a field.' }] } });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  await screen.findByTestId('catalog-row-i-1');
  const file = new File(['Name,Units\n'], 'fabric.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Catalog CSV file'), { target: { files: [file] } });
  const result = await screen.findByRole('status', { name: 'Import result' });
  expect(result).toHaveTextContent("Row 3, Price: 'on request' is not a price; left empty");
  expect(result).toHaveTextContent('How your 2 columns were read');
  expect(result).toHaveTextContent('Units: Your field · Not stock');
});

it('hides matching and stock columns no product uses, behind a switch', async () => {
  const unused = [...columns, { key: 'seats', label: 'Seats', type: 'int', matching: true, in_use: false,
    agent_visible: true, locked: true }];
  api.getCatalogTable.mockResolvedValue({ data: { columns: unused, stock: { ...stock, in_use: false }, rows: [nexon] } });
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  await screen.findByTestId('catalog-row-i-1');
  expect(screen.queryByRole('columnheader', { name: /Seats/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: /Stock/ })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /Fuel type/ })).toBeInTheDocument(); // no in_use flag: shown
  fireEvent.click(screen.getByLabelText(/Show unused columns \(2\)/));
  expect(screen.getByRole('columnheader', { name: /Seats/ })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /Stock/ })).toBeInTheDocument();
});

it('offers rename and remove on every field, matched on or not, but never on name, category or price', async () => {
  api.deleteCatalogField.mockResolvedValue({});
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  renderWithAuth(<CatalogPage />, { user: USERS.tenant_admin });
  await screen.findByTestId('catalog-row-i-1');
  for (const label of ['Fuel type', 'Mileage']) {
    const menu = await openFieldMenu(label);
    expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  }
  for (const label of ['Name', 'Category', 'Price (₹)']) {
    expect(screen.queryByRole('button', { name: `Field actions for ${label}` })).not.toBeInTheDocument();
  }
  fireEvent.click((await openFieldMenu('Fuel type')).getByRole('menuitem', { name: 'Remove' }));
  await waitFor(() => expect(api.deleteCatalogField).toHaveBeenCalledWith('fuel_type'));
  confirm.mockRestore();
});

it('gives a Manager the same field actions and a Sales Rep none', async () => {
  const { unmount } = renderWithAuth(<CatalogPage />, { user: USERS.manager });
  await screen.findByTestId('catalog-row-i-1');
  expect((await openFieldMenu('Fuel type')).getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  unmount();
  renderWithAuth(<CatalogPage />, { user: USERS.rep });
  await screen.findByTestId('catalog-row-i-1');
  expect(screen.queryByRole('button', { name: /Field actions|Rename|Remove/ })).not.toBeInTheDocument();
});
