import { CALL_STATUS_FILTERS, callStatusMeta, isConnectedStatus, isNotConnectedStatus } from './callOutcome';

describe('call outcome statuses', () => {
  it('counts only "answered" as connected; a legacy "completed" is neither', () => {
    expect(isConnectedStatus('answered')).toBe(true);
    for (const status of ['completed', 'voicemail', 'unknown', 'no_answer', undefined]) {
      expect(isConnectedStatus(status)).toBe(false);
    }
    expect(isNotConnectedStatus('voicemail')).toBe(true);
    expect(isNotConnectedStatus('completed')).toBe(false);
  });

  it('labels every stored value, legacy ones included', () => {
    expect(callStatusMeta('no_answer').label).toBe('No answer');
    expect(callStatusMeta('completed').label).toBe('Ended (outcome not recorded)');
    expect(callStatusMeta('something-new').label).toBe('something-new');
    expect(callStatusMeta(null).label).toBe('Unknown');
  });

  it('filters by current values only', () => {
    const values = CALL_STATUS_FILTERS.map((option) => option.value);
    expect(values).toContain('answered');
    expect(values).not.toContain('completed');
  });
});
