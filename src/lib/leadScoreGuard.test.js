// Guard (plan C9): lead-score screens take the temperature from the backend
// (temperature_display), never from a number.  The generic score helpers in lib/utils
// (getScoreColor / getScoreLabel: >= 70 / >= 40 → High / Medium / Low) are for other
// scores (call quality, reports) and must not colour or label a lead score.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const LEAD_SCORE_FILES = [
  'components/leads/LeadScorePanel.js',
  'components/leads/WhyThisScore.jsx',
  'components/leads/DataCompleteness.jsx',
  'components/leads/TemperatureChip.jsx',
  'components/leads/EngagementBadge.jsx',
  'components/leads/ScoreFreshnessChip.jsx',
  'components/leads/ScoreChips.jsx',
  'components/ops/LeadScoringSettings.jsx',
  'components/ops/LeadScoringOverview.jsx',
  'components/prospecting/ProspectResultRow.js',
  'components/voice/VoiceCampaignDetail.js',
  'pages/Leads.js',
];
const read = (file) => fs.readFileSync(path.join(SRC, file), 'utf8');

it.each(LEAD_SCORE_FILES)('%s uses no generic score colour or label helper', (file) => {
  const source = read(file);
  expect(source).not.toMatch(/\bgetScore(Color|Label)\b/);
});

it.each(LEAD_SCORE_FILES)('%s has no hard-coded score cut-offs', (file) => {
  const source = read(file);
  // e.g. `score >= 70`, `ai_score >= 40`, `lead_score > 69`
  expect(source).not.toMatch(/score\s*>=?\s*\d{2}\b/i);
});

it('the lead panel always gives the gauge its own colour and label', () => {
  const gauges = read('components/leads/LeadScorePanel.js').match(/<ScoreGauge[^>]*>/g) || [];
  expect(gauges.length).toBeGreaterThan(0);
  gauges.forEach((gauge) => {
    expect(gauge).toMatch(/\bcolor=\{/);
    expect(gauge).toMatch(/\blabel=\{/);
  });
});
