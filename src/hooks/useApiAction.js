import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export const NO_PERMISSION = "You don't have permission";

/** The backend's message for a failed request: its `detail` string, `detail.message`, or the first validation error. */
export function errorMessage(error, fallback = 'Something went wrong. Try again.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail.message === 'string') return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = (detail[0].loc || []).filter((part) => part !== 'body').join('.');
    return field ? `${field}: ${detail[0].msg}` : detail[0].msg;
  }
  return fallback;
}

/**
 * Run one API action with the standard handling:
 * - `pending` while it runs;
 * - success: `toast.success(success)` (a string, or a function of the response), then `onSuccess`;
 * - 409: the backend's message, then `onConflict` (usually a refresh, the data changed);
 * - 403: "You don't have permission";
 * - anything else: the backend's message (or `failure`).
 * `run(...args)` resolves to the response, or `null` when it failed. `lastError` keeps the
 * failed error so a form can show it inline (422 field errors).
 */
export default function useApiAction(request, { success, failure, onSuccess, onConflict } = {}) {
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState(null);

  const run = useCallback(async (...args) => {
    setPending(true);
    setLastError(null);
    try {
      const response = await request(...args);
      const text = typeof success === 'function' ? success(response) : success;
      if (text) toast.success(text);
      await onSuccess?.(response, ...args);
      return response;
    } catch (error) {
      setLastError(error);
      const status = error?.response?.status;
      if (status === 403) {
        toast.error(NO_PERMISSION);
      } else if (status === 409) {
        toast.error(errorMessage(error, failure));
        await onConflict?.(error);
      } else {
        toast.error(errorMessage(error, failure));
      }
      return null;
    } finally {
      setPending(false);
    }
  }, [request, success, failure, onSuccess, onConflict]);

  return { run, pending, lastError };
}
