// Lead-field selection, opener placeholders and prompt display for the Agent Builder.
// Mirrors app/features/assistant_builder/lead_fields.py and first_message.py; the backend
// validates everything again on save (422), this only keeps the form honest. Nothing here assumes a language:
// the words an agent says come from its language pack on the server.

/** What each usage lets the agent do, one short line each. */
export const USAGES = [
  { value: 'greet', label: 'Greet', hint: 'May say it in the greeting and now and then after.' },
  { value: 'context', label: 'Context', hint: 'May mention it to make the call personal.' },
  { value: 'confirm_only', label: 'Confirm only', hint: 'Confirms it when needed; never brings it up.' },
  { value: 'never_say', label: 'Never say', hint: 'Uses it to guide the call; never says it.' },
];

export const MASK_LABELS = {
  none: 'Full value',
  email_hint: 'How it ends ("…gmail dot com")',
  last4: 'Last 4 digits',
};

// Masked by default: the agent only knows how an email or number ends (it asks for the full
// email when it books). The backend's own default for email is unmasked; the UI chooses safer.
const SAFE_MASKS = { email: 'email_hint', phone: 'last4' };
const SAFE_USAGES = { first_name: 'greet', last_name: 'greet', email: 'confirm_only', phone: 'confirm_only' };

/** New agents start by greeting leads by first name, and nothing else. */
export const DEFAULT_LEAD_FIELDS = [{ key: 'first_name', usage: 'greet', mask: 'none', label: '' }];

/** The selection a field gets when it is ticked: a safe usage and mask the field allows. */
export function defaultSelection(field) {
  const usage = SAFE_USAGES[field.key] && field.usages.includes(SAFE_USAGES[field.key])
    ? SAFE_USAGES[field.key]
    : field.usages.includes('context') ? 'context' : field.usages[0];
  const safeMask = SAFE_MASKS[field.key];
  const mask = safeMask && field.masks.includes(safeMask) ? safeMask : field.default_mask || 'none';
  return { key: field.key, usage, mask, label: '' };
}

/** The registry rows to show: standard fields, then custom ones (including selected keys no lead has now). */
export function registryGroups(registry, selected = []) {
  const standard = registry?.standard || [];
  const custom = [...(registry?.custom || [])];
  for (const s of selected) {
    if (s.key.startsWith('custom.') && !custom.some((f) => f.key === s.key)) {
      custom.push({ key: s.key, label: s.key.slice(7).replace(/_/g, ' '), usages: USAGES.map((u) => u.value),
        masks: ['none'], default_mask: 'none' });
    }
  }
  return [
    { id: 'standard', title: 'Lead details', fields: standard },
    { id: 'custom', title: 'Custom fields from your leads', fields: custom },
  ];
}

const greets = (leadFields, key) => leadFields.some((f) => f.key === key && f.usage === 'greet');

/** Every problem in one list, for the preview panel. */
export const allProblems = (problems) => [...problems.first_message, ...problems.default_call_reason, ...problems.lead_fields,
  ...problems.language, ...problems.persona_gender, ...problems.catalog_words, ...problems.general];

/** Placeholders a custom first message may use: the name ones only when first name is selected to greet. */
export function placeholdersFor(leadFields = []) {
  const named = greets(leadFields, 'first_name');
  return [
    ...(named ? [
      { token: '{salutation}', label: 'Greeting', hint: 'The greeting with the first name, in the agent\'s language; without a name when we don\'t know it' },
      { token: '{customer_name}', label: 'First name', hint: 'Left out when we don\'t know it' },
    ] : []),
    { token: '{agent_name}', label: 'Agent name' },
    { token: '{company}', label: 'Company' },
    { token: '{call_reason}', label: 'Call reason', hint: "The campaign's reason, else your default" },
  ];
}

/**
 * A 422 from preview or save, split by field. The builder answers either a list of plain
 * strings ("first_message: ...") or Pydantic errors ({loc, msg}).
 */
// Plain-string 422s by their prefix (app/features/assistant_builder/languages.py, speech.py, first_message.py).
const STRING_FIELDS = [['first_message', 'first_message'], ['assistant.language:', 'language'],
  ['assistant.persona_gender:', 'persona_gender'], ['catalog words:', 'catalog_words']];

export function problemsFrom(error) {
  const detail = error?.response?.data?.detail;
  const result = { first_message: [], lead_fields: [], default_call_reason: [], language: [], persona_gender: [],
    catalog_words: [], general: [] };
  const items = typeof detail === 'string' ? [detail] : Array.isArray(detail) ? detail : [];
  for (const item of items) {
    if (typeof item === 'string') {
      const [prefix, field] = STRING_FIELDS.find(([p]) => item.startsWith(p)) || [];
      if (field === 'language' || field === 'persona_gender') result[field].push(item.slice(prefix.length).trim());
      else (field ? result[field] : result.general).push(item);  // catalog words keep their full text (parsed later)
      continue;
    }
    const loc = (item?.loc || []).filter((p) => p !== 'body');
    const message = String(item?.msg || '').replace(/^Value error, /, '');
    const field = ['first_message', 'lead_fields', 'default_call_reason'].find((f) => loc.includes(f));
    if (field) result[field].push(message);
    else result.general.push(loc.length ? `${loc.join('.')}: ${message}` : message);
  }
  return result;
}

const PROTECTED = /<!-- smartsdr:([a-z-]+):start -->\n?([\s\S]*?)\n?<!-- smartsdr:\1:end -->/g;
const BLOCK_TITLES = { tools: 'Tools you can use', 'call-flow': 'Call flow', language: 'Language' };

/** The prompt as plain parts and protected blocks (between smartsdr markers), in order. */
export function splitProtected(prompt = '') {
  const parts = [];
  let last = 0;
  for (const match of prompt.matchAll(PROTECTED)) {
    if (match.index > last) parts.push({ type: 'text', text: prompt.slice(last, match.index).replace(/\n+$/, '') });
    parts.push({ type: 'protected', name: match[1], title: BLOCK_TITLES[match[1]] || match[1], text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < prompt.length) parts.push({ type: 'text', text: prompt.slice(last).replace(/^\n+/, '') });
  return parts.filter((p) => p.type === 'protected' || p.text);
}
