import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ScrollTable, SkeletonRows } from '@/components/ops/States';
import BookingDialog from '@/components/hiring/BookingDialog';
import { CONTROL, HiringError, ListFooter } from '@/components/hiring/HiringBits';
import { listHiringBookings, listHiringJobs } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { BOOKING_STATUS, MAX_ROWS, PAGE_SIZE, bookingPath, statusOf } from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

// Statuses change as calls end and their summaries arrive.
const REFRESH_MS = 30000;

/** Bookings: one candidate's intake call for one job.  Tenant Admins and Managers create them. */
export default function BookingsTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const [jobId, setJobId] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [creating, setCreating] = useState(false);
  const { data: jobs } = useHiringData(() => listHiringJobs({ limit: MAX_ROWS }), []);
  const { data: bookings, error, reload } = useHiringData(
    () => listHiringBookings({ job_id: jobId || undefined, status: bookingStatus || undefined, limit }),
    [jobId, bookingStatus, limit], { pollMs: REFRESH_MS });

  const filter = (setter) => (event) => { setter(event.target.value); setLimit(PAGE_SIZE); };
  const filtered = Boolean(jobId || bookingStatus);

  return (
    <section className="space-y-4" aria-label="Bookings">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Job
            <select value={jobId} onChange={filter(setJobId)} className={`${CONTROL} w-56`}>
              <option value="">All jobs</option>
              {(jobs || []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Status
            <select value={bookingStatus} onChange={filter(setBookingStatus)} className={`${CONTROL} w-44`}>
              <option value="">All statuses</option>
              {Object.entries(BOOKING_STATUS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {canManage && (
          <OpsButton variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New booking</OpsButton>
        )}
      </div>

      {error && <HiringError error={error} onRetry={reload} />}
      {!bookings ? (!error && <SkeletonRows rows={4} label="Loading bookings" />)
        : bookings.length === 0 ? (
          <EmptyState title={filtered ? 'No bookings match' : 'No bookings yet'}
            body={filtered ? 'Try another job or status.'
              : canManage ? 'Create a booking to call a candidate about a job.' : 'Bookings your managers create appear here.'} />
        ) : (
          <>
            <ScrollTable label="Bookings">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Candidate</th>
                  <th className="px-4 py-3 font-semibold">Job</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((booking) => {
                  const state = statusOf(BOOKING_STATUS, booking.status);
                  return (
                    <tr key={booking.id} data-testid={`booking-row-${booking.id}`}>
                      <td className="px-4 py-3 font-medium">
                        <Link to={bookingPath(booking.id)} className="text-[color:var(--ops-accent-ink)] hover:underline">
                          {booking.candidate_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{booking.job_title}</td>
                      <td className="px-4 py-3"><StatusBadge label={state.label} tone={state.tone} /></td>
                      <td className="px-4 py-3 text-muted-foreground"><RelativeTime iso={booking.created_at} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <ListFooter count={bookings.length} limit={limit} max={MAX_ROWS} what="bookings"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}

      <BookingDialog open={creating} jobs={jobs} onOpenChange={setCreating} onCreated={reload} />
    </section>
  );
}
