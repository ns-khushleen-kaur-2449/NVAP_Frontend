import { useCallback, useEffect, useRef } from 'react';

/**
 * Call `fn` now and then every `intervalMs` while the browser tab is visible.
 *
 * Hidden tab: no timer runs. Visible again: `fn` runs at once, then the timer
 * restarts. `deps` restart it (for example when a filter changes). Returns
 * `refresh`, which runs `fn` immediately. `fn` may be async; its errors are the
 * caller's to handle (keep them inside `fn`).
 */
export default function usePolling(fn, intervalMs = 30000, deps = [], { enabled = true } = {}) {
  const latest = useRef(fn);
  latest.current = fn;

  const refresh = useCallback(() => latest.current?.(), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const start = () => {
      if (!timer) timer = setInterval(() => latest.current?.(), intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        latest.current?.();
        start();
      }
    };
    latest.current?.();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled, ...deps]);

  return refresh;
}
