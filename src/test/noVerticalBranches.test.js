/**
 * CI check: no frontend code branches on a vertical's name.  The same rules as the backend's
 * app/tests/test_no_vertical_branches.py: a comparison, switch case, includes() or startsWith() against a
 * preset key or label fails.  LEGACY_INDUSTRY_KEYS (the Industry field's mapping of the two old keys) is the one
 * allowed mention.  Test files are not scanned.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const VERTICALS = path.resolve(SRC, '..', '..', 'smartsdr-platform', 'app', 'features', 'catalog', 'verticals');
const ALLOWED = 'LEGACY_INDUSTRY_KEYS';
// When the backend is not next to the frontend (a frontend-only checkout): the presets as of this check.
const KNOWN_PRESETS = { automobile: 'car dealership', real_estate: 'real estate business' };

function presetNames() {
  const presets = { ...KNOWN_PRESETS };
  if (fs.existsSync(VERTICALS)) {
    for (const file of fs.readdirSync(VERTICALS).filter((f) => f.endsWith('.yaml'))) {
      const label = JSON.parse(fs.readFileSync(path.join(VERTICALS, file), 'utf8')).words?.label;
      presets[file.replace(/\.yaml$/, '')] = label || '';
    }
  }
  return Object.entries(presets).flatMap(([key, label]) => [key, key.replace(/_/g, ' '), label]).filter(Boolean);
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function frontendBranches(source, filename = '<js>') {
  const names = presetNames().sort((a, b) => b.length - a.length).map(escape).join('|');
  const quoted = `(['"\`])(?:${names})\\1`;
  const patterns = [`(?:===|!==|==|!=)\\s*${quoted}`, `${quoted}\\s*(?:===|!==|==|!=)`, `\\bcase\\s+${quoted}\\s*:`,
    `\\.includes\\(\\s*${quoted}\\s*\\)`, `\\.startsWith\\(\\s*${quoted}\\s*\\)`].map((p) => new RegExp(p, 'i'));
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

it('catches branches on vertical names and allows the legacy key mapping', () => {
  expect(frontendBranches("if (vertical === 'automobile') {}")).toHaveLength(1);
  expect(frontendBranches('const x = "Real estate" == label;')).toHaveLength(1);
  expect(frontendBranches("switch (v) { case 'real_estate': break; }")).toHaveLength(1);
  expect(frontendBranches("if (label.includes('car dealership')) {}")).toHaveLength(1);
  expect(frontendBranches("const LEGACY_INDUSTRY_KEYS = { automobile: 'Automobile dealership' };")).toEqual([]);
  expect(frontendBranches('if (industryValue(vertical) === preset) {}')).toEqual([]);
});

it('finds no frontend code that branches on a vertical name', () => {
  const problems = sourceFiles(SRC).flatMap((file) => frontendBranches(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)));
  expect(problems).toEqual([]);
});
