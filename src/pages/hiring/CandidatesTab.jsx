import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ScrollTable, SkeletonRows } from '@/components/ops/States';
import CandidateDialog from '@/components/hiring/CandidateDialog';
import { CONTROL, HiringError, ListFooter } from '@/components/hiring/HiringBits';
import { listHiringCandidates } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { CONSENT_STATUS, MAX_ROWS, PAGE_SIZE, candidateName, statusOf } from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

const SEARCH_DELAY_MS = 300;

/** The organisation's candidates and their consent to be called.  Tenant Admins and Managers add and edit them. */
export default function CandidatesTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState(null); // { candidate } to edit, {} to add

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setLimit(PAGE_SIZE); }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: candidates, error, reload } = useHiringData(
    () => listHiringCandidates({ q: query || undefined, limit }), [query, limit]);

  return (
    <section className="space-y-4" aria-label="Candidates">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100}
            placeholder="Name, phone or email" className={`${CONTROL} w-64`} />
        </label>
        {canManage && (
          <OpsButton variant="primary" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New candidate</OpsButton>
        )}
      </div>

      {error && <HiringError error={error} onRetry={reload} />}
      {!candidates ? (!error && <SkeletonRows rows={4} label="Loading candidates" />)
        : candidates.length === 0 ? (
          <EmptyState title={query ? 'No candidates match' : 'No candidates yet'}
            body={query ? 'Try another name, phone number or email.'
              : canManage ? 'Add the people you want to call about a job.' : 'Candidates your managers add appear here.'} />
        ) : (
          <>
            <ScrollTable label="Candidates">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Consent</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                  {canManage && <th className="px-4 py-3"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((candidate) => {
                  const consent = statusOf(CONSENT_STATUS, candidate.consent_status);
                  return (
                    <tr key={candidate.id} data-testid={`candidate-row-${candidate.id}`}>
                      <td className="px-4 py-3 font-medium">{candidateName(candidate)}</td>
                      <td className="ops-num px-4 py-3">{candidate.phone_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{candidate.email || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={consent.label} tone={consent.tone} />
                        {candidate.consent_source && (
                          <p className="mt-1 text-xs text-muted-foreground">{candidate.consent_source}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><RelativeTime iso={candidate.created_at} /></td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <OpsButton size="sm" onClick={() => setEditing({ candidate })}>Edit</OpsButton>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <ListFooter count={candidates.length} limit={limit} max={MAX_ROWS} what="candidates"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}

      <CandidateDialog open={editing !== null} candidate={editing?.candidate || null}
        onOpenChange={(open) => { if (!open) setEditing(null); }} onSaved={reload} />
    </section>
  );
}
