// Column mapping for the Catalog CSV import (backend catalog/import_mapping.py). A column can only become a
// catalog field: name, category, price, id, stock_location, stock_units, field:<key> (the tenant's own),
// general:<key> (a general catalog field such as brand or color, added on import), new, ignore.
// A file of people (leads) is never mapped (preview.blocked).

export const FIXED_USES = [
  { value: 'name', label: 'Product name (required)' },
  { value: 'category', label: 'Category' },
  { value: 'price', label: 'Price' },
  { value: 'id', label: 'Product ID' },
  { value: 'stock_location', label: 'Stock: location' },
  { value: 'stock_units', label: 'Stock: units' },
];
export const NEW_FIELD = { value: 'new', label: 'New field' };
export const IGNORE = { value: 'ignore', label: 'Don’t import' };
// Uses only one column may have (the backend refuses two).
const SINGLE = new Set(FIXED_USES.map((u) => u.value));

/**
 * The uses a column can be given, in groups for the dropdown: the product columns, the tenant's own fields,
 * the general catalog fields it does not have yet, and other (a new field, or not imported).
 */
export function columnUseGroups(preview) {
  return [
    { label: 'Product', options: FIXED_USES },
    { label: 'Your fields', options: (preview?.fields || []).map((f) => ({ value: `field:${f.key}`, label: f.label })) },
    { label: 'General catalog fields', options: (preview?.general_fields || []).map((f) => ({ value: `general:${f.key}`, label: f.label })) },
    { label: 'Other', options: [NEW_FIELD, IGNORE] },
  ].filter((group) => group.options.length > 0);
}

/** Every use as one flat list (for labels). */
export const columnUseOptions = (preview) => columnUseGroups(preview).flatMap((g) => g.options);

const isSingle = (use) => SINGLE.has(use) || use.startsWith('field:') || use.startsWith('general:');

/** The suggested mapping from a preview: { column: use }. */
export const suggestedMapping = (preview) =>
  Object.fromEntries((preview?.columns || []).map((c) => [c.column, c.suggested]));

/**
 * What is wrong with a mapping, as messages (empty when it can be imported):
 * no product name column, or two columns given the same single use.
 */
export function mappingProblems(mapping, options = []) {
  const problems = [];
  const uses = Object.values(mapping);
  if (!uses.includes('name')) problems.push('Choose the column that holds the product name.');
  const byUse = {};
  Object.entries(mapping).forEach(([column, use]) => {
    if (isSingle(use)) (byUse[use] = byUse[use] || []).push(column);
  });
  Object.entries(byUse).forEach(([use, columns]) => {
    if (columns.length > 1) {
      const label = options.find((o) => o.value === use)?.label || use;
      problems.push(`${columns.join(' and ')} are all set to “${label}”; choose one.`);
    }
  });
  if (uses.includes('stock_location') !== uses.includes('stock_units')) {
    problems.push('Stock needs both a location column and a units column (or neither).');
  }
  return problems;
}
