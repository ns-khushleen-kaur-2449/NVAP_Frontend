import { useState, useEffect, useCallback, useRef } from 'react';
import { getCallLogs, getCallLogDetail } from '@/lib/api';

export function useCallLogs(opts = {}) {
  const { page=1, pageSize=20, status='', sourceType='', campaignId='', assistantId='', search='', dateFrom='', dateTo='', sortBy='latest', autoRefresh=true, refreshInterval=30000 } = opts;
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
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
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load call logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, sourceType, campaignId, assistantId, search, dateFrom, dateTo, sortBy]);

  useEffect(() => { setLoading(true); fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(intervalRef.current);
    }
  }, [autoRefresh, refreshInterval, fetchLogs]);

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
