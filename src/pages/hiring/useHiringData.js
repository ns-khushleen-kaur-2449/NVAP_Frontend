import { useCallback, useEffect, useRef, useState } from 'react';
import usePolling from '@/hooks/usePolling';

/**
 * Load one Hiring resource: `{ data, error, reload }`.
 *
 * `data` keeps the last answer while a reload runs, so a refresh never blanks the screen, and an answer that
 * arrives after a newer request (a search typed on) is dropped. With `pollMs`, it reloads on that interval while
 * the browser tab is visible (hooks/usePolling).
 */
export default function useHiringData(request, deps, { pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const response = await request();
      if (mine !== latest.current) return;
      setData(response.data);
      setError(null);
    } catch (e) {
      if (mine === latest.current) setError(e);
    }
  // `deps` is the caller's list of what `request` reads (as for useEffect), so it cannot be checked here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { if (!pollMs) load(); }, [load, pollMs]);
  usePolling(load, pollMs || 30000, [load], { enabled: pollMs > 0 });

  return { data, error, reload: load };
}
