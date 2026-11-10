import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import { HiringError, NOT_AVAILABLE } from '@/components/hiring/HiringBits';
import { listAvailableAgents } from '@/lib/api';
import { PERMISSIONS } from '@/lib/rbac';
import BookingsTab from './BookingsTab';
import CandidatesTab from './CandidatesTab';
import JobsTab from './JobsTab';

export const HIRING_PATH = '/hiring_agent';

// One page, one tab per screen; the tab is the path (/hiring_agent/<id>).
export const HIRING_TABS = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'candidates', label: 'Candidates' },
];

/**
 * Whether the organisation may use Hiring now (`GET /api/v1/agents/available`): `available` is null while asking.
 * Only a convenience: every Hiring route also refuses an organisation that may not use it (403).
 */
function useHiringAvailable() {
  const [state, setState] = useState({ available: null, error: null });
  const check = useCallback(async () => {
    setState({ available: null, error: null });
    try {
      const { data } = await listAvailableAgents();
      setState({ available: (data || []).some((agent) => agent.key === 'hiring'), error: null });
    } catch (error) {
      setState({ available: null, error });
    }
  }, []);
  useEffect(() => { check(); }, [check]);
  return { ...state, retry: check };
}

/** The Hiring agent's screen: bookings, jobs and candidates. */
export default function HiringAgentPage() {
  const { available, error, retry } = useHiringAvailable();
  const { pathname } = useLocation();

  return (
    <div className="ops mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6" data-testid="hiring-page">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <BriefcaseBusiness className="h-6 w-6 text-primary" /> Hiring
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Intake calls: jobs and their questions, candidates, and the bookings that call them.
        </p>
      </header>

      {error ? <HiringError error={error} onRetry={retry} />
        : available === null ? <SkeletonRows rows={3} label="Loading Hiring" />
        : !available ? (
          <EmptyState title={NOT_AVAILABLE} body="Ask your platform administrator to enable Hiring for your organisation." />
        ) : (
          <>
            <nav aria-label="Hiring">
              <ul className="flex gap-1 overflow-x-auto border-b border-border">
                {HIRING_TABS.map((tab) => {
                  const active = pathname.startsWith(`${HIRING_PATH}/${tab.id}`);
                  return (
                    <li key={tab.id}>
                      <Link to={`${HIRING_PATH}/${tab.id}`} aria-current={active ? 'page' : undefined}
                        className={`-mb-px inline-flex whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <Routes>
              <Route path="bookings" element={<BookingsTab />} />
              <Route path="jobs" element={<JobsTab />} />
              <Route path="candidates" element={<CandidatesTab />} />
              <Route path="*" element={<Navigate to={`${HIRING_PATH}/bookings`} replace />} />
            </Routes>
          </>
        )}
    </div>
  );
}

/** The route element: tenant users with hiring.view (a Super Admin has none and gets /403). */
export function HiringRoute() {
  return <RequirePermission perm={PERMISSIONS.HIRING_VIEW}><HiringAgentPage /></RequirePermission>;
}
