/**
 * CI check: no frontend code branches on a language code.  The same rules as the backend's
 * app/tests/test_no_language_branches.py and this folder's noVerticalBranches.test.js: a comparison, switch case,
 * includes() or startsWith() against a language code fails.  Everything that depends on the language comes from
 * GET /api/v1/assistant-builder/languages (the pack's direction, whether it needs a gender, voice readiness) or the
 * catalog settings' ``language_names``.  PLAIN_WORD_LANGUAGE (src/lib/catalogFields.js: what a plain-string catalog
 * word is written in) is the one allowed mention.  Test files are not scanned.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const I18N = path.resolve(SRC, '..', '..', 'smartsdr-platform', 'app', 'features', 'assistant_builder', 'i18n');
const ALLOWED = 'PLAIN_WORD_LANGUAGE';
// When the backend is not next to the frontend (a frontend-only checkout): the packs as of this check, and the legacy
// stored values ("hinglish", "multi").
const KNOWN_CODES = ['en', 'hi', 'ar', 'fr', 'es', 'multi', 'hinglish'];

function languageCodes() {
  const codes = new Set(KNOWN_CODES);
  if (fs.existsSync(I18N)) {
    for (const file of fs.readdirSync(I18N).filter((f) => f.endsWith('.py'))) {
      for (const match of fs.readFileSync(path.join(I18N, file), 'utf8').matchAll(/Meta\(code="([a-z-]+)"/g)) codes.add(match[1]);
    }
  }
  return [...codes];
}

export function languageBranches(source, filename = '<js>') {
  const codes = languageCodes().sort((a, b) => b.length - a.length).join('|');
  const quoted = `(['"\`])(?:${codes})\\1`;
  const patterns = [`(?:===|!==|==|!=)\\s*${quoted}`, `${quoted}\\s*(?:===|!==|==|!=)`, `\\bcase\\s+${quoted}\\s*:`,
    `\\.includes\\(\\s*${quoted}\\s*\\)`, `\\.startsWith\\(\\s*${quoted}\\s*\\)`].map((p) => new RegExp(p));
  return source.split('\n').flatMap((line, i) => (
    !line.includes(ALLOWED) && patterns.some((p) => p.test(line)) ? [`${filename}:${i + 1}: ${line.trim().slice(0, 120)}`] : []));
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

it('catches branches on language codes and allows the plain-word constant', () => {
  expect(languageBranches("if (language === 'hi') {}")).toHaveLength(1);
  expect(languageBranches('const rtl = "ar" == code;')).toHaveLength(1);
  expect(languageBranches("switch (lang) { case 'fr': break; }")).toHaveLength(1);
  expect(languageBranches("if (['en', 'hi'].includes('es')) {}")).toHaveLength(1);
  expect(languageBranches("if (value.startsWith('multi')) {}")).toHaveLength(1);
  expect(languageBranches("export const PLAIN_WORD_LANGUAGE = 'en';")).toEqual([]);
  expect(languageBranches('if (directionOf(languages, code) === \'rtl\') {}')).toEqual([]);
  expect(languageBranches("return language === PLAIN_WORD_LANGUAGE ? value : '';")).toEqual([]);
});

it('finds no frontend code that branches on a language code', () => {
  const problems = sourceFiles(SRC).flatMap((file) => languageBranches(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)));
  expect(problems).toEqual([]);
});
