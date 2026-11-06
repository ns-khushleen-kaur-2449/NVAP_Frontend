import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateProspect } from '@/lib/api';
import { detailLabel, leadDetailEntries } from '@/lib/leadDetails';
import EditLeadDialog, { changesFor, formFor } from './EditLeadDialog';

jest.mock('@/lib/api', () => ({ updateProspect: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// A lead imported from a CSV: its extra columns were kept as details.
const ZOYA = {
  id: 'p-1', full_name: 'Zoya Mirza', email: 'zoya.mirza@example.com', phone: '+919000000030', source: 'Social Media',
  city: 'Delhi', state: 'Delhi', country: 'India',
  custom_fields: { vehicle_interested_in: 'Creta', fuel_type: 'Petrol', budget: 1200000, lead_owner: 'Ravi', legacy_stage: 'x' },
};

it('names a stored detail from its key', () => {
  expect(detailLabel('vehicle_interested_in')).toBe('Vehicle interested in');
  expect(detailLabel('budget_min')).toBe('Budget min');
});

it('lists every detail a lead has, and none of the internal keys', () => {
  expect(leadDetailEntries(ZOYA)).toEqual([
    { key: 'vehicle_interested_in', label: 'Vehicle interested in', value: 'Creta' },
    { key: 'fuel_type', label: 'Fuel type', value: 'Petrol' },
    { key: 'budget', label: 'Budget', value: '1200000' },
  ]);
});

it('shows the imported details and the location, and saves only what changed', async () => {
  updateProspect.mockResolvedValue({ data: {} });
  const onSaved = jest.fn();
  render(<EditLeadDialog open onOpenChange={jest.fn()} lead={ZOYA} onSaved={onSaved} />);
  expect(screen.getByLabelText('City')).toHaveValue('Delhi');
  expect(screen.getByLabelText('Country')).toHaveValue('India');
  expect(screen.getByLabelText('Vehicle interested in')).toHaveValue('Creta');
  expect(screen.getByLabelText('Fuel type')).toHaveValue('Petrol');
  expect(screen.getByLabelText('Budget')).toHaveValue('1200000');
  expect(screen.queryByLabelText('Legacy stage')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Fuel type'), { target: { value: 'Diesel' } });
  fireEvent.change(screen.getByLabelText('Budget'), { target: { value: '1500000' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Gurugram' } });
  fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
  await waitFor(() => expect(updateProspect).toHaveBeenCalledWith('p-1', {
    city: 'Gurugram', custom_fields: { fuel_type: 'Diesel', budget: 1500000 },
  }));
});

it('still sends nothing for an Add Lead detail the lead never had, unless it is filled', () => {
  const before = formFor(ZOYA);
  expect(changesFor(before, { ...before })).toEqual({});
  expect(changesFor(before, { ...before, timeline: 'Next month' }).custom_fields).toEqual({ timeline: 'Next month' });
});
