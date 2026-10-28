import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Clock3, FileCheck2, RefreshCw, Search, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  approveConversionDecision, getConversionEvidenceCandidates, getConversionTimeline,
  getConversionWorkspace, rejectConversionDecision, verifyConversionEvidence,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canReviewConversions, isSuperAdmin } from '@/lib/rbac';
import usePolling from '@/hooks/usePolling';
import { errorMessage } from '@/hooks/useApiAction';
import TenantPicker from '@/components/ops/TenantPicker';
import ReasonDialog from '@/components/ops/ReasonDialog';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ops/States';
import { formatDateTime, relativeTime } from '@/lib/ops';

const REFRESH_MS = 15000;
const PAGE_SIZE = 50;

const stageTone = (stage) => ({
  QUALIFIED: 'good', CONVERTED: 'accent', ENGAGED: 'info', CONTACTED: 'warn',
  DISQUALIFIED: 'bad', DO_NOT_CONTACT: 'bad',
}[stage] || 'neutral');

const decisionTone = (status) => ({
  PENDING_APPROVAL: 'warn', PROPOSED: 'warn', APPROVED: 'good', REJECTED: 'bad', EXECUTED: 'good',
}[status] || 'neutral');

const readable = (value) => String(value || 'Not available').replaceAll('_', ' ').toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const requestId = () => window.crypto?.randomUUID?.() || `conversion-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function SummaryCard({ label, value, detail, icon: Icon, tone = 'accent' }) {
  return (
    <section className="ops-card flex min-w-0 items-start justify-between gap-3 p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="ops-num mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className={`ops-tone ops-tone-${tone} inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </section>
  );
}

function DetailRow({ label, children }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="max-w-[62%] text-right text-sm font-medium">{children}</dd>
  </div>;
}

function DecisionDialog({ action, decision, scope, onClose, onDone }) {
  const rejecting = action === 'reject';
  const submit = async (reason) => {
    const body = { ...scope, reason: reason || undefined, idempotency_key: requestId() };
    try {
      if (rejecting) await rejectConversionDecision(decision.id, body);
      else await approveConversionDecision(decision.id, body);
      toast.success(rejecting ? 'Conversion decision rejected' : 'Conversion approved and stage transition executed');
      await onDone();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'The decision could not be updated. Refresh and try again.'));
      return false;
    }
  };
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title={`${rejecting ? 'Reject' : 'Approve'} conversion decision`}
      description={rejecting
        ? 'This keeps the proposal and its audit trail, but prevents a stage transition.'
        : 'The backend will revalidate policy and evidence before executing the stage transition.'}
      changes={rejecting
        ? ['The proposal will be recorded as rejected.', 'The prospect’s current stage will remain unchanged.']
        : [`The proposed stage is ${readable(decision.detail.target_stage)}.`, 'A successful review is recorded with the resulting stage event.']}
      confirmLabel={rejecting ? 'Reject decision' : 'Approve decision'} danger={rejecting}
      requireReason={rejecting} reasonLabel={rejecting ? 'Rejection reason' : 'Approval note'}
      reasonPlaceholder={rejecting ? 'Why should this conversion not proceed?' : 'Optional audit note'}
      onConfirm={submit}
    />
  );
}

function VerifyDialog({ candidate, prospectId, scope, onClose, onDone }) {
  const submit = async (reason) => {
    try {
      await verifyConversionEvidence(prospectId, {
        ...scope,
        policy_id: candidate.policy_id,
        policy_version: candidate.policy_version,
        policy_hash: candidate.policy_hash,
        criterion_code: candidate.criterion_code,
        evidence_candidate_id: candidate.evidence_candidate_id,
        verification_reason: reason,
        idempotency_key: requestId(),
      });
      toast.success('Evidence verified and queued for reassessment');
      await onDone();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'The evidence could not be verified.'));
      return false;
    }
  };
  return (
    <ReasonDialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title="Verify evidence"
      description="Confirm that this candidate is accurate. Verification is immutable and becomes part of the conversion audit trail."
      changes={[
        `${readable(candidate.criterion_code)} will be treated as verified evidence.`,
        'A conversion reassessment may be queued; no stage changes happen from this action alone.',
      ]}
      confirmLabel="Verify evidence" reasonLabel="Reviewer reason / audit note"
      reasonPlaceholder="Why is this evidence reliable?" onConfirm={submit}
    />
  );
}

function Timeline({ items }) {
  if (!items?.length) return <EmptyState title="No conversion activity yet." />;
  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const isStageEvent = item.type === 'stage_change' || item.type === 'prospect_stage';
        const icon = isStageEvent ? <CheckCircle2 className="h-4 w-4" />
          : item.type === 'evidence_candidate' ? <Sparkles className="h-4 w-4" />
            : item.type === 'review' ? <FileCheck2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />;
        const tone = isStageEvent ? 'good'
          : item.type === 'evidence_candidate' ? 'warn'
            : item.type === 'review' && item.detail.action === 'REJECTED' ? 'bad' : 'accent';
        return <li key={`${item.type}-${item.id}`} className="ops-card flex gap-3 p-3">
          <span className={`ops-tone ops-tone-${tone} mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}>{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{item.title}</p>
              <time title={formatDateTime(item.occurred_at)} className="text-xs text-muted-foreground">{relativeTime(item.occurred_at)}</time>
            </div>
            {item.type === 'decision' && <p className="mt-1 text-sm text-muted-foreground">
              {readable(item.detail.current_stage)} → {readable(item.detail.target_stage)} · {readable(item.detail.decision_status)}
            </p>}
            {item.type === 'evidence_candidate' && <p className="mt-1 text-sm text-muted-foreground">
              {readable(item.detail.criterion_code)} · {item.detail.verification_status?.toLowerCase()} · {item.detail.confidence}% confidence
            </p>}
            {isStageEvent && <p className="mt-1 text-sm text-muted-foreground">
              {readable(item.detail.from_stage)} → {readable(item.detail.to_stage)}
            </p>}
            {item.detail.reason && <p className="mt-1 text-sm text-muted-foreground">{item.detail.reason}</p>}
          </div>
        </li>;
      })}
    </ol>
  );
}

export default function ConversionWorkspace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProspectId = searchParams.get('prospect');
  const superAdmin = isSuperAdmin(user);
  const reviewer = canReviewConversions(user);
  const [tenantId, setTenantId] = useState('');
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [selectedId, setSelectedId] = useState(requestedProspectId || '');
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [dialog, setDialog] = useState(null);

  const scope = useMemo(() => superAdmin ? { tenant_id: tenantId } : {}, [superAdmin, tenantId]);
  const ready = !superAdmin || Boolean(tenantId);

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
      if (timeline.status !== 'fulfilled') throw timeline.reason;
      setDetail({
        timeline: timeline.value.data.items || [],
        evidence: evidence.status === 'fulfilled' ? evidence.value.data.items || [] : [],
        evidenceError: evidence.status === 'rejected' ? errorMessage(evidence.reason, 'Evidence is currently unavailable.') : null,
      });
    } catch (error) {
      setDetail(null);
      setDetailError(errorMessage(error, 'The selected prospect could not be loaded.'));
    }
  }, [ready, scope, selectedId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const selected = workspace?.prospects?.find((prospect) => String(prospect.prospect_id) === String(selectedId));
  const decision = detail?.timeline?.find((item) => String(item.id) === String(selected?.pending_decision_id) && item.type === 'decision');
  const latestDecision = detail?.timeline?.find((item) => item.type === 'decision');
  const activeDecision = decision || latestDecision;
  const overviewDecision = activeDecision?.detail;
  const activeTab = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Full history' },
    { id: 'evidence', label: 'Evidence', count: selected?.unverified_evidence_count },
    { id: 'decisions', label: 'Decisions' },
  ];

  const afterAction = async () => {
    setDialog(null);
    await Promise.all([loadWorkspace(), loadDetail()]);
  };

  const chooseProspect = (id) => {
    setSelectedId(String(id));
    setSearchParams({ prospect: String(id) }, { replace: true });
    setTab('overview');
  };

  return <><main className="ops mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--ops-accent-ink)]">AI SDR / sales pipeline</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Conversion Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review prospect conversion evidence and make auditable stage decisions.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {superAdmin && <TenantPicker value={tenantId} onChange={setTenantId} />}
        <OpsButton onClick={refreshWorkspace} busy={!workspace && !workspaceError}>
          <RefreshCw className="h-4 w-4" /> Refresh data
        </OpsButton>
      </div>
    </header>

    {superAdmin && !tenantId && <div className="ops-tone ops-tone-info rounded-[14px] p-4 text-sm">Select a tenant to review its Conversion work.</div>}
    {workspaceError && <ErrorState message={workspaceError} onRetry={loadWorkspace} />}

    {ready && workspace && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Awaiting approvals" value={workspace.summary.awaiting_approvals} detail="Decisions requiring review" icon={Clock3} tone="warn" />
        <SummaryCard label="Evidence to verify" value={workspace.summary.evidence_to_verify} detail="New candidates detected" icon={Sparkles} tone="warn" />
        <SummaryCard label="Qualified prospects" value={workspace.summary.qualified_prospects} detail="Current canonical stage" icon={CheckCircle2} tone="good" />
        <SummaryCard label="Converted prospects" value={workspace.summary.converted_prospects} detail="Approved transitions" icon={FileCheck2} tone="accent" />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="ops-card overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">Prospects</h2>
            <p className="mt-1 text-xs text-muted-foreground">Only prospects you are allowed to inspect.</p>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prospects"
                className="h-10 w-full rounded-lg border border-border bg-[hsl(var(--surface-2))] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ops-accent)]" />
            </label>
          </div>
          <ul className="max-h-[520px] overflow-y-auto">
            {workspace.prospects.map((prospect) => {
              const active = String(prospect.prospect_id) === String(selectedId);
              return <li key={prospect.prospect_id}>
                <button type="button" onClick={() => chooseProspect(prospect.prospect_id)}
                  className={`w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 ${active ? 'border-l-4 border-l-[var(--ops-accent)] bg-[hsl(var(--surface-2))]' : 'hover:bg-[hsl(var(--surface-2))]/70'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{prospect.full_name || 'Unnamed prospect'}</span>
                    {prospect.pending_decision_id && <StatusBadge label="Review" tone="warn" />}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{prospect.email || 'No email recorded'}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><StatusBadge label={readable(prospect.current_stage)} tone={stageTone(prospect.current_stage)} />
                    {prospect.unverified_evidence_count > 0 && <span className="text-xs font-semibold text-[color:var(--ops-accent-ink)]">{prospect.unverified_evidence_count} evidence</span>}
                  </div>
                </button>
              </li>;
            })}
            {!workspace.prospects.length && <li className="p-4"><EmptyState title="No matching prospects." /></li>}
          </ul>
        </aside>

        <section className="ops-card min-w-0 overflow-hidden">
          {!selected && <div className="p-8"><EmptyState title="Select a prospect to inspect conversion activity." /></div>}
          {selected && <>
            <div className="border-b border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-xl font-semibold">{selected.full_name || 'Unnamed prospect'}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.email || 'No email recorded'}</p></div>
                <StatusBadge label={readable(selected.current_stage)} tone={stageTone(selected.current_stage)} className="text-sm" />
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-[hsl(var(--surface-2))] p-3"><dt className="text-xs font-semibold text-muted-foreground">Current stage</dt><dd className="mt-1 font-semibold">{readable(selected.current_stage)}</dd></div>
                <div className="rounded-xl border border-border bg-[hsl(var(--surface-2))] p-3"><dt className="text-xs font-semibold text-muted-foreground">Latest qualification</dt><dd className="mt-1 font-semibold">{readable(overviewDecision?.qualification_status)}</dd></div>
                <div className="rounded-xl border border-border bg-[hsl(var(--surface-2))] p-3"><dt className="text-xs font-semibold text-muted-foreground">Proposed stage</dt><dd className="mt-1 font-semibold">{readable(overviewDecision?.target_stage)}</dd></div>
              </dl>
            </div>
            <div role="tablist" aria-label="Conversion details" className="flex overflow-x-auto border-b border-border px-3">
              {activeTab.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === item.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {item.label}{item.count > 0 && <span className="ops-num ml-1 rounded-full bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-xs">{item.count}</span>}
              </button>)}
            </div>
            <div className="min-h-[360px] p-5">
              {detailError && <ErrorState message={detailError} onRetry={loadDetail} />}
              {!detail && !detailError && <SkeletonRows rows={4} label="Loading conversion details" />}
              {detail && tab === 'overview' && <div className="space-y-5">
                <div className="ops-tone ops-tone-info rounded-xl p-4 text-sm">The prospect’s canonical stage stays <strong>{readable(selected.current_stage)}</strong> until an authorized reviewer approves an eligible decision. Evidence is verified separately.</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="ops-card p-4"><h3 className="font-semibold">Latest conversion assessment</h3><dl className="mt-2">
                    <DetailRow label="Decision status"><StatusBadge label={readable(overviewDecision?.decision_status)} tone={decisionTone(overviewDecision?.decision_status)} /></DetailRow>
                    <DetailRow label="Proposed transition">{overviewDecision?.current_stage ? `${readable(overviewDecision.current_stage)} → ${readable(overviewDecision.target_stage)}` : 'No decision recorded'}</DetailRow>
                    <DetailRow label="Missing criteria">{overviewDecision?.missing_criteria?.length ? overviewDecision.missing_criteria.map(readable).join(', ') : 'None'}</DetailRow>
                    <DetailRow label="Reason codes">{overviewDecision?.reason_codes?.length ? overviewDecision.reason_codes.map(readable).join(', ') : 'None'}</DetailRow>
                  </dl></section>
                  <section className="ops-card p-4"><h3 className="font-semibold">Recent conversion activity</h3><div className="mt-3"><Timeline items={detail.timeline.slice(0, 3)} /></div></section>
                </div>
              </div>}
              {detail && tab === 'history' && <Timeline items={detail.timeline} />}
              {detail && tab === 'evidence' && <div className="space-y-3">
                {detail.evidenceError && <div className="ops-tone ops-tone-warn rounded-xl p-4 text-sm">{detail.evidenceError}</div>}
                {!detail.evidenceError && !detail.evidence.length && <EmptyState title="No evidence candidates found." />}
                {detail.evidence.map((candidate) => <article key={candidate.evidence_candidate_id} className="ops-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{readable(candidate.criterion_code)}</h3><p className="mt-1 text-sm text-muted-foreground">{readable(candidate.source_kind)} · {candidate.extraction_confidence}% confidence</p></div><StatusBadge label={readable(candidate.verification_status)} tone={candidate.verification_status === 'VERIFIED' ? 'good' : candidate.verification_status === 'REVOKED' ? 'bad' : 'warn'} /></div>
                  <dl className="mt-3"><DetailRow label="Detected">{formatDateTime(candidate.extracted_at)}</DetailRow><DetailRow label="Evidence value">{Object.entries(candidate.extracted_value || {}).map(([key, value]) => `${readable(key)}: ${String(value)}`).join(', ') || 'Not available'}</DetailRow></dl>
                  {reviewer && candidate.verification_status !== 'VERIFIED' && <div className="mt-3"><OpsButton size="sm" variant="primary" onClick={() => setDialog({ type: 'verify', candidate })}><ShieldCheck className="h-4 w-4" /> Verify evidence</OpsButton></div>}
                </article>)}
              </div>}
              {detail && tab === 'decisions' && <div className="space-y-3">
                {!detail.timeline.filter((item) => item.type === 'decision').length && <EmptyState title="No conversion decisions for this prospect." />}
                {detail.timeline.filter((item) => item.type === 'decision').map((item) => <article key={item.id} className="ops-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{readable(item.detail.current_stage)} → {readable(item.detail.target_stage)}</h3><p className="mt-1 text-sm text-muted-foreground">Created {formatDateTime(item.occurred_at)}</p></div><StatusBadge label={readable(item.detail.decision_status)} tone={decisionTone(item.detail.decision_status)} /></div>
                  <div className="mt-3 flex flex-wrap gap-2">{(item.detail.reason_codes || []).map((code) => <StatusBadge key={code} label={readable(code)} tone="neutral" />)}</div>
                  {reviewer && String(item.id) === String(selected.pending_decision_id) && <div className="mt-4 flex flex-wrap gap-2"><OpsButton variant="primary" onClick={() => setDialog({ type: 'approve', decision: item })}><CheckCircle2 className="h-4 w-4" /> Approve</OpsButton><OpsButton variant="danger" onClick={() => setDialog({ type: 'reject', decision: item })}><XCircle className="h-4 w-4" /> Reject</OpsButton></div>}
                </article>)}
              </div>}
            </div>
          </>}
        </section>

        <aside className="space-y-4">
          <section className="ops-card p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--ops-accent-ink)]">Approval desk</p>
            {!selected?.pending_decision_id && <><h2 className="mt-2 font-semibold">No decision awaiting review</h2><p className="mt-2 text-sm text-muted-foreground">Select a prospect with a pending conversion proposal to review it here.</p></>}
            {selected?.pending_decision_id && <><div className="mt-2 flex items-center justify-between gap-2"><h2 className="font-semibold">Conversion decision</h2><StatusBadge label="Pending" tone="warn" /></div><p className="mt-3 text-sm text-muted-foreground">The backend revalidates the policy and verified evidence before approving a transition.</p><dl className="mt-3"><DetailRow label="Current stage">{readable(selected.current_stage)}</DetailRow><DetailRow label="Proposed stage">{readable(selected.pending_target_stage)}</DetailRow><DetailRow label="Authorization">{reviewer ? 'You can review this decision' : 'Read-only access'}</DetailRow></dl>
              {reviewer && activeDecision && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><OpsButton variant="primary" onClick={() => setDialog({ type: 'approve', decision: activeDecision })}><CheckCircle2 className="h-4 w-4" /> Approve</OpsButton><OpsButton variant="danger" onClick={() => setDialog({ type: 'reject', decision: activeDecision })}><XCircle className="h-4 w-4" /> Reject</OpsButton></div>}
            </>}
          </section>
          <section className="ops-card p-4"><div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-[color:var(--ops-accent-ink)]" /><h2 className="font-semibold">Audit-safe by design</h2></div><p className="mt-2 text-sm text-muted-foreground">The canonical stage lives in the prospect record. Evidence verification, decisions, reviews and executed transitions remain separately auditable.</p></section>
        </aside>
      </section>
    </>}
  </main>
    {dialog?.type === 'verify' && <VerifyDialog candidate={dialog.candidate} prospectId={selectedId} scope={scope} onClose={() => setDialog(null)} onDone={afterAction} />}
    {dialog?.type === 'approve' && <DecisionDialog action="approve" decision={dialog.decision} scope={scope} onClose={() => setDialog(null)} onDone={afterAction} />}
    {dialog?.type === 'reject' && <DecisionDialog action="reject" decision={dialog.decision} scope={scope} onClose={() => setDialog(null)} onDone={afterAction} />}
  </>;
}
