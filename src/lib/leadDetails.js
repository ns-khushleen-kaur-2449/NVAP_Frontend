// A lead's details: what is kept in custom_fields (the Add Lead form's details, imported "lead detail"
// columns, CRM extras). Every one the lead has is shown and editable; the Add Lead ones keep their labels.

export const DETAIL_FIELDS = [
  { key: 'project', label: 'Project', wide: true },
  { key: 'category', label: 'Category' },
  { key: 'sub_category', label: 'Sub category' },
  { key: 'budget_min', label: 'Budget min', type: 'number' },
  { key: 'budget_max', label: 'Budget max', type: 'number' },
  { key: 'location_preference', label: 'Location' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'employment', label: 'Employment', wide: true },
];

// Kept in custom_fields but not details: owner labels have their own columns, legacy_stage is internal.
const NOT_DETAILS = new Set(['assigned_to', 'lead_owner', 'legacy_stage']);
const KNOWN = Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, f]));

/** "vehicle_interested_in" -> "Vehicle interested in". */
export const detailLabel = (key) => KNOWN[key]?.label
  || String(key).replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());

const shown = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const simple = (value) => ['string', 'number', 'boolean'].includes(typeof value);

/** The editable detail fields for a lead: the Add Lead ones, then every other detail it has, in stored order. */
export function detailFieldsFor(lead) {
  const custom = lead?.custom_fields || {};
  const extra = Object.entries(custom)
    .filter(([key, value]) => !KNOWN[key] && !NOT_DETAILS.has(key) && (value === null || simple(value)))
    .map(([key, value]) => ({ key, label: detailLabel(key), type: typeof value === 'number' ? 'number' : undefined,
      wide: String(value ?? '').length > 30 }));
  return [...DETAIL_FIELDS, ...extra];
}

/** The details a lead has, for display: [{ key, label, value }], empty ones left out. */
export function leadDetailEntries(lead, { except = [] } = {}) {
  const skip = new Set(except);
  return Object.entries(lead?.custom_fields || {})
    .filter(([key, value]) => !NOT_DETAILS.has(key) && !skip.has(key) && simple(value) && shown(value))
    .map(([key, value]) => ({ key, label: detailLabel(key), value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) }));
}
