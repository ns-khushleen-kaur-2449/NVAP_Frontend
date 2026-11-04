// The copy must not promise every lead (or call) a HOT / WARM / COLD label: a lead without
// enough conversation evidence is PROVISIONAL.  Read from the page's source: the marketing
// page's animations and 3D hero do not run under jsdom, and only its words matter here.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'LandingPage.js'), 'utf8');

it('describes scoring with PROVISIONAL', () => {
  expect(source).toMatch(/or PROVISIONAL when there isn\\u2019t enough conversation evidence yet/);
  expect(source).toMatch(/or PROVISIONAL until a conversation has been assessed/);
  expect(source).toMatch(/the lead is marked PROVISIONAL instead of being guessed/);
  expect(source).toMatch(/or Provisional until there\\u2019s enough evidence/);
});

it('never says every lead or call is HOT, WARM or COLD', () => {
  expect(source).not.toMatch(/Every lead gets a score from fit and engagement, labelled HOT, WARM or COLD/);
  expect(source).not.toMatch(/Every call is scored HOT, WARM or COLD/);
  expect(source).not.toMatch(/every lead scored automatically/);
});
