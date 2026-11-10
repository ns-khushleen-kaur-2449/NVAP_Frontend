import { useCallback, useState } from 'react';
import { Link, Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { getAppointments, getDoNotCallEntries, getIntentReviewQueue } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { featureEnabled } from '@/lib/rbac';
import { FeatureOff } from '@/components/auth/FeatureRoute';
import usePolling from '@/hooks/usePolling';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppointmentsPage from './Appointments';
import CallbacksPage from './Callbacks';
import DoNotCallPage from './DoNotCall';
import IntentReviewPage from './IntentReview';

// Tenant Admins, Managers and (view only) Super Admins (lib/rbac.js canViewOperations; the backend enforces it).
export const OPERATIONS_VIEWERS = ['tenant_admin', 'manager'];

// One page, one tab per screen; the tab is the path (/operations/<id>), each screen keeps its own ?tab=.
// `roles` limits a tab (others get 403); Appointments is for everyone (a Sales Rep sees their own meetings).
export const OPERATIONS_TABS = [
  { id: 'appointments', label: 'Appointments', roles: null, feature: 'appointment_booking' },
  { id: 'callbacks', label: 'Callbacks', roles: OPERATIONS_VIEWERS },
  { id: 'do-not-call', label: 'Do-not-call', roles: OPERATIONS_VIEWERS },
  { id: 'intent-review', label: 'Intent review', roles: OPERATIONS_VIEWERS },
];

const roleAllows = (tab, user) => !tab.roles || (user && tab.roles.includes(user.role));
export const tabsFor = (user) => OPERATIONS_TABS.filter((t) => roleAllows(t, user) && (!t.feature || featureEnabled(user, t.feature)));

const REFRESH_MS = 30000;

/**
 * Counts of what waits for a person, where one request answers it: appointments that need an
 * outcome, do-not-call opt-outs to review and pending intent reviews (each only on a tab the
 * user has). Callbacks
 * have no count endpoint (it would mean loading every scheduled call).
 */
function useWaitingCounts(user) {
  const [counts, setCounts] = useState({});
  const enabled = Boolean(user);
  const operations = Boolean(user) && OPERATIONS_VIEWERS.includes(user.role);
  const load = useCallback(async () => {
    const skip = Promise.resolve(null);
    const [appointments, dnc, intent] = await Promise.allSettled([
      getAppointments({ tab: 'needs_outcome', page_size: 1 }),
      operations ? getDoNotCallEntries({ source: 'call', reviewed: false }) : skip,
      operations ? getIntentReviewQueue({ status: 'pending', page_size: 1 }) : skip,
    ]);
    const value = (result, pick) => (result.status === 'fulfilled' && result.value ? pick(result.value.data) ?? null : null);
    setCounts({
      appointments: value(appointments, (d) => d?.counts?.needs_outcome),
      'do-not-call': value(dnc, (d) => d?.entries?.length),
      'intent-review': value(intent, (d) => d?.total),
    });
  }, [operations]);
  const refresh = usePolling(load, REFRESH_MS, [], { enabled });
  return [counts, refresh];
}

export default function OperationsPage() {
  const { tab: tabId } = useParams();
  const { user } = useAuth();
  const [counts, refreshCounts] = useWaitingCounts(user);
  const tabs = tabsFor(user);
  const tab = OPERATIONS_TABS.find((t) => t.id === tabId);
  if (!tabs.length) return <FeatureOff name="Appointments" />;
  if (!tab) return <Navigate to={`/operations/${tabs[0].id}`} replace />;
  // A tab only its feature switch hides moves on to the next one; a tab the role can't have is a 403.
  if (!tabs.includes(tab)) return <Navigate to={roleAllows(tab, user) ? `/operations/${tabs[0].id}` : '/403'} replace />;

  return (
    <div className="ops">
      <nav aria-label="Operations" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <ul className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => {
            const active = t.id === tab.id;
            const count = counts[t.id];
            return (
              <li key={t.id}>
                <Link to={`/operations/${t.id}`} aria-current={active ? 'page' : undefined}
                  className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                  {count > 0 && (
                    <span className="ops-num rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs">
                      {count}<span className="sr-only"> waiting</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {tab.id === 'appointments' && <AppointmentsPage />}
      {tab.id === 'callbacks' && <CallbacksPage />}
      {tab.id === 'do-not-call' && <DoNotCallPage />}
      {tab.id === 'intent-review' && <IntentReviewPage onReviewed={refreshCounts} />}
    </div>
  );
}

/** An old address: same query string, new path. */
function MovedTo({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

/** The Operations routes, including redirects from the old /appointments, /callbacks and /do-not-call. */
export function operationsRoutes() {
  return [
    <Route key="operations" path="/operations" element={<Navigate to={`/operations/${OPERATIONS_TABS[0].id}`} replace />} />,
    // Signed-in users; OperationsPage checks each tab's roles.
    <Route key="operations-tab" path="/operations/:tab" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />,
    <Route key="appointments" path="/appointments" element={<MovedTo to="/operations/appointments" />} />,
    <Route key="callbacks" path="/callbacks" element={<MovedTo to="/operations/callbacks" />} />,
    <Route key="do-not-call" path="/do-not-call" element={<MovedTo to="/operations/do-not-call" />} />,
  ];
}
