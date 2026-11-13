import { render, screen, within } from '@testing-library/react';
import WhyThisScore from './WhyThisScore';
import { PRE_SNAPSHOT_EXPLANATION, S7_EXPLANATION, UNKNOWN_EXPLANATION } from '@/test/leadScoreFixtures';

const factor = (feature) => screen.getByTestId(`factor-${feature}`);

it('shows each factor with the earned and possible points exactly as recorded', () => {
  render(<WhyThisScore explanation={S7_EXPLANATION} />);
  expect(within(factor('seniority')).getByText('+32')).toBeInTheDocument();
  expect(factor('seniority')).toHaveTextContent('Seniority');
  expect(factor('seniority')).toHaveTextContent('Director');
  expect(factor('seniority')).toHaveTextContent('of 40');
  expect(factor('company_employee_count')).toHaveTextContent('Company size');
  expect(factor('company_employee_count')).toHaveTextContent('50–999 employees');
  expect(factor('company_employee_count')).toHaveTextContent('+20 of 20');
  expect(factor('intent_customer_status')).toHaveTextContent('Call intent');
  expect(factor('intent_customer_status')).toHaveTextContent('Medium intent');
  expect(factor('intent_customer_status')).toHaveTextContent('+19.6 of 40');
  expect(factor('intent_customer_status')).toHaveTextContent('call 45 days ago · counted ×0.7');
  expect(screen.getByTestId('group-fit')).toHaveTextContent('52 of 60');
  expect(screen.getByTestId('group-engagement')).toHaveTextContent('19.6 of 40');
  expect(screen.getByLabelText('Partial')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Strong')).toHaveLength(2);
});

it('says when information is unavailable and how it was counted', () => {
  render(<WhyThisScore explanation={S7_EXPLANATION} />);
  const department = factor('department');
  expect(department).toHaveTextContent('Information unavailable');
  expect(department).toHaveTextContent('Left out: the other factors in this group share its points.');
  expect(department).toHaveTextContent('Department is not known; this is not evidence of poor fit.');
  expect(department).toHaveTextContent('—');
  expect(screen.getByTestId('group-fit')).toHaveTextContent('Unknown factors are left out; the known ones share these points.');
});

it('shows the rounding and the threshold the score was classified with', () => {
  render(<WhyThisScore explanation={S7_EXPLANATION} />);
  expect(screen.getByTestId('rounding')).toHaveTextContent('Total 71.6 → rounded to 72 · HOT is 70–100');
});

it('shows the configuration the score was calculated with', () => {
  render(<WhyThisScore explanation={S7_EXPLANATION} />);
  const settings = screen.getByTestId('settings-used');
  expect(settings).toHaveTextContent('Settings ID: b9c23b9a');
  expect(settings).toHaveTextContent('Recorded in full (format 1) · verified');
  expect(settings).toHaveTextContent('Points: Fit 60 · Engagement 40');
  expect(settings).toHaveTextContent('Weights: Seniority 30 · Company size 15 · Department 15 · Call intent 40');
  expect(settings).toHaveTextContent('Call intent by age: ≤30 days ×1 · ≤90 days ×0.7 · ≤180 days ×0.4 · older ×0.2');
  expect(settings).toHaveTextContent('Thresholds: HOT 70–100 · WARM 40–69 · COLD 0–39');
  expect(settings).toHaveTextContent('Method: fit-engagement-v2');
});

it('shows the Data Completeness recorded with the score and what was not scored', () => {
  render(<WhyThisScore explanation={S7_EXPLANATION} />);
  expect(screen.getByTestId('data-completeness')).toHaveTextContent('Data Completeness when calculated: ●●○Medium');
  expect(screen.getByTestId('why-this-score'))
    .toHaveTextContent('Not scored, contact details: email on file: yes, email verified: no, phone on file: no.');
});

it('says "Not recorded" for what a score from before snapshots did not save, and derives nothing', () => {
  render(<WhyThisScore explanation={PRE_SNAPSHOT_EXPLANATION} />);
  expect(screen.getByTestId('data-completeness')).toHaveTextContent('Data Completeness when calculated: Not recorded');
  expect(screen.getByTestId('settings-used'))
    .toHaveTextContent('The full settings were not recorded for scores calculated before this was added.');
  expect(screen.getByTestId('rounding')).toHaveTextContent('Total 71.6 → rounded to 72');
  expect(screen.getByTestId('rounding')).not.toHaveTextContent('70–100');
  expect(screen.getByTestId('settings-used')).not.toHaveTextContent('Thresholds');
});

it('says the explanation is unavailable for a score without a recorded calculation', () => {
  render(<WhyThisScore explanation={{ available: false, reason: 'no_recorded_calculation' }} />);
  expect(screen.getByTestId('explanation-unavailable')).toHaveTextContent(
    'Why this score? Score explanation unavailable. This score has no recorded calculation (demo data). Recalculate to create one.');
  expect(screen.queryByTestId('why-this-score')).not.toBeInTheDocument();
});

it('explains a demo score in one line from what the score row records', () => {
  render(<WhyThisScore explanation={{ available: false }}
    score={{ lead_score: 87, intent_level: 'high_intent', recommended_action: 'qualification_review' }} />);
  expect(screen.getByTestId('explanation-unavailable')).toHaveTextContent(
    '87 is a demo value loaded with the seed data for a high intent lead, next step qualification review; '
    + 'it was never calculated, so it has no factor breakdown.');
});

it('sums up a recorded calculation in one line', () => {
  render(<WhyThisScore explanation={{
    available: true, rounded: 72, temperature_at_calculation: 'WARM', configuration: {}, data_completeness: {},
    groups: [
      { group: 'fit', earned: 45, possible: 60, factors: [
        { feature: 'seniority', value: 'director', indicator: 'strong', earned: 30, possible: 30 },
        { feature: 'department', value: null, indicator: 'unavailable', earned: 0, possible: 15 },
      ] },
      { group: 'engagement', earned: 27, possible: 40, factors: [
        { feature: 'intent_customer_status', value: 'medium_intent', indicator: 'partial', earned: 27, possible: 40 },
      ] },
    ],
  }} />);
  expect(screen.getByTestId('score-summary')).toHaveTextContent(
    'Scored 72 (Warm) mainly because Department is unavailable (counted as 0). '
    + 'Points came from Seniority (Director, +30) and Call intent (Medium intent, +27).');
});

it('sums up the screenshot case: missing Fit data keeps the score Cold', () => {
  render(<WhyThisScore explanation={{
    available: true, rounded: 36, temperature_at_calculation: 'COLD', configuration: {}, data_completeness: {},
    groups: [
      { group: 'fit', earned: 7.5, possible: 60, factors: [
        { feature: 'seniority', value: null, indicator: 'unavailable', earned: 0, possible: 30, treatment: 'zero_below_coverage' },
        { feature: 'company_employee_count', value: null, indicator: 'unavailable', earned: 0, possible: 15, treatment: 'zero_below_coverage' },
        { feature: 'department', value: 'engineering', indicator: 'partial', earned: 7.5, possible: 15 },
      ] },
      { group: 'engagement', earned: 28, possible: 40, factors: [
        { feature: 'intent_customer_status', value: 'medium_intent', indicator: 'partial', earned: 28, possible: 40 },
      ] },
    ],
  }} />);
  expect(screen.getByTestId('score-summary')).toHaveTextContent(
    'Scored 36 (Cold) mainly because Seniority and Company size are unavailable (counted as 0). '
    + 'Points came from Call intent (Medium intent, +28) and Department (Engineering, +7.5).');
});

it('mentions unavailable factors that were left out of a hot score', () => {
  render(<WhyThisScore explanation={{
    available: true, rounded: 80, temperature_at_calculation: 'HOT', configuration: {}, data_completeness: {},
    groups: [{ group: 'fit', earned: 60, possible: 60, factors: [
      { feature: 'seniority', value: 'vp', indicator: 'strong', earned: 40, possible: 40 },
      { feature: 'department', value: null, indicator: 'unavailable', earned: null, possible: null, treatment: 'left_out_rescaled' },
    ] }],
  }} />);
  expect(screen.getByTestId('score-summary')).toHaveTextContent(
    'Scored 80 (Hot), mainly from Seniority (VP, +40). '
    + 'Department is unavailable and left out; the other factors share its points.');
});

it('marks an inconclusive assessment and keeps its recorded points', () => {
  render(<WhyThisScore explanation={UNKNOWN_EXPLANATION} />);
  const intent = factor('intent_customer_status');
  expect(intent).toHaveTextContent('Inconclusive');
  expect(intent).toHaveTextContent('inconclusive assessment, not evidence of buying interest');
  expect(intent).toHaveTextContent('+8 of 40');
  expect(screen.getByLabelText('Inconclusive')).toBeInTheDocument();
  expect(screen.getByTestId('rounding')).toHaveTextContent('Total 39.5 → rounded to 40 · WARM is 40–69');
});

it('shows every number as sent, never recalculating it', () => {
  const odd = {
    ...S7_EXPLANATION,
    unrounded: 33.3,
    rounded: 33,
    groups: [{ group: 'fit', earned: 33.3, possible: 41, rescaled: false, below_min_coverage: false,
      factors: [{ feature: 'seniority', value: 'vp', indicator: 'weak', earned: 33.3, possible: 41, weight: 30 }] }],
  };
  render(<WhyThisScore explanation={odd} />);
  expect(factor('seniority')).toHaveTextContent('+33.3 of 41');
  expect(screen.getByTestId('group-fit')).toHaveTextContent('33.3 of 41');
  expect(screen.getByTestId('rounding')).toHaveTextContent('Total 33.3 → rounded to 33');
});

it('names an unknown factor readably and treats zero-counted factors honestly', () => {
  const explanation = {
    ...S7_EXPLANATION,
    turned_off: ['department'],
    groups: [{
      group: 'fit', earned: 15, possible: 60, rescaled: false, below_min_coverage: true,
      factors: [
        { feature: 'custom_signal', value: 'some_value', indicator: 'partial', earned: 15, possible: 30, weight: 30 },
        { feature: 'seniority', value: null, indicator: 'unavailable', earned: 0, possible: 30, weight: 30,
          treatment: 'zero_below_coverage' },
      ],
    }, {
      group: 'engagement', earned: 0, possible: 40, rescaled: false, below_min_coverage: true,
      factors: [{ feature: 'intent_customer_status', value: null, indicator: 'unavailable', earned: 0, possible: 40,
        weight: 40, treatment: 'zero', note: 'No accepted intent assessment: not evidence of low interest.' }],
    }],
  };
  render(<WhyThisScore explanation={explanation} />);
  expect(factor('custom_signal')).toHaveTextContent('Custom signal');
  expect(factor('custom_signal')).toHaveTextContent('Some value');
  expect(factor('seniority')).toHaveTextContent('Counted as 0: less than half of this group is known.');
  expect(factor('intent_customer_status')).toHaveTextContent('Counted as 0. This is not evidence of low interest.');
  expect(screen.getByTestId('group-fit')).toHaveTextContent('Less than half of this group is known');
  expect(screen.getByTestId('why-this-score')).toHaveTextContent('⊘ Turned off in your scoring settings: Department');
});

it('shows an explanation without groups as its recorded rows', () => {
  const v1 = { available: true, unrounded: 30, rounded: 30, groups: null, configuration: { recorded_in_full: false },
    data_completeness: { recorded: false },
    factors: [{ feature: 'seniority', value: 'vp', indicator: null, earned: 30, possible: null, weight: 1 }] };
  render(<WhyThisScore explanation={v1} />);
  expect(factor('seniority')).toHaveTextContent('VP');
  expect(factor('seniority')).toHaveTextContent('+30');
  expect(screen.getByTestId('data-completeness')).toHaveTextContent('Not recorded');
});
