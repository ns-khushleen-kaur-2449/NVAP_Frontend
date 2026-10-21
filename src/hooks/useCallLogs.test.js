import { act, renderHook, waitFor } from '@testing-library/react';
import { getCallLogs } from '@/lib/api';
import { ACTIVE_REFRESH_MS, isLive, useCallLogs } from './useCallLogs';

jest.mock('@/lib/api', () => ({ getCallLogs: jest.fn(), getCallLogDetail: jest.fn() }));

const page = (logs) => ({ data: { logs, total: logs.length, total_pages: 1 } });
const ended = { id: 1, status: 'answered', in_progress: false, analysis_pending: false };
const live = { id: 2, status: 'in-progress', in_progress: true, analysis_pending: false };
const analysing = { id: 2, status: 'answered', in_progress: false, analysis_pending: true, status_label: 'Analysing…' };

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  jest.useFakeTimers();
  getCallLogs.mockReset();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
afterEach(() => jest.useRealTimers());

const tick = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

test('isLive covers in-progress and analysing rows only', () => {
  expect(isLive(live)).toBe(true);
  expect(isLive(analysing)).toBe(true);
  expect(isLive(ended)).toBe(false);
});

test('polls every 5 s while a call is live, then slows to 30 s once it settles', async () => {
  getCallLogs.mockResolvedValueOnce(page([live, ended]))
    .mockResolvedValueOnce(page([analysing, ended]))
    .mockResolvedValue(page([{ ...analysing, analysis_pending: false, status_label: null }, ended]));
  const { result } = renderHook(() => useCallLogs());
  await waitFor(() => expect(result.current.logs).toHaveLength(2));
  expect(getCallLogs).toHaveBeenCalledTimes(1);

  await tick(ACTIVE_REFRESH_MS);
  await waitFor(() => expect(result.current.logs[0].status_label).toBe('Analysing…'));
  expect(result.current.loading).toBe(false); // background refreshes never flash the loader

  await tick(ACTIVE_REFRESH_MS);
  await waitFor(() => expect(result.current.logs[0].analysis_pending).toBe(false));
  const settled = getCallLogs.mock.calls.length;

  await tick(ACTIVE_REFRESH_MS * 2);
  expect(getCallLogs.mock.calls.length).toBe(settled);
  await tick(30000);
  expect(getCallLogs.mock.calls.length).toBe(settled + 1);
});

test('no polling while the tab is hidden', async () => {
  getCallLogs.mockResolvedValue(page([live]));
  const { result } = renderHook(() => useCallLogs());
  await waitFor(() => expect(result.current.logs).toHaveLength(1));
  const before = getCallLogs.mock.calls.length;
  act(() => setHidden(true));
  await tick(ACTIVE_REFRESH_MS * 4);
  expect(getCallLogs.mock.calls.length).toBe(before);
  act(() => setHidden(false));
  await waitFor(() => expect(getCallLogs.mock.calls.length).toBe(before + 1));
});

test('a failed background refresh keeps the rows on screen', async () => {
  getCallLogs.mockResolvedValueOnce(page([live])).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useCallLogs());
  await waitFor(() => expect(result.current.logs).toHaveLength(1));
  await tick(ACTIVE_REFRESH_MS);
  await waitFor(() => expect(getCallLogs).toHaveBeenCalledTimes(2));
  expect(result.current.logs).toHaveLength(1);
  expect(result.current.error).toBeNull();
});
