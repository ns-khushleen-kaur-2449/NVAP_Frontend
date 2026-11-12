import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Minimal data-fetching hook for NVIP pages.
 *   const { data, loading, error, reload, setData } = useNvipQuery(() => workspaceApi.myAgents(), []);
 * Ignores responses that arrive after unmount or after a newer request.
 */
export function useNvipQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run();
      if (id === requestId.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === requestId.current) setState({ data: null, loading: false, error: errorMessage(err) });
    }
  }, [run]);

  useEffect(() => {
    reload();
    return () => { requestId.current += 1; };
  }, [reload]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload, setData };
}
