import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import CallCandidate from '@/components/hiring/CallCandidate';
import CallCard from '@/components/hiring/CallCard';
import { HiringError } from '@/components/hiring/HiringBits';
import { getHiringBooking, getHiringCandidate, getHiringJob } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  BOOKING_STATUS, CONSENT_STATUS, HIRING_BOOKINGS_PATH, IDLE_REFRESH_MS, LIVE_REFRESH_MS, isNotFound, refreshInterval,
  statusOf,
} from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

const NOTHING = () => Promise.resolve({ data: null });

function BackLink() {
  return (
    <Link to={HIRING_BOOKINGS_PATH}
      className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--ops-accent-ink)] hover:underline">
      <ArrowLeft className="h-4 w-4" /> All bookings
    </Link>
  );
}

/** Who is called: the number dialled and whether they agreed to be called (the backend refuses a call without it). */
function CandidatePanel({ candidate }) {
  if (!candidate) return null;
  const consent = statusOf(CONSENT_STATUS, candidate.consent_status);
  return (
    <section aria-label="Candidate" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Candidate</h3>
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd className="ops-num">{candidate.phone_number}</dd></div>
        {candidate.email && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="truncate">{candidate.email}</dd></div>}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Consent</dt>
          <dd><StatusBadge label={consent.label} tone={consent.tone} title={candidate.consent_source || undefined} /></dd>
        </div>
      </dl>
    </section>
  );
}

/** The job's questions today: what the next call will ask. Each past call keeps its own (see its card). */
function NextQuestionsPanel({ job }) {
  if (!job) return null;
  const questions = job.questions || [];
  return (
    <section aria-label="Next call's questions" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Next call's questions</h3>
      {questions.length === 0
        ? <p className="text-[color:var(--ops-warn)]">This job has no questions yet: add them on the Jobs tab before calling.</p>
        : <ol className="list-decimal space-y-1 pl-5">{questions.map((q) => <li key={q.id}>{q.question_text}</li>)}</ol>}
      {job.status !== 'open' && <p className="text-[color:var(--ops-warn)]">This job is closed: reopen it to call.</p>}
    </section>
  );
}

/**
 * One booking: its intake calls (newest first) with results, transcripts and recordings, and "Call candidate" for
 * Tenant Admins and Managers. Refreshes every 5 s while a call runs or its summary is awaited, otherwise every 30 s.
 */
export default function BookingPage() {
  const { bookingId } = useParams();
  const { can } = useAuth();
  // Changing the interval reloads at once (hooks/usePolling), so start idle: most bookings have nothing running.
  const [refreshMs, setRefreshMs] = useState(IDLE_REFRESH_MS);
  const { data: booking, error, reload } = useHiringData(() => getHiringBooking(bookingId), [bookingId],
    { pollMs: refreshMs });
  const jobId = booking?.job_id;
  const candidateId = booking?.candidate_id;
  const { data: job } = useHiringData(jobId ? () => getHiringJob(jobId) : NOTHING, [jobId]);
  const { data: candidate } = useHiringData(candidateId ? () => getHiringCandidate(candidateId) : NOTHING, [candidateId]);

  useEffect(() => { if (booking) setRefreshMs(refreshInterval(booking.calls)); }, [booking]);

  if (!booking) {
    if (error && isNotFound(error)) {
      return (
        <section aria-label="Booking" className="space-y-4">
          <BackLink />
          <EmptyState title="Booking not found" body="It may have been removed, or it is not in your organisation." />
        </section>
      );
    }
    return (
      <section aria-label="Booking" className="space-y-4">
        <BackLink />
        {error ? <HiringError error={error} onRetry={reload} /> : <SkeletonRows rows={3} label="Loading the booking" />}
      </section>
    );
  }

  const calls = booking.calls || [];
  const state = statusOf(BOOKING_STATUS, booking.status);
  const live = refreshMs === LIVE_REFRESH_MS;

  return (
    <section aria-label="Booking" className="space-y-5">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{booking.candidate_name}</h2>
          <p className="text-sm text-muted-foreground">{booking.job_title} · created <RelativeTime iso={booking.created_at} /></p>
        </div>
        <div className="flex items-center gap-2">
          {live && calls.length > 0 && <span className="text-xs text-muted-foreground">Updating every few seconds</span>}
          <StatusBadge label={state.label} tone={state.tone} />
        </div>
      </header>

      {error && <HiringError error={error} onRetry={reload} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {can(PERMISSIONS.HIRING_CALL) && <CallCandidate booking={booking} calls={calls} onDone={reload} />}
          <section aria-label="Calls" className="space-y-3">
            <h3 className="text-sm font-semibold">Calls</h3>
            {calls.length === 0 ? (
              <EmptyState title="No calls yet"
                body={can(PERMISSIONS.HIRING_CALL) ? 'Use Call candidate to place the intake call.'
                  : 'Calls placed by your managers appear here.'} />
            ) : (
              calls.map((call, index) => ({ call, number: index + 1 })).reverse().map(({ call, number }) => (
                <CallCard key={call.id} bookingId={booking.id} call={call} number={number} />
              ))
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <CandidatePanel candidate={candidate} />
          <NextQuestionsPanel job={job} />
        </aside>
      </div>
    </section>
  );
}
