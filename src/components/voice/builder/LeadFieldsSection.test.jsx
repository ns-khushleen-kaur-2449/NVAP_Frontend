import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import LeadFieldsSection from './LeadFieldsSection';

// Radix Select does not open in jsdom; a native select shows the options and which are disabled.
jest.mock('../../ui/select', () => ({
  Select: ({ children, value, onValueChange }) => <div data-value={value} data-change={onValueChange ? 'y' : 'n'}>{children}</div>,
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
  custom: [{ key: 'custom.unit_type', label: 'Unit type', usages: ALL, masks: ['none'], default_mask: 'none' }],
  unusable: [],
};

function Harness({ initial = [], onSelection }) {
  const [fields, setFields] = useState(initial);
  return (
    <LeadFieldsSection enabled onToggle={() => {}} registry={REGISTRY} leadFields={fields}
      onChange={(next) => { setFields(next); onSelection?.(next); }} />
  );
}

it('groups standard and custom fields', () => {
  render(<Harness />);
  expect(within(screen.getByRole('list', { name: 'Lead details' })).getByText('Email on file')).toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: 'Custom fields from your leads' })).getByText('Unit type')).toBeInTheDocument();
  expect(screen.getByText('Uses it to guide the call; never says it.')).toBeInTheDocument();
});

it('ticks email (in full) and phone (masked) as confirm-only, with their disallowed usages disabled', () => {
  const onSelection = jest.fn();
  render(<Harness onSelection={onSelection} />);
  fireEvent.click(screen.getByLabelText('Include Email on file'));
  fireEvent.click(screen.getByLabelText('Include Phone number on file'));
  expect(onSelection).toHaveBeenLastCalledWith([
    { key: 'email', usage: 'confirm_only', mask: 'none', label: '' },
    { key: 'phone', usage: 'confirm_only', mask: 'last4', label: '' },
  ]);
  const row = screen.getByTestId('lead-field-email');
  const usage = within(row).getAllByRole('combobox')[0];
  const disabled = within(usage).getAllByRole('option').filter((o) => o.disabled).map((o) => o.value);
  expect(disabled).toEqual(['greet', 'context']);
  // The mask choice is offered only where the field has more than one (the email has only the full value).
  expect(within(row).getAllByRole('combobox')).toHaveLength(1);
  expect(within(screen.getByTestId('lead-field-phone')).getAllByRole('combobox')).toHaveLength(2);
  expect(within(screen.getByTestId('lead-field-first_name')).queryAllByRole('combobox')).toHaveLength(0);
});

it('says what happens when customer details are off', () => {
  render(<LeadFieldsSection enabled={false} onToggle={() => {}} registry={REGISTRY} leadFields={[]} onChange={() => {}} />);
  expect(screen.getByText(/keeps its current opener and call details/)).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Lead details' })).not.toBeInTheDocument();
});
