import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import LeadFieldsSection from './LeadFieldsSection';

// Radix Select does not open in jsdom; a native select shows the options, which are disabled, and changes the value.
jest.mock('../../ui/select', () => ({
  Select: ({ children, value, onValueChange }) => (
    <div data-value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</div>),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <select aria-label="options">{children}</select>,
  SelectItem: ({ value, disabled, children }) => <option value={value} disabled={disabled}>{children}</option>,
}));

const ALL = ['greet', 'context', 'confirm_only', 'never_say'];
const REGISTRY = {
  usages: ALL,
  standard: [
    { key: 'first_name', label: 'Their first name', usages: ALL, masks: ['none'], default_mask: 'none' },
    { key: 'email', label: 'Email on file', usages: ['confirm_only', 'never_say'], masks: ['none'], default_mask: 'none' },
    { key: 'phone', label: 'Phone number on file', usages: ['confirm_only', 'never_say'], masks: ['none', 'last4'], default_mask: 'last4' },
  ],
  custom: [
    { key: 'custom.budget', label: 'Budget', usages: ALL, masks: ['none'], default_mask: 'none' },
    { key: 'custom.body_type', label: 'Body type', usages: ALL, masks: ['none'], default_mask: 'none' },
  ],
  unusable: [],
};

function Harness({ initial = [], onSelection, registry = REGISTRY, loading = false }) {
  const [fields, setFields] = useState(initial);
  return (
    <LeadFieldsSection enabled onToggle={() => {}} registry={registry} leadFields={fields} loading={loading}
      onChange={(next) => { setFields(next); onSelection?.(next); }} />
  );
}

const openPicker = (name) => fireEvent.click(screen.getByRole('button', { name: `Choose ${name}` }));
const pick = (group, label) => fireEvent.click(
  within(screen.getByRole('listbox', { name: group })).getByRole('option', { name: new RegExp(label) }));
const selectedRow = (key) => screen.getByTestId(`lead-field-${key}`);
const usageSelect = (key) => within(selectedRow(key)).getAllByRole('combobox')[0];

it('selects several standard and custom fields, each once, with safe defaults', () => {
  const onSelection = jest.fn();
  render(<Harness onSelection={onSelection} />);
  openPicker('lead details');
  pick('Lead details', 'Email on file');
  pick('Lead details', 'Phone number on file');
  expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
  openPicker('custom fields from your leads');
  pick('Custom fields from your leads', 'Budget');
  expect(onSelection).toHaveBeenLastCalledWith([
    { key: 'email', usage: 'confirm_only', mask: 'none', label: '' },
    { key: 'phone', usage: 'confirm_only', mask: 'last4', label: '' },
    { key: 'custom.budget', usage: 'context', mask: 'none', label: '' },
  ]);
  // Only selected fields get a row, in selection order; the internal key is kept.
  const rows = within(screen.getByRole('list', { name: 'Selected fields' })).getAllByRole('listitem');
  expect(rows.map((r) => r.dataset.testid)).toEqual(['lead-field-email', 'lead-field-phone', 'lead-field-custom.budget']);
  expect(within(selectedRow('custom.budget')).getByText('custom.budget')).toBeInTheDocument();
});

it('searches without losing selections, and selects all or clears a group', () => {
  const onSelection = jest.fn();
  render(<Harness initial={[{ key: 'first_name', usage: 'greet', mask: 'none', label: 'Name' }]} onSelection={onSelection} />);
  openPicker('lead details');
  fireEvent.change(screen.getByLabelText('Search Lead details'), { target: { value: 'phone' } });
  const options = within(screen.getByRole('listbox', { name: 'Lead details' })).getAllByRole('option');
  expect(options).toHaveLength(1);
  pick('Lead details', 'Phone number on file');
  expect(onSelection.mock.calls.at(-1)[0].map((f) => f.key)).toEqual(['first_name', 'phone']);
  fireEvent.change(screen.getByLabelText('Search Lead details'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
  expect(onSelection.mock.calls.at(-1)[0].map((f) => f.key)).toEqual(['first_name', 'phone', 'email']);
  expect(onSelection.mock.calls.at(-1)[0][0].label).toBe('Name');  // existing settings untouched
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(onSelection).toHaveBeenLastCalledWith([]);
});

it('removes a field through its chip or its row', () => {
  const onSelection = jest.fn();
  render(<Harness onSelection={onSelection} initial={[
    { key: 'first_name', usage: 'greet', mask: 'none', label: '' },
    { key: 'custom.budget', usage: 'context', mask: 'none', label: '' }]} />);
  const chips = screen.getByRole('list', { name: 'Selected custom fields from your leads' });
  fireEvent.click(within(chips).getByRole('button', { name: 'Remove Budget' }));
  expect(onSelection).toHaveBeenLastCalledWith([{ key: 'first_name', usage: 'greet', mask: 'none', label: '' }]);
  fireEvent.click(within(selectedRow('first_name')).getByRole('button', { name: 'Remove Their first name' }));
  expect(onSelection).toHaveBeenLastCalledWith([]);
  expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
});

it('changes the usage, with the usages a field does not allow disabled', () => {
  const onSelection = jest.fn();
  render(<Harness onSelection={onSelection} initial={[{ key: 'email', usage: 'confirm_only', mask: 'none', label: '' }]} />);
  const disabled = within(usageSelect('email')).getAllByRole('option').filter((o) => o.disabled).map((o) => o.value);
  expect(disabled).toEqual(['greet', 'context']);
  fireEvent.change(usageSelect('email'), { target: { value: 'never_say' } });
  expect(onSelection).toHaveBeenLastCalledWith([{ key: 'email', usage: 'never_say', mask: 'none', label: '' }]);
});

it('opens one settings panel at a time and keeps what was typed when it closes', () => {
  const onSelection = jest.fn();
  render(<Harness onSelection={onSelection} initial={[
    { key: 'first_name', usage: 'greet', mask: 'none', label: '' },
    { key: 'phone', usage: 'confirm_only', mask: 'last4', label: '' }]} />);
  expect(screen.queryByLabelText('Prompt label for Their first name')).not.toBeInTheDocument();  // collapsed by default
  fireEvent.click(screen.getByRole('button', { name: 'Settings for Their first name' }));
  expect(screen.getByText('May say it in the greeting and now and then after.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Prompt label for Their first name'), { target: { value: 'Customer name' } });
  expect(onSelection.mock.calls.at(-1)[0][0]).toMatchObject({ key: 'first_name', label: 'Customer name' });
  expect(within(selectedRow('first_name')).getByText('Customer name')).toBeInTheDocument();
  // Opening another closes the first; the phone's mask choice is in its panel.
  fireEvent.click(screen.getByRole('button', { name: 'Settings for Phone number on file' }));
  expect(screen.queryByLabelText('Prompt label for Their first name')).not.toBeInTheDocument();
  expect(within(selectedRow('phone')).getAllByRole('combobox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Settings for Their first name' }));
  expect(screen.getByLabelText('Prompt label for Their first name')).toHaveValue('Customer name');
});

it('shows a stored selection as it was, including a custom key no lead has now', () => {
  render(<Harness initial={[{ key: 'custom.unit_type', usage: 'never_say', mask: 'none', label: 'Unit' }]} />);
  expect(within(selectedRow('custom.unit_type')).getByText('Unit')).toBeInTheDocument();
  expect(usageSelect('custom.unit_type').closest('[data-value]')).toHaveAttribute('data-value', 'never_say');
  expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();
});

it('handles no custom fields, loading, and custom fields that cannot be used', () => {
  const { unmount } = render(<Harness registry={{ ...REGISTRY, custom: [], unusable: ['Unit Type'] }} />);
  expect(screen.getByText('None of your leads have custom fields yet.')).toBeInTheDocument();
  expect(screen.getByText(/Can't be used.*Unit Type/)).toBeInTheDocument();
  unmount();
  render(<Harness loading />);
  expect(screen.getAllByText('Loading fields…')).toHaveLength(2);
});

it('says what happens when customer details are off', () => {
  render(<LeadFieldsSection enabled={false} onToggle={() => {}} registry={REGISTRY} leadFields={[]} onChange={() => {}} />);
  expect(screen.getByText(/keeps its current opener and call details/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Choose lead details' })).not.toBeInTheDocument();
});

it('turning it on with nothing selected starts with the first name', () => {
  const onToggle = jest.fn();
  const onChange = jest.fn();
  render(<LeadFieldsSection enabled={false} onToggle={onToggle} registry={REGISTRY} leadFields={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Use customer details on calls' }));
  expect(onToggle).toHaveBeenCalledWith(true);
  expect(onChange).toHaveBeenCalledWith([{ key: 'first_name', usage: 'greet', mask: 'none', label: '' }]);
});
