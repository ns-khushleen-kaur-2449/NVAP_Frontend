import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import usePolling from '@/hooks/usePolling';
import ReasonDialog from './ReasonDialog';
import { contactMenuItems } from '@/components/voice/VoiceCampaignDetail';
import { campaignBanner, insideWindow } from '@/lib/campaignView';
import { formatDateTime, maskPhone, notificationLink, planToasts, relativeTime, toastText } from '@/lib/ops';
import { formatDuration, formatRate, formatCount, initials } from '@/lib/voiceDashboard';
import { ruleErrors } from './RulesSettings';
import { revertSummary } from '@/pages/DoNotCall';
import { USERS } from '@/test/renderWithAuth';

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

function Poller({ fn }) {
  usePolling(fn, 1000);
  return null;
}

describe('usePolling', () => {
  beforeEach(() => { jest.useFakeTimers(); setHidden(false); });
  afterEach(() => { jest.useRealTimers(); setHidden(false); });

  it('runs at once, then every interval, and stops while the tab is hidden', () => {
    const fn = jest.fn();
    render(<Poller fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(fn).toHaveBeenCalledTimes(4);
    act(() => { setHidden(true); });
    act(() => { jest.advanceTimersByTime(10000); });
    expect(fn).toHaveBeenCalledTimes(4); // nothing while hidden
    act(() => { setHidden(false); });
    expect(fn).toHaveBeenCalledTimes(5); // visible again: at once
    act(() => { jest.advanceTimersByTime(1000); });
    expect(fn).toHaveBeenCalledTimes(6);
  });
});

describe('KPI formatting', () => {
  it('shows "—" for null, whole percentages and m:ss', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0.353)).toBe('35%');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(115)).toBe('1:55');
    expect(formatDuration(7)).toBe('0:07');
  });

  it('splits initials on spaces, hyphens and underscores', () => {
    expect(initials('Riya -ns1')).toBe('RN');
    expect(initials('Priya_AISDR')).toBe('PA');
  });
});

describe('ReasonDialog', () => {
  it('does not confirm until a reason (not just spaces) is given', async () => {
    const onConfirm = jest.fn().mockResolvedValue(true);
    const onOpenChange = jest.fn();
    render(<ReasonDialog open onOpenChange={onOpenChange} title="Pause campaign" changes={['No new calls are placed.']}
      confirmLabel="Pause" onConfirm={onConfirm} />);
    expect(screen.getByText('No new calls are placed.')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Pause' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: ' Wrong lead list ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Wrong lead list'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe('role gating of contact row actions', () => {
  const row = {
    actions: [
      { action: 'requeue', enabled: false, reason: 'On do-not-call list — revert the opt-out first' },
      { action: 'remove', enabled: true, reason: null },
    ],
  };
  it('gives Tenant Admins and Managers the menu, with the reason a disabled action is off', () => {
    for (const user of [USERS.tenant_admin, USERS.manager]) {
      const items = contactMenuItems(row, user);
      expect(items.map((i) => i.action)).toEqual(['requeue', 'remove']);
      expect(items[0]).toMatchObject({ enabled: false, reason: 'On do-not-call list — revert the opt-out first' });
    }
  });
  it('gives Sales Reps and Super Admins (view only) no menu', () => {
    expect(contactMenuItems(row, USERS.rep)).toEqual([]);
    expect(contactMenuItems(row, USERS.super_admin)).toEqual([]);
  });
});

describe('toasts', () => {
  const n = (id, severity) => ({ id, severity, title: `T${id}`, body: null });
  it('shows at most 3 new warnings / criticals and collapses the rest into +N more', () => {
    const list = [n(1, 'warning'), n(2, 'critical'), n(3, 'info'), n(4, 'warning'), n(5, 'warning'), n(6, 'critical')];
    const { shown, more } = planToasts(list, new Set());
    expect(shown.map((x) => x.id)).toEqual([1, 2, 4]);
    expect(more).toBe(2);
  });
  it('never repeats a notification already seen', () => {
    expect(planToasts([n(1, 'warning'), n(2, 'warning')], new Set([1, 2]))).toEqual({ shown: [], more: 0 });
  });
  it('reads as one line with the reason', () => {
    expect(toastText({ title: 'Aditi Attri cancelled Thu 23 Oct, 3:00 PM IST', body: 'No reason given (cancelled from calendar)' }))
      .toBe('Aditi Attri cancelled Thu 23 Oct, 3:00 PM IST — No reason given (cancelled from calendar)');
  });
  it('links each notification to its page', () => {
    expect(notificationLink({ entity_type: 'appointment', entity_id: 'a1' })).toBe('/operations/appointments?open=a1');
    expect(notificationLink({ entity_type: 'campaign', entity_id: 'c1' })).toBe('/voice-campaigns/c1');
    expect(notificationLink({ entity_type: 'unknown', entity_id: 'x' })).toBeNull();
  });
});

describe('ops formatting', () => {
  const now = new Date('2026-10-21T06:00:00Z');
  it('writes past and future relative times', () => {
    expect(relativeTime('2026-10-21T05:44:00Z', now)).toBe('16 min ago');
    expect(relativeTime('2026-10-21T09:00:00Z', now)).toBe('in 3 h');
    expect(relativeTime(null, now)).toBe('—');
  });
  it('shows times in the given zone, naming it', () => {
    expect(formatDateTime('2026-10-23T09:30:00Z', 'Asia/Kolkata', now)).toBe('Fri 23 Oct, 3:00 PM IST');
  });
  it('masks phone numbers like the backend', () => {
    expect(maskPhone('+919876543412')).toBe('+91 98••• ••412');
  });
});

describe('campaign banner', () => {
  it('names who paused it, when and why', () => {
    const banner = campaignBanner({ status: 'paused', paused_by_kind: 'user', paused_at: '2026-10-21T05:50:00Z',
      last_transition: { actor: { name: 'Rahul' }, reason_text: 'Wrong lead list' } }, 'Asia/Kolkata');
    expect(banner).toEqual({ kind: 'user_pause', tone: 'warn', text: 'Paused by Rahul at 11:20 — “Wrong lead list”' });
  });
  it('asks for a credits top-up after a credits pause', () => {
    expect(campaignBanner({ status: 'paused', paused_by_kind: 'system', pause_reason_code: 'vapi_credits',
      last_transition: { reason_text: 'Vapi credits exhausted. Top up, then Resume.' } }, 'UTC').kind).toBe('credits');
  });
  it('waits for calls to finish while cancelling, and shows Waiting from the backend label', () => {
    expect(campaignBanner({ status: 'cancelling', in_flight_calls: 2 }, 'UTC').text).toBe('Cancelling — waiting for 2 calls to finish');
    expect(campaignBanner({ status: 'processing', waiting: true, display_label: 'Waiting — next call Thu 10:00, 2 contacts deferred' }, 'UTC'))
      .toMatchObject({ kind: 'waiting', text: 'Waiting — next call Thu 10:00, 2 contacts deferred' });
  });
  it('checks a picked time against the calling window', () => {
    const window = { days: ['thu'], start_time: '10:00', end_time: '18:00' };
    expect(insideWindow(window, '2026-10-22', '10:30')).toBe(true); // a Thursday
    expect(insideWindow(window, '2026-10-22', '18:00')).toBe(false);
    expect(insideWindow(window, '2026-10-23', '11:00')).toBe(false);
    expect(insideWindow(null, '', '')).toBe(true);
  });
});

describe('settings validation and revert summary', () => {
  it('validates numbers against the bounds the backend sends', () => {
    const fields = { daily_cap: { type: 'integer', min: 1, max: 20 }, auto_no_show: { type: 'boolean' } };
    expect(ruleErrors({ daily_cap: 25, auto_no_show: true }, fields)).toEqual({ daily_cap: 'At most 20.' });
    expect(ruleErrors({ daily_cap: 3 }, fields)).toEqual({});
  });
  it('says what a revert changed', () => {
    expect(revertSummary({ restored_stage: 'ENGAGED', requeued_contact_ids: [1, 2], requeued_scheduled_call_ids: [] }))
      .toBe('Stage restored to ENGAGED · 2 campaign contacts requeued');
  });
});
