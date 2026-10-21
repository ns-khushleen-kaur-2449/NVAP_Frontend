import { useState, useEffect, useCallback, useRef } from 'react';
import { getCallLogs, getCallLogDetail } from '@/lib/api';

// While a visible call is still going or its analysis is on its way ("Analysing…"), refresh fast.
export const ACTIVE_REFRESH_MS = 5000;

/** True when a row is still in progress or waiting for its analysis (both flags come from the API). */
export const isLive = (log) => Boolean(log?.in_progress || log?.analysis_pending);

export function useCallLogs(opts = {}) {
  const { page=1, pageSize=20, status='', sourceType='', campaignId='', assistantId='', search='', dateFrom='', dateTo='', sortBy='latest', autoRefresh=true, refreshInterval=30000 } = opts;
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasRows = useRef(false);
  // Set from each answer: the next refresh comes in 5 s while any row is live, else `refreshInterval`.
  const anyLive = useRef(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { page, page_size: pageSize, sort_by: sortBy };
      if (status) params.status = status;
      if (sourceType) params.source_type = sourceType;
      if (campaignId) params.campaign_id = campaignId;
      if (assistantId) params.assistant_id = assistantId;
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await getCallLogs(params);
      const data = res.data || res;
      // Rows are keyed by id, so replacing the list updates them in place.
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      hasRows.current = (data.logs || []).length > 0;
      anyLive.current = (data.logs || []).some(isLive);
      setError(null);
    } catch (err) {
      // A failed background refresh keeps the rows on screen; only an empty list shows the error.
      if (!hasRows.current) {
        setError(err?.response?.data?.detail || 'Failed to load call logs');
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, sourceType, campaignId, assistantId, search, dateFrom, dateTo, sortBy]);

  // A filter change shows the loading state until its first answer.
  useEffect(() => { setLoading(true); hasRows.current = false; }, [fetchLogs]);

  const polling = autoRefresh && refreshInterval > 0;

  // Fetches now, then again after each answer while the tab is visible (paused while it is hidden).
  useEffect(() => {
    let timer = null;
    let stopped = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && polling && !document.hidden) timer = setTimeout(run, anyLive.current ? ACTIVE_REFRESH_MS : refreshInterval);
    };
    const run = async () => { await fetchLogs(); schedule(); };
    const onVisibility = () => { clearTimeout(timer); if (!document.hidden && polling) run(); };
    run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [fetchLogs, polling, refreshInterval]);

  const refresh = useCallback(() => { setLoading(true); return fetchLogs(); }, [fetchLogs]);
  return { logs, total, totalPages, loading, error, refresh };
}

export function useCallLogDetail(callId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async (id) => {
    const targetId = id || callId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCallLogDetail(targetId);
      setDetail(res.data || res);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load call detail');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => { if (callId) fetchDetail(); }, [callId, fetchDetail]);
  return { detail, loading, error, fetchDetail };
}
