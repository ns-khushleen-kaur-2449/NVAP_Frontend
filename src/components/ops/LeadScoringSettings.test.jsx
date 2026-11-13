import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import LeadScoringSettings, { rescoreMessage, saveMessage } from './LeadScoringSettings';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = require('@/lib/api');
const { toast } = require('sonner');

const HASH = 'a'.repeat(64);
const param = (parameter, label, group, extra = {}) => ({
  parameter, label, group, feature: parameter, configurable: true, enabled: true, base_weight: 10, effective_weight: 10, ...extra,
});
const config = (disabled = []) => ({
  data: {
    tenant_id: 't1', methodology_version: 'v2', config_hash: HASH, default_config_hash: HASH, tenant_override: false, disabled,
    parameters: [
      param('seniority', 'Seniority', 'fit', { enabled: !disabled.includes('seniority') }),
      param('company_size', 'Company size', 'fit', { enabled: !disabled.includes('company_size') }),
      param('department', 'Department', 'fit', { enabled: !disabled.includes('department') }),
      param('intent_status', 'Intent status', 'engagement', { configurable: false }),
      param('intent_freshness', 'Intent freshness adjustment', 'engagement', { base_weight: null, effective_weight: null }),
    ],
    group_weights: { fit: 60, engagement: 40 },
    thresholds: [{ label: 'HOT', min: 70, max: 100 }, { label: 'WARM', min: 40, max: 69 }, { label: 'COLD', min: 0, max: 39 }],
  },
});

// The overview of 20 prospects: every panel reconciles (5 + 9 categories = 20; current 14 = 9 + 5).
const OVERVIEW = {
  tenant_id: 't1', as_of: '2026-11-03T08:00:00Z', population: 20,
  classification: { classified: 9, provisional: 5, stale: 2, pending_calculation: 3, no_score_recorded: 1,
    classified_by_temperature: { HOT: 2, WARM: 4, COLD: 3 } },
  score_freshness: { current: 14, stale: 2, stale_recalculable: 1,
    recalculation_due: { total: 4, settings_changed: 3, methodology_changed: 0, new_intent: 1, intent_aged: 1,
      details_changed: 0, demo_score: 0 } },
  assessment: { total: 20,
    categories: { assessed: 6, aged: 2, outdated: 1, assessed_unknown: 1, not_contacted: 5, pending: 2,
      no_result_recorded: 1, failed: 1, not_assessed: 1 },
    pending_breakdown: { being_assessed: 1, waiting_for_review: 1 },
    of_which_latest_call: { pending: 0, no_result_recorded: 1, failed: 1, rejected: 0, skipped: 0,
      unrecognized: 0 },
    of_which_earlier_assessment: { outdated: 1, unknown: 0, unrecognized: 0 } },
  data_completeness: { high: 4, medium: 6, low: 2, not_recorded: 2 },
  thresholds: { pending_timeout_minutes: 15, pending_timeout_final: false },
  automatic_refresh_enabled: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  api.getLeadScoringConfig.mockResolvedValue(config());
  api.getLeadScoringConfigHistory.mockResolvedValue({ data: { items: [] } });
  api.getLeadScoringOverview.mockResolvedValue({ data: OVERVIEW });
});

const box = (name) => screen.getByRole('checkbox', { name });
const open = async (user) => { renderWithAuth(<LeadScoringSettings />, { user, path: '/settings' }); await screen.findByText('Seniority'); };

describe('Lead overview', () => {
  const count = (testId) => screen.getByTestId(testId).lastChild.textContent;

  it('shows the four panels with their totals, each counting every prospect once', async () => {
    await open(USERS.tenant_admin);
    await screen.findByTestId('lead-overview');
    expect(api.getLeadScoringOverview).toHaveBeenCalledWith({});
    expect(screen.getByTestId('panel-classification-total')).toHaveTextContent('5 categories = 20 prospects');
    expect(count('classification-classified')).toBe('9');
    expect(count('classification-pending_calculation')).toBe('3');
    expect(count('classification-no_score_recorded')).toBe('1');
    expect(screen.getByTestId('panel-classification')).toHaveTextContent('of which HOT2');
    expect(count('freshness-current')).toBe('14');
    expect(count('freshness-due')).toBe('4');
    expect(screen.getByTestId('panel-freshness')).toHaveTextContent('scoring settings changed3');
    expect(screen.getByTestId('panel-freshness')).toHaveTextContent('A lead can have several reasons.');
    expect(screen.getByTestId('panel-freshness')).toHaveTextContent('they are not current scores');
    expect(screen.getByTestId('panel-assessment-total')).toHaveTextContent('9 categories = 20 prospects');
    expect(count('assessment-no_result_recorded')).toBe('1');
    expect(count('assessment-failed')).toBe('1');
    expect(screen.getByTestId('assessment-no_result_recorded')).toHaveTextContent('No result recorded yet');
    expect(screen.getByTestId('panel-completeness-total')).toHaveTextContent('= 14 current scores');
    expect(count('completeness-not_recorded')).toBe('2');
  });

  it('shows sub-counts as "of which", never as categories', async () => {
    await open(USERS.tenant_admin);
    await screen.findByTestId('lead-overview');
    expect(screen.getByTestId('of-which-latest-failed')).toHaveTextContent('of which latest call Failed');
    expect(screen.getByTestId('of-which-earlier-outdated')).toHaveTextContent('of which earlier assessment Outdated');
    expect(screen.queryByTestId('of-which-latest-rejected')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-assessment')).toHaveTextContent('of which waiting for review1');
  });

  it('explains No result recorded yet as not a failure', async () => {
    await open(USERS.tenant_admin);
    await screen.findByTestId('lead-overview');
    expect(screen.getByTestId('assessment-no_result_recorded').getAttribute('title'))
      .toMatch(/more than 15 minutes ago .* not a confirmed failure/);
    expect(screen.getByTestId('assessment-failed').getAttribute('title')).toMatch(/failure was recorded/);
  });

  it('says when the assessment status is not available', async () => {
    api.getLeadScoringOverview.mockResolvedValue({ data: { ...OVERVIEW, assessment: null } });
    await open(USERS.tenant_admin);
    expect(await screen.findByText('The assessment status is not available.')).toBeInTheDocument();
  });

  it('keeps the settings usable when the overview cannot load', async () => {
    api.getLeadScoringOverview.mockRejectedValue({ response: { status: 500, data: { detail: 'Overview failed' } } });
    await open(USERS.tenant_admin);
    expect(await screen.findByText(/Overview failed/)).toBeInTheDocument();
    expect(box('Seniority')).toBeChecked();
  });
});

describe('Recalculating scores', () => {
  it('runs one pass for a Tenant Admin and says what happened', async () => {
    api.rescoreLeadScores.mockResolvedValue({ data: { tenant_id: 't1', scored: 3, fresh: 1, no_fit_data: 2, missing: 0, failed: 0 } });
    await open(USERS.tenant_admin);
    fireEvent.click(await screen.findByRole('button', { name: 'Recalculate scores' }));
    expect(await screen.findByTestId('rescore-result')).toHaveTextContent(
      "Recalculated 3 scores. 1 score was already up to date. 2 leads can't be scored until seniority, department or company size is added.");
    expect(api.rescoreLeadScores).toHaveBeenCalledWith({ limit: 100 });
    await waitFor(() => expect(api.getLeadScoringOverview).toHaveBeenCalledTimes(2)); // counts refreshed
  });

  it('is not offered to a Manager', async () => {
    await open(USERS.manager);
    await screen.findByTestId('lead-overview');
    expect(screen.queryByRole('button', { name: 'Recalculate scores' })).not.toBeInTheDocument();
  });

  it('says when it failed, and that nothing changed', async () => {
    api.rescoreLeadScores.mockRejectedValue({ response: { status: 503, data: { detail: 'Lead scoring is not available' } } });
    await open(USERS.tenant_admin);
    fireEvent.click(await screen.findByRole('button', { name: 'Recalculate scores' }));
    expect(await screen.findByTestId('rescore-result')).toHaveTextContent('Lead scoring is not available');
  });

  it('words every result honestly', () => {
    expect(rescoreMessage({ scored: 0, fresh: 0, no_fit_data: 0, missing: 0, failed: 0 }))
      .toBe('Every score is up to date. Nothing to recalculate.');
    expect(rescoreMessage({ scored: 1, fresh: 0, no_fit_data: 0, missing: 0, failed: 2 }))
      .toBe('Recalculated 1 score. 2 leads could not be scored; nothing was changed for them.');
    expect(rescoreMessage({ scored: 100, fresh: 0, no_fit_data: 0, missing: 0, failed: 0 }))
      .toMatch(/More may be waiting: run it again\.$/);
  });
});

describe('Honest texts', () => {
  it('shows the thresholds as fixed text and explains PROVISIONAL', async () => {
    await open(USERS.tenant_admin);
    const thresholds = screen.getByTestId('thresholds');
    expect(thresholds).toHaveTextContent('Temperature thresholds (fixed)');
    expect(thresholds).toHaveTextContent('HOT 70–100 · WARM 40–69 · COLD 0–39');
    expect(thresholds).toHaveTextContent('It is not a score range.');
    expect(within(thresholds).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(thresholds).queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('says what a save does to scores, by whether automatic refresh is on', () => {
    expect(saveMessage(true)).toMatch(/recalculated in the background/);
    expect(saveMessage(false)).toMatch(/until they are recalculated: use "Recalculate scores"/);
    expect(saveMessage(undefined)).not.toMatch(/background/);
    [true, false, undefined].forEach((automatic) => expect(saveMessage(automatic)).not.toMatch(/are being refreshed/));
  });
});

it('shows parameters, weights and thresholds', async () => {
  await open(USERS.tenant_admin);
  expect(box('Seniority')).toBeChecked();
  expect(screen.getByText(/HOT 70–100 · WARM 40–69 · COLD 0–39/)).toBeInTheDocument();
  expect(screen.getByText(/fit · 60 points/i)).toBeInTheDocument();
  expect(api.getLeadScoringConfig).toHaveBeenCalledWith({});
});

it('is read-only for a Manager', async () => {
  await open(USERS.manager);
  expect(screen.getByText('View only.')).toBeInTheDocument();
  expect(box('Seniority')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('lets a Tenant Admin edit, but never intent status', async () => {
  await open(USERS.tenant_admin);
  expect(box('Seniority')).toBeEnabled();
  expect(box('Intent status')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('blocks switching off every Fit parameter', async () => {
  await open(USERS.tenant_admin);
  ['Seniority', 'Company size', 'Department'].forEach((n) => fireEvent.click(box(n)));
  expect(screen.getByText(/At least one Fit parameter must stay on/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('undo restores the saved state', async () => {
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  expect(box('Department')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
  expect(box('Department')).toBeChecked();
});

it('saves with the reason and the config hash it loaded', async () => {
  api.updateLeadScoringConfig.mockResolvedValue({ data: { ...config(['department']).data, changed: true } });
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  fireEvent.click(box('Intent freshness adjustment'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Department: on → off')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Not useful for us' } });
  api.getLeadScoringConfig.mockResolvedValue(config(['department', 'intent_freshness']));
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).pop());
  await waitFor(() => expect(api.updateLeadScoringConfig).toHaveBeenCalledTimes(1));
  expect(api.updateLeadScoringConfig).toHaveBeenCalledWith(
    { disabled: ['department', 'intent_freshness'], reason: 'Not useful for us', expected_config_hash: HASH }, {});
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  await waitFor(() => expect(api.getLeadScoringConfig).toHaveBeenCalledTimes(2)); // reloaded
});

describe('After a save, with automatic refresh', () => {
  const saveDepartmentOff = async () => {
    api.updateLeadScoringConfig.mockResolvedValue({ data: { ...config(['department']).data, changed: true } });
    await open(USERS.tenant_admin);
    fireEvent.click(box('Department'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: 'Not useful' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).pop());
    await waitFor(() => expect(api.updateLeadScoringConfig).toHaveBeenCalledTimes(1));
  };
  const due = (total) => ({ data: { ...OVERVIEW, automatic_refresh_enabled: true,
    score_freshness: { ...OVERVIEW.score_freshness, recalculation_due: { ...OVERVIEW.score_freshness.recalculation_due, total } } } });

  it('follows the recalculation without "Recalculate scores" until nothing is due', async () => {
    api.getLeadScoringOverview.mockResolvedValue(due(3));
    await saveDepartmentOff();
    expect(await screen.findByTestId('auto-refresh')).toHaveTextContent('Updating scores with the new settings');
    api.getLeadScoringOverview.mockResolvedValue(due(0));  // the consumer recalculated them
    await waitFor(() => expect(screen.queryByTestId('auto-refresh')).not.toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId('freshness-due')).toHaveTextContent('0');
    expect(api.rescoreLeadScores).not.toHaveBeenCalled();
  }, 10000);

  it('does not follow anything when automatic refresh is off', async () => {
    await saveDepartmentOff();  // OVERVIEW: automatic_refresh_enabled false
    await waitFor(() => expect(api.getLeadScoringConfig).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('auto-refresh')).not.toBeInTheDocument();
  });
});

it('reloads after a 409 conflict', async () => {
  api.updateLeadScoringConfig.mockRejectedValue({ response: { status: 409, data: { detail: { message: 'changed since read' } } } });
  await open(USERS.tenant_admin);
  fireEvent.click(box('Department'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: 'x' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).pop());
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('changed since read'));
  await waitFor(() => expect(api.getLeadScoringConfig).toHaveBeenCalledTimes(2));
});

it('lists the change history', async () => {
  api.getLeadScoringConfigHistory.mockResolvedValue({ data: { items: [{
    event_id: 1, reason: 'QA test', created_at: '2026-10-30T11:35:26Z', new_value: { disabled: ['department'] },
  }] } });
  await open(USERS.tenant_admin);
  expect(screen.getByText('Change history (1)')).toBeInTheDocument();
  expect(screen.getByText('“QA test”')).toBeInTheDocument();
  expect(screen.getByText('Turned off: Department')).toBeInTheDocument();
});

it('shows an error with retry when loading fails', async () => {
  api.getLeadScoringConfig.mockRejectedValue({ response: { status: 503, data: { detail: 'Lead scoring is not available' } } });
  renderWithAuth(<LeadScoringSettings />, { user: USERS.tenant_admin, path: '/settings' });
  expect(await screen.findByText(/Lead scoring is not available/)).toBeInTheDocument();
});
