import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import {
  addDoNotCall, confirmDoNotCall, getCallRecordingUrl, getDoNotCallEntries, getDoNotCallHistory, removeDoNotCall,
  revertDoNotCall,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canLiftDoNotCall, canOperate, isSuperAdmin } from '@/lib/rbac';
import { maskPhone, plural } from '@/lib/ops';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import usePolling from '@/hooks/usePolling';
import ReasonDialog from '@/components/ops/ReasonDialog';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import RelativeTime from '@/components/ops/RelativeTime';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import TenantPicker from '@/components/ops/TenantPicker';
import { EmptyState, ErrorState, ScrollTable, SkeletonRows } from '@/components/ops/States';

const REFRESH_MS = 30000;
export const DNC_TABS = [
  { id: 'review', label: 'Needs review' },
  { id: 'all', label: 'All' },
  { id: 'history', label: 'History' },
];

/** What a revert changed, from POST /revert's answer. */
export function revertSummary(result) {
  const parts = [];
  if (result?.restored_stage) parts.push(`Stage restored to ${result.restored_stage}`);
  const contacts = result?.requeued_contact_ids?.length || 0;
  const calls = result?.requeued_scheduled_call_ids?.length || 0;
  parts.push(`${plural(contacts, 'campaign contact')} requeued`);
  if (calls) parts.push(`${plural(calls, 'callback')} requeued`);
  return parts.join(' · ');
}

function ReviewCard({ entry, operator, canLift, onDone }) {
  const [dialog, setDialog] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const confirm = useApiAction((reason) => confirmDoNotCall(entry.id, reason), { success: 'Opt-out confirmed', onSuccess: onDone, onConflict: onDone });
  const revert = useApiAction((reason) => revertDoNotCall(entry.id, reason), {
    success: 'Opt-out reverted', onSuccess: (res) => { setOutcome(revertSummary(res.data)); onDone(); }, onConflict: onDone,
  });
  const playRecording = async () => {
    try {
      const res = await getCallRecordingUrl(entry.evidence.vapi_call_id);
      window.open(res.data.url, '_blank', 'noopener');
    } catch (err) {
      toast.error(errorMessage(err, 'The recording is not available.'));
    }
  };
  return (
    <article className="ops-card space-y-3 p-4" aria-label={`Opt-out from ${entry.phone_masked}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="ops-num text-base font-semibold">{entry.phone_masked}</p>
          <p className="text-sm text-muted-foreground">
            {entry.lead ? <Link to={`/leads?prospect=${entry.lead.prospect_id}`} className="font-medium text-[color:var(--ops-accent-ink)] hover:underline">{entry.lead.name || 'Lead'}</Link> : 'No linked lead'}
            {' · added '}<RelativeTime iso={entry.created_at} />
          </p>
        </div>
        <StatusBadge label={entry.source_label} tone="warn" />
      </div>
      {entry.evidence?.excerpt && (
        <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-[var(--ops-accent)] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
          {entry.evidence.excerpt}
        </blockquote>
      )}
      {entry.evidence?.vapi_call_id && (
        <p className="flex flex-wrap gap-3 text-sm">
          <Link to="/voice_agent?tab=logs" className="font-medium text-[color:var(--ops-accent-ink)] underline">Open the call log</Link>
          <button type="button" onClick={playRecording} className="font-medium text-[color:var(--ops-accent-ink)] underline">Play the recording</button>
        </p>
      )}
      {outcome && <p role="status" className="rounded-lg ops-tone ops-tone-good px-3 py-2 text-sm">{outcome}</p>}
      {operator && !outcome && (
        <div className="flex flex-wrap gap-2">
          <OpsButton size="sm" variant="outline" onClick={() => setDialog('confirm')}>Confirm opt-out</OpsButton>
          {canLift
            ? <OpsButton size="sm" variant="quiet" onClick={() => setDialog('revert')}>Not an opt-out</OpsButton>
            : <span className="self-center text-xs text-muted-foreground">Only a Tenant Admin can take a number off the list.</span>}
        </div>
      )}
      <ConfirmDialog open={dialog === 'confirm'} onOpenChange={(o) => !o && setDialog(null)} title="Confirm this opt-out?"
        description="The number stays on the do-not-call list and leaves the review list." confirmLabel="Confirm opt-out"
        onConfirm={async () => Boolean(await confirm.run())} />
      <ReasonDialog open={dialog === 'revert'} onOpenChange={(o) => !o && setDialog(null)} title="Not an opt-out"
        changes={['The number comes off the do-not-call list.', "The lead's stage goes back to what it was before.",
          'Contacts and callbacks skipped because of it are requeued (the normal rules apply).']}
        confirmLabel="Not an opt-out" onConfirm={async (reason) => Boolean(await revert.run(reason))} />
    </article>
  );
}

export default function DoNotCallPage() {
  const { user } = useAuth();
  const operator = canOperate(user);
  // Managers add and confirm; lifting a block applies to every team, so it is a Tenant Admin's.
  const canLift = canLiftDoNotCall(user);
  const superAdmin = isSuperAdmin(user);
  const [params, setParams] = useSearchParams();
  const tab = DNC_TABS.find((t) => t.id === params.get('tab')) || DNC_TABS[0];
  const [tenantId, setTenantId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [removing, setRemoving] = useState(null);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const scope = superAdmin ? { tenant_id: tenantId } : {};
  const ready = !superAdmin || Boolean(tenantId);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      if (tab.id === 'history') {
        const res = await getDoNotCallHistory({ ...scope, ...(query ? { phone_number: query } : {}) });
        setRows(res.data.events);
      } else {
        const res = await getDoNotCallEntries({ ...scope, ...(query ? { q: query } : {}),
          ...(tab.id === 'review' ? { source: 'call', reviewed: false } : {}) });
        setRows(res.data.entries);
      }
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, query, tenantId, ready]);
  usePolling(load, REFRESH_MS, [load]);

  const add = useApiAction((reason) => addDoNotCall(newNumber, reason), { success: 'Number added to the do-not-call list', onSuccess: () => { setNewNumber(''); load(); } });
  const remove = useApiAction((reason) => removeDoNotCall(removing.id, reason), { success: 'Number removed from the list', onSuccess: load, onConflict: load });
  const setTab = (id) => { setRows(null); setParams({ tab: id }); };

  return (
    <div className="ops mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Do-not-call</h1>
          <p className="text-sm text-muted-foreground">Numbers that are never dialled. Opt-outs said on a call wait here for review.</p>
        </div>
        {operator && <OpsButton variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add a number</OpsButton>}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        {superAdmin && <TenantPicker value={tenantId} onChange={setTenantId} />}
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {tab.id === 'history' ? 'Number' : 'Search by number or lead'}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-64 rounded-lg border border-border bg-card px-3 text-sm" />
        </label>
      </div>

      <div role="tablist" aria-label="Do-not-call" className="flex flex-wrap gap-1 border-b border-border">
        {DNC_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab.id === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab.id === t.id ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}{t.id === 'review' && tab.id === 'review' && rows ? <span className="ops-num ml-1 rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs">{rows.length}</span> : null}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && rows === null && <SkeletonRows rows={4} label="Loading the do-not-call list" />}
      {!error && rows?.length === 0 && (
        <EmptyState title={tab.id === 'review' ? 'Nothing waiting for review.' : 'Nothing here.'} />
      )}
      {!error && tab.id === 'review' && rows?.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((entry) => <ReviewCard key={entry.id} entry={entry} operator={operator} canLift={canLift} onDone={load} />)}
        </div>
      )}
      {!error && tab.id === 'all' && rows?.length > 0 && (
        <ScrollTable label="Numbers on the list">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2">Number</th><th className="px-4 py-2">Lead</th><th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Reason</th><th className="px-4 py-2">Added</th><th className="px-4 py-2">Reviewed</th>
              {operator && <th className="px-4 py-2"><span className="sr-only">Actions</span></th>}</tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="ops-num px-4 py-2.5 font-medium">{e.phone_masked}</td>
                <td className="px-4 py-2.5">{e.lead ? <Link to={`/leads?prospect=${e.lead.prospect_id}`} className="text-[color:var(--ops-accent-ink)] hover:underline">{e.lead.name || 'Lead'}</Link> : '—'}</td>
                <td className="px-4 py-2.5">{e.source_label}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{e.reason || '—'}</td>
                <td className="px-4 py-2.5"><RelativeTime iso={e.created_at} /></td>
                <td className="px-4 py-2.5">{e.reviewed ? 'Yes' : (e.source === 'call' ? 'Not yet' : '—')}</td>
                {operator && (
                  <td className="px-4 py-2.5 text-right">
                    {e.source === 'call'
                      ? <span className="text-xs text-muted-foreground" title="An opt-out from a call is taken back with Not an opt-out">Use review</span>
                      : canLift
                        ? <OpsButton size="sm" variant="quiet" onClick={() => setRemoving(e)}>Remove</OpsButton>
                        : <span className="text-xs text-muted-foreground" title="The list applies to every team">Tenant Admin only</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
      {!error && tab.id === 'history' && rows?.length > 0 && (
        <ScrollTable label="Do-not-call history">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Number</th><th className="px-4 py-2">Step</th>
              <th className="px-4 py-2">By</th><th className="px-4 py-2">Reason</th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5"><RelativeTime iso={e.created_at} mode="absolute" /></td>
                <td className="ops-num px-4 py-2.5">{maskPhone(e.phone_e164)}</td>
                <td className="px-4 py-2.5">{e.type_label}</td>
                <td className="px-4 py-2.5">{e.actor_label}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{e.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}

      <ReasonDialog open={adding} onOpenChange={setAdding} title="Add a number to the do-not-call list"
        changes={['This number is never dialled by any campaign, callback or single call.']}
        confirmLabel="Add number" canConfirm={newNumber.trim().length >= 3}
        onConfirm={async (reason) => Boolean(await add.run(reason))}>
        <label className="flex flex-col gap-1 text-sm font-medium">Phone number
          <input type="tel" required value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="+91 98765 43210"
            className="h-9 rounded-lg border border-border bg-background px-3" />
        </label>
      </ReasonDialog>
      <ReasonDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title="Remove this number?"
        changes={[`${removing?.phone_masked || 'The number'} can be dialled again (the normal rules apply).`]}
        confirmLabel="Remove" danger onConfirm={async (reason) => Boolean(await remove.run(reason))} />
    </div>
  );
}
