// Plain-language labels for catalog fields and settings, and the rules the backend applies to them.
// Types and match modes mirror app/features/catalog/field_types.py; importance mirrors editor.DEFAULT_WEIGHT.

export const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'yes_no', label: 'Yes/No' },
  { value: 'choice', label: 'List (pick one)' },
  { value: 'multi_choice', label: 'List (pick several)' },
];

export const MODES_BY_TYPE = {
  text: ['exact', 'contains'],
  number: ['exact', 'at_least', 'at_most', 'range'],
  yes_no: ['exact'],
  choice: ['exact'],
  multi_choice: ['contains'],
};

export const MODE_LABELS = {
  exact: 'Must match', at_least: 'At least', at_most: 'At most', range: 'Within a range', contains: 'Contains',
};

export const hasOptions = (type) => type === 'choice' || type === 'multi_choice';
// Synonyms map what leads say to a stored value; only text and lists store words.
export const takesSynonyms = (type) => type === 'text' || hasOptions(type);

/** The match mode a field of `type` uses when `mode` is not one of its own. */
export const modeFor = (type, mode) => {
  const modes = MODES_BY_TYPE[type] || ['exact'];
  return modes.includes(mode) ? mode : modes[0];
};

// Importance is the field's weight: Low 1, Normal 2 (new fields), High 3. Other values are kept as "Custom".
export const IMPORTANCE = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'High' },
];
export const importanceLabel = (weight) =>
  IMPORTANCE.find((i) => i.value === Number(weight))?.label || `Custom (${weight})`;

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
];

// The tenant's fields: every column but the fixed name, category and price.
export const fieldColumns = (columns) => columns.filter((c) => !['name', 'category', 'price'].includes(c.key));

/** What turning on matching did to a field, from the field before and the PATCH result. */
export function matchingNote(before, after) {
  if (after.note) return `${after.label}: ${after.note}.`;
  if (before.type !== after.type && hasOptions(after.type)) {
    const count = after.allowed_values?.length || 0;
    return `${after.label}: converted to a list (pick one) with ${count} value${count === 1 ? '' : 's'}.`;
  }
  return null;
}

/** What a catalog change means for the agents (`agents` in every mutating response), or null for nothing to say. */
export function republishMessage(agents) {
  if (!agents) return null;
  const parts = [];
  if (agents.republish_scheduled) {
    const seconds = Math.max(1, Math.round(agents.delay_seconds || 30));
    parts.push(`Your agents will update in about ${seconds} second${seconds === 1 ? '' : 's'}.`);
  }
  if (agents.drafts?.length) {
    parts.push(`Not updated because ${agents.drafts.length === 1 ? 'it has' : 'they have'} unpublished changes: `
      + `${agents.drafts.join(', ')}. Publish ${agents.drafts.length === 1 ? 'it' : 'them'} to give `
      + `${agents.drafts.length === 1 ? 'it' : 'them'} this change.`);
  }
  return parts.length ? parts.join(' ') : null;
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameObject = (a = {}, b = {}) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** The PATCH /fields/{key} body for what the settings form changed (agent_visible goes to /visibility). */
export function fieldChanges(column, form) {
  const body = {};
  if (form.label.trim() !== column.label) body.label = form.label.trim();
  const labels = Object.fromEntries(Object.entries(form.labels).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
  if (!sameObject(labels, column.labels || {})) body.labels = labels;
  if (form.type !== column.type) body.type = form.type;
  if (form.matchable !== Boolean(column.matchable)) body.matchable = form.matchable;
  const mode = modeFor(form.type, form.match_mode);
  if (mode !== column.match_mode) body.match_mode = mode;
  if (hasOptions(form.type) && !sameList(form.allowed_values, column.allowed_values || [])) {
    body.allowed_values = form.allowed_values;
  }
  const synonyms = Object.fromEntries(form.synonyms.filter((s) => s.said.trim() && String(s.meant).trim())
    .map((s) => [s.said.trim().toLowerCase(), s.meant]));
  if (!sameObject(synonyms, column.synonyms || {})) body.synonyms = synonyms;
  if (!sameList(form.aliases, column.aliases || [])) body.aliases = form.aliases;
  if (form.ask_lead !== Boolean(column.ask_lead)) body.ask_lead = form.ask_lead;
  if (Number(form.weight) !== Number(column.weight)) body.weight = Number(form.weight);
  return body;
}

// Catalog settings words (tenant_settings.WORD_KEYS), as the settings form and preset picker name them.
// `ask` is per field and `default_category` has its own control, so neither is listed here.
export const WORD_LABELS = {
  label: 'Kind of business',
  product: 'What you sell (one)',
  products: 'What you sell (many)',
  visit: 'The visit you offer',
  curiosity: 'What to be curious about',
  open_need: 'Opening question about their need',
  budget: 'How to say budget',
  timeline: 'How to ask about timing',
  react_example: 'Example reactions',
  link_example: 'Example of linking to their words',
};

/** A word as one language reads it: a plain string is every language's, else {language: text} with English as fallback. */
export function wordIn(value, language) {
  if (value && typeof value === 'object') return value[language] ?? '';
  return language === 'en' ? (value ?? '') : '';
}

/** A word with one language's text changed: a plain string while only English is set, else {language: text}. */
export function withWord(value, language, text) {
  const current = value && typeof value === 'object' ? { ...value } : (value ? { en: value } : {});
  if (text.trim()) current[language] = text; else delete current[language];
  const languages = Object.keys(current);
  if (!languages.length) return null;
  return languages.length === 1 && languages[0] === 'en' ? current.en : current;
}

export const wordText = (value) => (value && typeof value === 'object' ? (value.en || Object.values(value)[0] || '') : (value || ''));

export const percent = (fraction) => Math.round(Number(fraction || 0) * 1000) / 10;

/** A refusal in plain words: the backend's own message (it names the products in the way), else a fallback. */
export function refusalText(e, fallback) {
  if (e?.response?.status === 403) return 'You can view this but not change it.';
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => (typeof d === 'string' ? d : d.msg)).join('; ');
  return fallback;
}
