import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ops/States';
import {
  approveAssistantChangeRequest, getAssistant, getAssistantChangeRequest, getAssistants, listAssistantChangeRequests,
  rejectAssistantChangeRequest, submitAssistantChangeRequest, withdrawAssistantChangeRequest,
} from '@/lib/api';
import {
  PROPOSABLE_FIELDS, REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES, buildChanges, compareRows, displayValue, errorText,
  fieldLabel, initialDraft,
} from '@/lib/assistantRequests';
import { canProposeAssistantChanges, canReviewAssistantChanges } from '@/lib/rbac';
import { formatDateTime } from '@/lib/ops';

const ALL = 'all';

function RequestStatus({ status }) {
  return <StatusBadge label={REQUEST_STATUS_LABELS[status] || status} tone={REQUEST_STATUS_TONES[status]} />;
}

/** Field | current | proposed, with fields changed since the request marked. */
function CompareTable({ request }) {
  const rows = compareRows(request);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">Setting</TableHead>
          <TableHead>{request.status === 'pending' ? 'Current' : 'Before'}</TableHead>
          <TableHead>Proposed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.field}>
            <TableCell className="align-top font-medium">
              {row.label}
              {row.stale && <div className="mt-1"><StatusBadge label="Changed since request" tone="warn" /></div>}
            </TableCell>
            <TableCell className="align-top whitespace-pre-wrap break-words text-muted-foreground">
              {displayValue(request.status === 'pending' ? row.current : request.base_values?.[row.field])}
            </TableCell>
            <TableCell className="align-top whitespace-pre-wrap break-words">{displayValue(row.proposed)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** One request: reason, comparison, outcome, and the actions the viewer may take. */
export function RequestDetail({ requestId, canReview, canWithdraw, onChanged, onClose }) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState('');
  const feedbackId = useId();

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await getAssistantChangeRequest(requestId);
      setRequest(res.data);
    } catch (e) {
      setError(errorText(e, 'This request could not be loaded.'));
    }
  }, [requestId]);

  useEffect(() => { setRequest(null); setFeedback(''); load(); }, [load]);

  const act = async (kind) => {
    if (kind === 'reject' && !feedback.trim()) {
      toast.error('Add feedback so the Sales Rep knows what to change.');
      return;
    }
    setBusy(kind);
    try {
      const res = kind === 'approve' ? await approveAssistantChangeRequest(requestId, feedback.trim())
        : kind === 'reject' ? await rejectAssistantChangeRequest(requestId, feedback.trim())
          : await withdrawAssistantChangeRequest(requestId);
      setRequest(res.data);
      toast.success(kind === 'approve' ? 'Approved: the assistant was updated.'
        : kind === 'reject' ? 'Rejected with feedback.' : 'Request withdrawn.');
      onChanged?.();
    } catch (e) {
      toast.error(errorText(e, 'That did not go through.'));
      load();
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!request) return <SkeletonRows rows={3} label="Loading request" />;
  const pending = request.status === 'pending';
  const stale = (request.stale_fields || []).length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{request.assistant_name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested by {request.requested_by_name || 'a former user'} · {formatDateTime(request.created_at)} ·
            {' '}{request.routed_to === 'manager' ? `for ${request.reviewer_name || 'their Manager'}` : 'for Tenant Admins'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RequestStatus status={request.status} />
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.reason}</p>
        </div>
        {request.assistant_id == null && (
          <p role="status" className="text-sm text-muted-foreground">This assistant has been deleted.</p>
        )}
        {pending && stale && (
          <p role="alert" className="ops-tone ops-tone-warn rounded-lg px-3 py-2 text-sm">
            The assistant changed after this request was made ({request.stale_fields.map(fieldLabel).join(', ')}).
            Approving is blocked so the newer change is not overwritten; reject with feedback so the Sales Rep can
            propose again.
          </p>
        )}
        <CompareTable request={request} />
        {request.review_feedback && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Feedback{request.reviewed_by_name ? ` from ${request.reviewed_by_name}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{request.review_feedback}</p>
          </div>
        )}
        {pending && canReview && (
          <div className="space-y-2">
            <label htmlFor={feedbackId} className="text-sm font-medium">Feedback for the Sales Rep</label>
            <Textarea id={feedbackId} value={feedback} onChange={(e) => setFeedback(e.target.value)}
              placeholder="Required to reject; optional when approving." rows={3} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act('approve')} disabled={Boolean(busy) || stale || request.assistant_id == null}>
                {busy === 'approve' ? 'Applying…' : 'Approve and apply'}
              </Button>
              <Button variant="outline" onClick={() => act('reject')} disabled={Boolean(busy)}>
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
        {pending && canWithdraw && (
          <Button variant="outline" onClick={() => act('withdraw')} disabled={Boolean(busy)}>Withdraw request</Button>
        )}
      </CardContent>
    </Card>
  );
}

function RequestsTable({ requests, showRequester, onOpen, openId }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Assistant</TableHead>
          {showRequester && <TableHead>Requested by</TableHead>}
          <TableHead>Changes</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="w-24"><span className="sr-only">Open</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => (
          <TableRow key={r.id} data-state={String(openId) === String(r.id) ? 'selected' : undefined}>
            <TableCell className="font-medium">{r.assistant_name}</TableCell>
            {showRequester && <TableCell>{r.requested_by_name || '—'}</TableCell>}
            <TableCell>{Object.keys(r.proposed_changes || {}).map(fieldLabel).join(', ')}</TableCell>
            <TableCell><RequestStatus status={r.status} /></TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
            <TableCell>
              <Button size="sm" variant="outline" onClick={() => onOpen(r.id)}
                aria-label={`Open request for ${r.assistant_name}`}>
                {showRequester && r.status === 'pending' ? 'Review' : 'View'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function useRequests(status, enabled) {
  const [state, setState] = useState({ loading: true, error: '', requests: [] });
  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await listAssistantChangeRequests(status && status !== ALL ? { status } : {});
      setState({ loading: false, error: '', requests: res.data?.requests || [] });
    } catch (e) {
      setState({ loading: false, error: errorText(e, 'Requests could not be loaded.'), requests: [] });
    }
  }, [status, enabled]);
  useEffect(() => { load(); }, [load]);
  return [state, load];
}

/** Read-only configuration of a published assistant, and the form to propose a change. */
function ProposePanel({ onSubmitted }) {
  const [assistants, setAssistants] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [assistant, setAssistant] = useState(null);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reasonId = useId();

  useEffect(() => {
    getAssistants().then((res) => setAssistants(res.data || [])).catch(() => setAssistants([]));
  }, []);

  useEffect(() => {
    if (!selectedId) { setAssistant(null); return; }
    setError('');
    setEditing(false);
    getAssistant(selectedId)
      .then((res) => { setAssistant(res.data); setDraft(initialDraft(res.data)); })
      .catch((e) => setError(errorText(e, 'This assistant could not be loaded.')));
  }, [selectedId]);

  const { changes, invalid } = useMemo(() => buildChanges(assistant, draft), [assistant, draft]);
  const changedCount = Object.keys(changes).length;

  const submit = async (event) => {
    event.preventDefault();
    if (!changedCount || invalid.length || !reason.trim() || saving) return;
    setSaving(true);
    try {
      await submitAssistantChangeRequest(assistant.id, changes, reason.trim());
      toast.success('Request sent for review.');
      setEditing(false);
      setReason('');
      setDraft(initialDraft(assistant));
      onSubmitted?.();
    } catch (e) {
      toast.error(errorText(e, 'The request could not be sent.'));
    } finally {
      setSaving(false);
    }
  };

  if (assistants === null) return <SkeletonRows rows={2} label="Loading assistants" />;
  if (!assistants.length) {
    return <EmptyState title="No published assistants" body="Your tenant has no published assistants yet." />;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Published assistants</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger aria-label="Assistant" className="max-w-md"><SelectValue placeholder="Choose an assistant" /></SelectTrigger>
          <SelectContent>
            {assistants.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {error && <ErrorState message={error} />}
        {assistant && !editing && (
          <div className="space-y-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              {PROPOSABLE_FIELDS.map((spec) => (
                <div key={spec.key} className={spec.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">{spec.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{displayValue(assistant[spec.key])}</dd>
                </div>
              ))}
            </dl>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">Full configuration</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(assistant, null, 2)}
              </pre>
            </details>
            <Button onClick={() => setEditing(true)}>Propose a change</Button>
          </div>
        )}
        {assistant && editing && (
          <form onSubmit={submit} className="space-y-3" aria-label="Propose a change">
            <p className="text-sm text-muted-foreground">
              Edit the settings you want changed. Your Manager reviews the request; nothing changes until it is approved.
            </p>
            {PROPOSABLE_FIELDS.map((spec) => {
              const id = `proposal-${spec.key}`;
              const common = {
                id, value: draft[spec.key] ?? '',
                onChange: (e) => setDraft((d) => ({ ...d, [spec.key]: e.target.value })),
              };
              return (
                <div key={spec.key} className="space-y-1">
                  <label htmlFor={id} className="text-sm font-medium">
                    {spec.label}{spec.key in changes && <span className="ml-2 text-xs text-[var(--ops-accent)]">changed</span>}
                  </label>
                  {spec.type === 'textarea'
                    ? <Textarea {...common} rows={spec.rows || 3} />
                    : <Input {...common} type={spec.type} step={spec.step} min={spec.min} max={spec.max} />}
                </div>
              );
            })}
            <div className="space-y-1">
              <label htmlFor={reasonId} className="text-sm font-medium">Reason</label>
              <Textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Why should this change? Your Manager sees this." />
            </div>
            {invalid.length > 0 && <p role="alert" className="text-sm text-destructive">Enter a number for: {invalid.join(', ')}.</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!changedCount || invalid.length > 0 || !reason.trim() || saving}>
                {saving ? 'Sending…' : `Send for review${changedCount ? ` (${changedCount})` : ''}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setDraft(initialDraft(assistant)); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Voice Agent → Assistant Requests. A Sales Rep views published assistants, proposes changes
 * and follows their requests; a Manager reviews those routed to them, a Tenant Admin all of
 * the tenant's. The backend enforces every rule.
 */
export default function AssistantChangeRequests({ user, openRequestId }) {
  const proposer = canProposeAssistantChanges(user);
  const reviewer = canReviewAssistantChanges(user);
  const [status, setStatus] = useState(reviewer ? 'pending' : ALL);
  const [openId, setOpenId] = useState(openRequestId || null);
  const [{ loading, error, requests }, reload] = useRequests(status, proposer || reviewer);

  useEffect(() => { if (openRequestId) setOpenId(openRequestId); }, [openRequestId]);

  if (!proposer && !reviewer) {
    return <EmptyState title="Not available" body="Assistant change requests are for Sales Reps, Managers and Tenant Admins." />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Assistant requests</h1>
        <p className="text-sm text-muted-foreground">
          {proposer
            ? 'View your published assistants and propose changes. Your Manager approves or rejects them.'
            : 'Changes Sales Reps have proposed to assistants. Approving applies the change to the assistant.'}
        </p>
      </div>
      {proposer && <ProposePanel onSubmitted={reload} />}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">{proposer ? 'My requests' : 'Requests to review'}</CardTitle>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonRows rows={3} label="Loading requests" />
            : error ? <ErrorState message={error} onRetry={reload} />
              : requests.length === 0
                ? <EmptyState title={reviewer && status === 'pending' ? 'Nothing waiting for review' : 'No requests'} />
                : <RequestsTable requests={requests} showRequester={reviewer} onOpen={setOpenId} openId={openId} />}
        </CardContent>
      </Card>
      {openId && (
        <RequestDetail requestId={openId} canReview={reviewer} canWithdraw={proposer}
          onChanged={reload} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
