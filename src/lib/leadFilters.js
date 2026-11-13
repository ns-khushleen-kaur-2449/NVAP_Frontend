// Filters for the campaign builder's lead picker, built from the leads themselves: a filter is offered only
// when the data can narrow the list (at least two different values), so a tenant never sees an empty option.
// Prospect columns come first, then every custom field the leads carry (whatever the tenant stores there).

const BUILT_IN = [
  { key: 'stage', label: 'Stage', read: (lead) => lead.stage },
  { key: 'source', label: 'Source', read: (lead) => lead.source || lead.lead_source },
  { key: 'city', label: 'City', read: (lead) => lead.city },
  { key: 'state', label: 'State', read: (lead) => lead.state },
  { key: 'assigned_to', label: 'Assigned to', read: (lead) => lead.assigned_to || lead.lead_owner },
];
// Custom fields that identify a person or are free text: never a filter.
const NOT_FILTERS = new Set(['notes', 'note', 'comments', 'name', 'full_name', 'first_name', 'last_name', 'email',
  'phone', 'mobile', 'assigned_to', 'lead_owner', 'legacy_stage', 'metadata', 'city', 'state', 'country']);
const MAX_CHOICES = 25;
// A number field with more different values than this is filtered by a range, not a list.
const RANGE_AFTER = 12;
// Shown as the table's detail column when a lead has one of these, in this order.
const DETAIL_KEYS = ['interested_in', 'project', 'product', 'model', 'category'];

const usable = (value) => value !== null && value !== undefined && value !== '' && typeof value !== 'object';

export const humanize = (text) => {
  const words = String(text).replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words;
};

const valueLabel = (value) => {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  const text = String(value);
  // Keep proper names and codes as written ("Mohali", "CRM"); tidy lowercase or snake_case words.
  return text === text.toLowerCase() || (text === text.toUpperCase() && text.includes('_')) ? humanize(text.toLowerCase()) : text;
};

function describe(key, label, values, total, read) {
  const present = values.filter(usable);
  const counts = new Map();
  for (const value of present) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  if (counts.size < 2) return null;
  if (present.every((value) => typeof value === 'number') && counts.size > RANGE_AFTER) {
    return { key, label, kind: 'range', read, min: Math.min(...present), max: Math.max(...present) };
  }
  // Nearly every lead different (names, notes): not something to filter by.
  if (counts.size > MAX_CHOICES || (total > 5 && counts.size > total * 0.6)) return null;
  const options = [...counts.entries()]
    .map(([value, count]) => ({ value, label: valueLabel(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { key, label, kind: 'choice', read, options };
}

/** The filters the current leads support, prospect columns first. */
export function buildLeadFilters(leads = []) {
  const filters = BUILT_IN.map(({ key, label, read }) => describe(key, label, leads.map(read), leads.length, read));
  const keys = new Map();
  for (const lead of leads) {
    for (const [key, value] of Object.entries(lead.custom_fields || {})) {
      if (!NOT_FILTERS.has(key) && usable(value)) keys.set(key, (keys.get(key) || 0) + 1);
    }
  }
  const custom = [...keys.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => {
      const read = (lead) => (lead.custom_fields || {})[key];
      return describe(`custom.${key}`, humanize(key), leads.map(read), leads.length, read);
    });
  return [...filters, ...custom].filter(Boolean);
}

/** Leads matching every active filter: ``{key: value}`` for a choice, ``{key: {min, max}}`` for a range. */
export function applyLeadFilters(leads, filters, active) {
  const chosen = filters.filter((filter) => active[filter.key] !== undefined);
  if (!chosen.length) return leads;
  return leads.filter((lead) => chosen.every((filter) => {
    const value = filter.read(lead);
    if (filter.kind === 'range') {
      const { min, max } = active[filter.key];
      if (typeof value !== 'number') return false;
      return (min === '' || min == null || value >= Number(min)) && (max === '' || max == null || value <= Number(max));
    }
    return usable(value) && String(value) === active[filter.key];
  }));
}

/** What a chip says for an active filter. */
export function activeLabel(filter, choice) {
  if (filter.kind === 'range') {
    const { min, max } = choice;
    const has = (v) => v !== '' && v != null;
    if (has(min) && has(max)) return `${filter.label}: ${min} – ${max}`;
    return has(min) ? `${filter.label}: at least ${min}` : `${filter.label}: up to ${max}`;
  }
  return `${filter.label}: ${filter.options.find((o) => o.value === choice)?.label || choice}`;
}

/** The custom field to show in the table's detail column, or null. */
export function detailField(leads = []) {
  const key = DETAIL_KEYS.find((k) => leads.some((lead) => usable((lead.custom_fields || {})[k])));
  return key ? { key, label: humanize(key) } : null;
}

export const detailValue = (lead, field) => {
  if (field) {
    const value = (lead.custom_fields || {})[field.key];
    if (usable(value)) return valueLabel(value);
  }
  return lead.city || null;
};
