import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculateLeadScore, getConversionEvidenceCandidates, getConversionTimeline, getConversionWorkspace,
  reassessConversion,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canReviewConversions } from '@/lib/rbac';
import usePolling from '@/hooks/usePolling';
import { errorMessage } from '@/hooks/useApiAction';
import OpsButton from '@/components/ops/OpsButton';
import { ErrorState, SkeletonRows } from '@/components/ops/States';
import ApprovalDesk from '@/components/conversion/ApprovalDesk';
import { DecisionDialog, VerifyDialog } from '@/components/conversion/ConversionDialogs';
import KpiCards from '@/components/conversion/KpiCards';
import ProspectDetails from '@/components/conversion/ProspectDetails';
import ProspectExplorer from '@/components/conversion/ProspectExplorer';
import {
  SIDE_STAGES, STAGE_FLOW, needsAttention, readable, refineProspects, requestId,
} from '@/components/conversion/conversionUi';

const REFRESH_MS = 15000;
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export default function ConversionWorkspace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProspectId = searchParams.get('prospect');
  const reviewer = canReviewConversions(user);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sort, setSort] = useState('default');
  const [workspace, setWorkspace] = useState(null);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [selectedId, setSelectedId] = useState(requestedProspectId || '');
  // Below lg the explorer and the details are separate views; this says which one shows.
  const [detailOpen, setDetailOpen] = useState(Boolean(requestedProspectId));
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [deskOpen, setDeskOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const detailRequest = useRef(0);
  const panesRef = useRef(null);

  const scope = useMemo(() => ({}), []);
  const ready = true;

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (requestedProspectId) setSelectedId(requestedProspectId);
  }, [requestedProspectId]);

  const loadWorkspace = useCallback(async () => {
    if (!ready) return;
    try {
      const response = await getConversionWorkspace({ ...scope, q: query || undefined, page: 1, page_size: PAGE_SIZE });
      const next = response.data;
      setWorkspace(next);
      setWorkspaceError(null);
      setSelectedId((current) => {
        if (next.prospects.some((prospect) => String(prospect.prospect_id) === String(current))) return current;
        if (requestedProspectId && next.prospects.some((prospect) => String(prospect.prospect_id) === requestedProspectId)) return requestedProspectId;
        return next.prospects[0] ? String(next.prospects[0].prospect_id) : '';
      });
    } catch (error) {
      setWorkspaceError(errorMessage(error, 'The Conversion Workspace could not be loaded.'));
    }
  }, [query, ready, requestedProspectId, scope]);

  const refreshWorkspace = usePolling(loadWorkspace, REFRESH_MS, [loadWorkspace], { enabled: ready });

  const loadDetail = useCallback(async () => {
    // Only the newest request may write state, so a slow response for a previous prospect cannot overwrite the current one.
    const requestToken = ++detailRequest.current;
    if (!selectedId || !ready) {
      setDetail(null);
      return;
    }
    setDetailError(null);
    try {
      const [timeline, evidence] = await Promise.allSettled([
        getConversionTimeline(selectedId, scope),
        getConversionEvidenceCandidates(selectedId, { ...scope, page: 1, page_size: 100 }),
      ]);
      if (requestToken !== detailRequest.current) return;
      if (timeline.status !== 'fulfilled') throw timeline.reason;
      setDetail({
        timeline: timeline.value.data.items || [],
        evidence: evidence.status === 'fulfilled' ? evidence.value.data.items || [] : [],
        evidenceError: evidence.status === 'rejected' ? errorMessage(evidence.reason, 'Evidence is currently unavailable.') : null,
      });
    } catch (error) {
      if (requestToken !== detailRequest.current) return;
      setDetail(null);
      setDetailError(errorMessage(error, 'The selected prospect could not be loaded.'));
    }
  }, [ready, scope, selectedId]);

  // Clear the previous prospect's detail straight away instead of showing it under the new header.
  useEffect(() => { setDetail(null); }, [selectedId, scope]);
  // Poll with the workspace so a pending decision created elsewhere shows up without a manual refresh.
  usePolling(loadDetail, REFRESH_MS, [loadDetail], { enabled: ready && Boolean(selectedId) });

  const prospects = useMemo(() => workspace?.prospects || [], [workspace]);
  const selected = prospects.find((prospect) => String(prospect.prospect_id) === String(selectedId));
  const visible = useMemo(() => refineProspects(prospects, stageFilter, sort), [prospects, stageFilter, sort]);
  const pending = useMemo(() => prospects.filter((prospect) => prospect.pending_decision_id), [prospects]);
  const reviews = useMemo(() => prospects.filter((prospect) => prospect.review_decision_id), [prospects]);
  const waiting = (workspace?.summary.awaiting_approvals || 0) + (workspace?.summary.needs_review || 0);

  // Filter choices are the stages actually present, so a choice can never lead to an empty result by itself.
  const stageCounts = useMemo(() => prospects.reduce((counts, prospect) => ({ ...counts, [prospect.current_stage]: (counts[prospect.current_stage] || 0) + 1 }), {}), [prospects]);
  const filterOptions = useMemo(() => [
    { value: 'all', label: 'All prospects' },
    { value: 'attention', label: `Needs attention (${prospects.filter(needsAttention).length})` },
    ...[...STAGE_FLOW, ...SIDE_STAGES].filter((stage) => stageCounts[stage]).map((stage) => ({ value: stage, label: `${readable(stage)} (${stageCounts[stage]})` })),
  ], [prospects, stageCounts]);
  useEffect(() => {
    if (stageFilter !== 'all' && stageFilter !== 'attention' && !stageCounts[stageFilter]) setStageFilter('all');
  }, [stageCounts, stageFilter]);
  // A dialog opened from the Approval desk closes the drawer (two stacked modals fight over focus)
  // and brings it back once the dialog is done, so the remaining decisions are right there.
  const closeDialog = () => {
    if (dialog?.fromDesk) setDeskOpen(true);
    setDialog(null);
  };
  const afterAction = async () => {
    const fromDesk = dialog?.fromDesk;
    setDialog(null);
    await Promise.all([loadWorkspace(), loadDetail()]);
    if (fromDesk) setDeskOpen(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshWorkspace(), selectedId ? loadDetail() : null]);
    } finally {
      setRefreshing(false);
    }
  };

  // On small screens the explorer and details swap places; bring the pane that just opened into view.
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 1023px)').matches) panesRef.current?.scrollIntoView?.({ block: 'start' });
  }, [detailOpen]);

  const chooseProspect = (id) => {
    setSelectedId(String(id));
    setSearchParams({ prospect: String(id) }, { replace: true });
    setTab('overview');
    setDetailOpen(true);
  };

  // Evaluate again now, or recalculate the score first: direct actions with their own message.
  const runNow = async (type, prospect) => {
    try {
      if (type === 'recalculate') {
        await calculateLeadScore(prospect.prospect_id);
        toast.success('Score recalculated. Reassess to use it.');
      } else {
        const result = await reassessConversion(prospect.prospect_id, { ...scope, idempotency_key: requestId() });
        toast.success(`Reassessed: ${readable(result.data.decision_status)}`);
      }
      await Promise.all([loadWorkspace(), loadDetail()]);
    } catch (error) {
      toast.error(errorMessage(error, type === 'recalculate' ? 'The score could not be recalculated.' : 'The prospect could not be reassessed.'));
    }
  };

  const openDialog = (type, payload, fromDesk = false) => {
    if (type === 'reassess' || type === 'recalculate') {
      runNow(type, payload);
      return;
    }
    if (fromDesk) setDeskOpen(false);
    if (type === 'verify') setDialog({ type, candidate: payload, fromDesk });
    else setDialog({ type, decision: payload, fromDesk });
  };

  return <><main className="ops mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Conversion Workspace</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Track prospect progress, review conversion evidence and manage conversion decisions.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <OpsButton onClick={() => setDeskOpen(true)} disabled={!ready || !workspace}>
          <ClipboardCheck className="h-4 w-4" /> Approval desk
          {waiting > 0 && (
            <span className="ops-num ml-1 rounded-full bg-[var(--ops-accent)] px-1.5 text-xs font-bold text-white"
              title={`${workspace.summary.awaiting_approvals} to approve, ${workspace.summary.needs_review || 0} to review`}>{waiting}</span>
          )}
        </OpsButton>
        <OpsButton onClick={handleRefresh} busy={refreshing || (ready && !workspace && !workspaceError)}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data
        </OpsButton>
      </div>
    </header>

    {workspaceError && <ErrorState message={workspaceError} onRetry={loadWorkspace} />}

    {ready && !workspace && !workspaceError && <div className="space-y-4" aria-busy="true"><SkeletonRows rows={1} label="Loading Conversion Workspace" /><SkeletonRows rows={5} label="Loading prospects" /></div>}

    {ready && workspace && <>
      <KpiCards summary={workspace.summary} />

      <section ref={panesRef} className="grid scroll-mt-4 gap-4 lg:h-[clamp(560px,calc(100vh-15rem),820px)] lg:grid-cols-[270px_minmax(0,1fr)] lg:grid-rows-1">
        <ProspectExplorer className={detailOpen ? 'hidden lg:flex' : 'flex'}
          prospects={visible} total={workspace.total} loadedCount={prospects.length}
          selectedId={selectedId} onSelect={chooseProspect}
          search={search} onSearch={setSearch} query={query}
          stageFilter={stageFilter} onStageFilter={setStageFilter} filterOptions={filterOptions}
          sort={sort} onSort={setSort} />
        <ProspectDetails className={detailOpen ? 'flex' : 'hidden lg:flex'}
          prospect={selected} detail={detail} detailError={detailError} onRetry={loadDetail}
          tab={tab} onTab={setTab} reviewer={reviewer} onAction={openDialog} onBack={() => setDetailOpen(false)} />
      </section>
    </>}
  </main>
    <ApprovalDesk open={deskOpen} onOpenChange={setDeskOpen} pending={pending} reviews={reviews} awaiting={workspace?.summary.awaiting_approvals}
      reviewer={reviewer} onView={(id) => { chooseProspect(id); setDeskOpen(false); }} onAction={(type, payload) => openDialog(type, payload, true)} />
    {dialog?.type === 'verify' && <VerifyDialog candidate={dialog.candidate} prospectId={selectedId} scope={scope} onClose={closeDialog} onDone={afterAction} />}
    {dialog?.type === 'approve' && <DecisionDialog action="approve" decision={dialog.decision} scope={scope} onClose={closeDialog} onDone={afterAction} />}
    {dialog?.type === 'reject' && <DecisionDialog action="reject" decision={dialog.decision} scope={scope} onClose={closeDialog} onDone={afterAction} />}
    {dialog?.type === 'dismiss' && <DecisionDialog action="dismiss" decision={dialog.decision} scope={scope} onClose={closeDialog} onDone={afterAction} />}
  </>;
}
