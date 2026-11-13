// The languages an agent may speak, as GET /api/v1/assistant-builder/languages returns them (approved language
// packs; drafts only for internal test tenants and Super Admins, marked status "draft"). Nothing here knows a
// language code: every rule reads the list. Mirrors app/features/assistant_builder/languages.py.

/** One select option per language; a draft says so; a stored value the list no longer has stays visible, marked. */
export function languageOptions(languages = [], current) {
  const options = languages.map((l) => ({
    value: l.code,
    label: `${l.name}${l.native_name && l.native_name !== l.name ? ` · ${l.native_name}` : ''}${l.status === 'draft' ? ' (draft)' : ''}`,
  }));
  if (current && !languages.some((l) => l.code === current)) {
    options.unshift({ value: current, label: `${current} (not available: pick a language)` });
  }
  return options;
}

export const languageOf = (languages = [], code) => languages.find((l) => l.code === code) || null;

/** The text direction the agent's own words are written in ("rtl" for Arabic script packs), "ltr" when unknown. */
export const directionOf = (languages, code) => languageOf(languages, code)?.direction || 'ltr';

/** The pack needs the agent's gender (its own words change with it); save refuses without one. */
export const needsGender = (languages, code) => Boolean(languageOf(languages, code)?.voice?.needs_persona_gender);

/**
 * Voice readiness for the chosen language and gender: { ready, problem }.  A language that needs a gender is ready
 * only for the gender picked; one that does not reads its single voice.
 */
export function voiceStatus(languages, code, gender) {
  const voice = languageOf(languages, code)?.voice;
  if (!voice) return null;
  const slot = voice.needs_persona_gender ? (gender || null) : 'neutral';
  if (!slot) return { ready: false, problem: 'Pick the agent\'s gender: this language needs it, and its voice depends on it.' };
  const entry = voice.voices?.[slot];
  return entry ? { ready: entry.ready, problem: entry.problem } : { ready: false, problem: `No voice for ${slot}.` };
}

/**
 * The catalog-words 422 ("catalog words: the agent says or reads label, field:fuel_type, which have no Arabic text;
 * ...") as the words to add and where.  null when the message is about something else.
 */
export function missingCatalogWords(message) {
  const match = /^catalog words: the agent says or reads (.+?), which have no (.+?) text;/.exec(message || '');
  if (!match) return null;
  const items = match[1].split(', ').map((word) => {
    if (word.startsWith('field:')) return { word: word.slice(6), where: 'Catalog → field ⋯ → Field settings → label' };
    if (word === 'demo_label') return { word: 'demo label', where: 'Catalog settings → Demo label' };
    return { word: word.replace(/_/g, ' '), where: 'Catalog settings → Words' };
  });
  return { language: match[2], items };
}
