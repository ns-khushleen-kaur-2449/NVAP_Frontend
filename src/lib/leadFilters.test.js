import { activeLabel, applyLeadFilters, buildLeadFilters, detailField, detailValue } from './leadFilters';

const lead = (n, extra = {}, custom = {}) => ({
  id: `p${n}`, name: `Lead ${n}`, stage: n % 2 ? 'new' : 'engaged', source: 'CRM', city: n % 3 ? 'Mohali' : 'Chandigarh',
  state: 'Punjab', custom_fields: { notes: `note ${n}`, ...custom }, ...extra,
});
const LEADS = [
  lead(1, {}, { fuel_preference: 'electric', budget: 1600000, seats: 5, trade_in: true, interested_in: 'Nexon EV' }),
  lead(2, {}, { fuel_preference: 'diesel', budget: 2000000, seats: 7, trade_in: false, interested_in: 'XUV700' }),
  lead(3, {}, { fuel_preference: 'electric', budget: 1200000, seats: 5, trade_in: false, interested_in: 'Punch EV' }),
  lead(4, {}, { fuel_preference: 'petrol', budget: 750000, seats: 5, trade_in: true, interested_in: 'Swift' }),
  lead(5, {}, { fuel_preference: 'petrol', budget: 900000, seats: 5, trade_in: false, interested_in: 'Baleno' }),
  lead(6, {}, { fuel_preference: 'diesel', budget: 1900000, seats: 7, trade_in: true, interested_in: 'Scorpio-N' }),
];
const keys = (filters) => filters.map((f) => f.key);

it('offers only filters the data can narrow by', () => {
  const filters = buildLeadFilters(LEADS);
  // One source and one state for everyone, and unique notes: no use as filters.
  expect(keys(filters)).not.toContain('source');
  expect(keys(filters)).not.toContain('state');
  expect(keys(filters)).not.toContain('custom.notes');
  expect(keys(filters)).toEqual(expect.arrayContaining(['stage', 'city', 'custom.fuel_preference', 'custom.seats', 'custom.trade_in']));
  // Real-estate leftovers never appear without data.
  expect(keys(filters).some((k) => /project|category|budget_range/.test(k))).toBe(false);
  expect(buildLeadFilters([])).toEqual([]);
});

it('labels values and counts them', () => {
  const fuel = buildLeadFilters(LEADS).find((f) => f.key === 'custom.fuel_preference');
  expect(fuel.label).toBe('Fuel preference');
  expect(fuel.options.map((o) => [o.label, o.count])).toEqual([['Diesel', 2], ['Electric', 2], ['Petrol', 2]]);
  const tradeIn = buildLeadFilters(LEADS).find((f) => f.key === 'custom.trade_in');
  expect(tradeIn.options.map((o) => o.label).sort()).toEqual(['No', 'Yes']);
});

it('filters by choices and by a number range', () => {
  const many = Array.from({ length: 15 }, (_, i) => lead(i, {}, { budget: 500000 + i * 100000 }));
  const filters = buildLeadFilters(many);
  const budget = filters.find((f) => f.key === 'custom.budget');
  expect(budget).toMatchObject({ kind: 'range', min: 500000, max: 1900000 });
  expect(applyLeadFilters(many, filters, { 'custom.budget': { min: '', max: '800000' } })).toHaveLength(4);
  expect(activeLabel(budget, { min: '', max: '800000' })).toBe('Budget: up to 800000');

  const six = buildLeadFilters(LEADS);
  const picked = applyLeadFilters(LEADS, six, { 'custom.fuel_preference': 'electric', city: 'Mohali' });
  expect(picked.map((l) => l.id)).toEqual(['p1']);
});

it('shows what the lead is interested in, else the city', () => {
  const field = detailField(LEADS);
  expect(field).toEqual({ key: 'interested_in', label: 'Interested in' });
  expect(detailValue(LEADS[0], field)).toBe('Nexon EV');
  expect(detailField([lead(1)])).toBeNull();
  expect(detailValue(lead(1), null)).toBe('Mohali');
});
