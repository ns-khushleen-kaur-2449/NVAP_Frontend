import { buildChanges, compareRows, displayValue, errorText, fieldLabel, initialDraft } from './assistantRequests';
import { canProposeAssistantChanges, canReviewAssistantChanges, canUseAssistantRequests } from './rbac';
import { notificationLink } from './ops';

const ASSISTANT = { id: 7, name: 'Riya', firstMessage: 'Hello!', systemPrompt: 'Be brief.', modelTemperature: 0.7,
  maxDurationSeconds: 600, language: null, serverUrl: 'https://example.invalid' };

describe('buildChanges', () => {
  it('keeps only the fields that changed, by API name', () => {
    const draft = { ...initialDraft(ASSISTANT), firstMessage: 'Hi there', modelTemperature: '0.4' };
    expect(buildChanges(ASSISTANT, draft)).toEqual({ changes: { firstMessage: 'Hi there', modelTemperature: 0.4 }, invalid: [] });
  });

  it('proposes nothing for an untouched form, and never wiring fields', () => {
    const { changes } = buildChanges(ASSISTANT, initialDraft(ASSISTANT));
    expect(changes).toEqual({});
    expect(Object.keys(initialDraft(ASSISTANT))).not.toEqual(expect.arrayContaining(['serverUrl', 'isLive']));
  });

  it('reports number fields that are not numbers', () => {
    const { invalid } = buildChanges(ASSISTANT, { ...initialDraft(ASSISTANT), modelTemperature: 'hot' });
    expect(invalid).toEqual(['Model temperature']);
  });

  it('clearing a text field proposes null', () => {
    const { changes } = buildChanges(ASSISTANT, { ...initialDraft(ASSISTANT), systemPrompt: '  ' });
    expect(changes).toEqual({ systemPrompt: null });
  });
});

describe('compareRows', () => {
  it('lines up current and proposed values and marks fields changed since the request', () => {
    const rows = compareRows({
      proposed_changes: { first_message: 'Hi', system_prompt: 'New' },
      current_values: { first_message: 'Admin edit', system_prompt: 'Be brief.' },
      stale_fields: ['first_message'],
    });
    expect(rows).toEqual([
      { field: 'first_message', label: 'First message', current: 'Admin edit', proposed: 'Hi', stale: true },
      { field: 'system_prompt', label: 'System prompt', current: 'Be brief.', proposed: 'New', stale: false },
    ]);
  });
});

it('formats labels, values and API errors', () => {
  expect(fieldLabel('voice_speed')).toBe('Voice speed');
  expect(displayValue(null)).toBe('—');
  expect(displayValue({ a: 1 })).toContain('"a": 1');
  expect(errorText({ response: { data: { detail: 'Stale' } } })).toBe('Stale');
  expect(errorText({ response: { data: { detail: [{ msg: 'bad' }] } } })).toBe('bad');
  expect(errorText(new Error('x'), 'Fallback')).toBe('Fallback');
});

it('mirrors the backend roles', () => {
  expect(['super_admin', 'tenant_admin', 'manager', 'rep'].map((role) => [
    canProposeAssistantChanges({ role }), canReviewAssistantChanges({ role }), canUseAssistantRequests({ role }),
  ])).toEqual([[false, false, false], [false, true, true], [false, true, true], [true, false, true]]);
  expect(canUseAssistantRequests(null)).toBe(false);
});

it('links a change-request notification to the request', () => {
  expect(notificationLink({ entity_type: 'assistant_change_request', entity_id: '12' }))
    .toBe('/voice_agent?tab=requests&open=12');
});
