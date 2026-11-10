import { useState } from 'react';
import { Plus } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ScrollTable, SkeletonRows } from '@/components/ops/States';
import JobDialog from '@/components/hiring/JobDialog';
import QuestionsDialog from '@/components/hiring/QuestionsDialog';
import { CONTROL, HiringError, ListFooter } from '@/components/hiring/HiringBits';
import useApiAction from '@/hooks/useApiAction';
import { listHiringJobs, updateHiringJob } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { JOB_STATUS, MAX_ROWS, PAGE_SIZE, statusOf } from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

/** Jobs and their intake questions.  Tenant Admins and Managers change them; everyone else reads. */
export default function JobsTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const [jobStatus, setJobStatus] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [naming, setNaming] = useState(null); // { job } to rename, {} to create
  const [questionsOf, setQuestionsOf] = useState(null);
  const { data: jobs, error, reload } = useHiringData(
    () => listHiringJobs({ status: jobStatus || undefined, limit }), [jobStatus, limit]);
  const toggle = useApiAction(
    (job) => updateHiringJob(job.id, { status: job.status === 'open' ? 'closed' : 'open' }),
    { success: (r) => (r.data.status === 'open' ? 'Job reopened' : 'Job closed'), onSuccess: reload, onConflict: reload });

  const saved = (job, created) => {
    reload();
    if (created) setQuestionsOf(job);
  };

  return (
    <section className="space-y-4" aria-label="Jobs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Status
          <select value={jobStatus} onChange={(e) => { setJobStatus(e.target.value); setLimit(PAGE_SIZE); }}
            className={`${CONTROL} w-40`}>
            <option value="">All jobs</option>
            {Object.entries(JOB_STATUS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {canManage && (
          <OpsButton variant="primary" onClick={() => setNaming({})}><Plus className="h-4 w-4" /> New job</OpsButton>
        )}
      </div>

      {error && <HiringError error={error} onRetry={reload} />}
      {!jobs ? (!error && <SkeletonRows rows={4} label="Loading jobs" />)
        : jobs.length === 0 ? (
          <EmptyState title="No jobs yet"
            body={canManage ? 'Create a job and add the questions its intake call asks.' : 'Jobs your managers add appear here.'} />
        ) : (
          <>
            <ScrollTable label="Jobs">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Job</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Questions</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => {
                  const state = statusOf(JOB_STATUS, job.status);
                  return (
                    <tr key={job.id} data-testid={`job-row-${job.id}`}>
                      <td className="px-4 py-3 font-medium">{job.title}</td>
                      <td className="px-4 py-3"><StatusBadge label={state.label} tone={state.tone} /></td>
                      <td className="px-4 py-3">
                        {job.question_count
                          ? <span className="ops-num">{job.question_count}</span>
                          : <StatusBadge label="No questions" tone="warn" title="A job needs at least one question before calls" />}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><RelativeTime iso={job.updated_at} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <OpsButton size="sm" onClick={() => setQuestionsOf(job)}>
                            {canManage ? 'Edit questions' : 'View questions'}
                          </OpsButton>
                          {canManage && (
                            <>
                              <OpsButton size="sm" onClick={() => setNaming({ job })}>Rename</OpsButton>
                              <OpsButton size="sm" variant="quiet" busy={toggle.pending} onClick={() => toggle.run(job)}>
                                {job.status === 'open' ? 'Close' : 'Reopen'}
                              </OpsButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <ListFooter count={jobs.length} limit={limit} max={MAX_ROWS} what="jobs"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}

      <JobDialog open={naming !== null} job={naming?.job || null} onOpenChange={(open) => { if (!open) setNaming(null); }}
        onSaved={saved} />
      <QuestionsDialog job={questionsOf} canEdit={canManage} onOpenChange={(open) => { if (!open) setQuestionsOf(null); }}
        onSaved={reload} />
    </section>
  );
}
