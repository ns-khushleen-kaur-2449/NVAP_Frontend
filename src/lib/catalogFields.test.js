import { PLAIN_WORD_LANGUAGE, republishMessage, wordIn, wordLanguages, withWord } from './catalogFields';

it('names the agents a catalog change left without words in their language', () => {
  const text = republishMessage({ republish_scheduled: true, delay_seconds: 30, drafts: [],
    missing_words: [{ name: 'Sara (Arabic)', words: ['label', 'field:fuel_type', 'demo_label'] }] });
  expect(text).toContain('Your agents will update in about 30 seconds.');
  expect(text).toContain("Sara (Arabic) was not updated: it says or reads label, the fuel_type field's name, demo label");
  expect(republishMessage({ republish_scheduled: false, drafts: [] })).toBeNull();
});

it('reads the languages words may be written in from the settings response', () => {
  expect(wordLanguages({ options: { language_names: { en: 'English', zz: 'Testish' } } }))
    .toEqual([{ code: 'en', name: 'English' }, { code: 'zz', name: 'Testish' }]);
  expect(wordLanguages(null)).toEqual([]);
});

it('keeps a plain word as the plain-word language and adds others as a map', () => {
  expect(wordIn('car', PLAIN_WORD_LANGUAGE)).toBe('car');
  expect(wordIn('car', 'zz')).toBe('');
  expect(withWord('car', 'zz', 'zar')).toEqual({ [PLAIN_WORD_LANGUAGE]: 'car', zz: 'zar' });
  expect(withWord({ [PLAIN_WORD_LANGUAGE]: 'car', zz: 'zar' }, 'zz', '')).toBe('car');
});
