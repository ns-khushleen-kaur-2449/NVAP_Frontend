import { directionOf, languageOptions, missingCatalogWords, needsGender, voiceStatus } from './builderLanguages';

const LANGS = [
  { code: 'en', name: 'English', native_name: 'English', status: 'approved', direction: 'ltr',
    voice: { needs_persona_gender: false, voices: { neutral: { ready: true, problem: null } } } },
  { code: 'zz', name: 'Testish', native_name: 'Tëstish', status: 'draft', direction: 'rtl',
    voice: { needs_persona_gender: true, voices: { female: { ready: true, problem: null },
      male: { ready: false, problem: 'no voice for male' } } } },
];

it('builds options from the API only: drafts marked, a stored language it no longer has kept and flagged', () => {
  expect(languageOptions(LANGS, 'en').map((o) => o.label)).toEqual(['English', 'Testish · Tëstish (draft)']);
  expect(languageOptions(LANGS, 'multi')[0]).toEqual({ value: 'multi', label: 'multi (not available: pick a language)' });
  expect(languageOptions([], 'en')).toEqual([{ value: 'en', label: 'en (not available: pick a language)' }]);
});

it('reads direction, the gender rule and voice readiness from the pack, never from the code', () => {
  expect(directionOf(LANGS, 'zz')).toBe('rtl');
  expect(directionOf(LANGS, 'en')).toBe('ltr');
  expect(directionOf(LANGS, 'unknown')).toBe('ltr');
  expect([needsGender(LANGS, 'zz'), needsGender(LANGS, 'en')]).toEqual([true, false]);
  expect(voiceStatus(LANGS, 'en', '')).toEqual({ ready: true, problem: null });
  expect(voiceStatus(LANGS, 'zz', '').ready).toBe(false);
  expect(voiceStatus(LANGS, 'zz', 'female')).toEqual({ ready: true, problem: null });
  expect(voiceStatus(LANGS, 'zz', 'male')).toEqual({ ready: false, problem: 'no voice for male' });
  expect(voiceStatus(LANGS, 'nope', 'male')).toBeNull();
});

it('turns the catalog-words 422 into the words to add and where', () => {
  const parsed = missingCatalogWords('catalog words: the agent says or reads label, react_example, field:fuel_type, '
    + 'demo_label, which have no Testish text; add them in Catalog settings (words, demo label, field labels), or ...');
  expect(parsed.language).toBe('Testish');
  expect(parsed.items).toEqual([
    { word: 'label', where: 'Catalog settings → Words' },
    { word: 'react example', where: 'Catalog settings → Words' },
    { word: 'fuel_type', where: 'Catalog → field ⋯ → Field settings → label' },
    { word: 'demo label', where: 'Catalog settings → Demo label' },
  ]);
  expect(missingCatalogWords('first_message: unknown placeholder')).toBeNull();
});
