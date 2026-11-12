/**
 * NVIP route table (portal structure, architecture doc §29).
 *
 *   Public (no login):  /  /agents/:slug  /pricing  /how-it-works  /request-demo  /request-quote  /signin
 *   Workspace:          /app/*   — sidebar per role, see config/navigation.js
 */
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './context/SessionContext';
import { rolesForPath } from './config/navigation';
import { homeFor } from './config/roles';

import PublicLayout from './layouts/PublicLayout';
import WorkspaceLayout from './layouts/WorkspaceLayout';
import PlaceholderPage from './components/PlaceholderPage';

import AgentCatalog from './pages/public/AgentCatalog';
import AgentDetail from './pages/public/AgentDetail';
import Pricing from './pages/public/Pricing';
import HowItWorks from './pages/public/HowItWorks';
import RequestAccess from './pages/public/RequestAccess';
import SignIn from './pages/public/SignIn';

import Dashboard from './pages/workspace/Dashboard';
import MyAgents from './pages/workspace/MyAgents';
import AgentWorkspace from './pages/workspace/AgentWorkspace';
import Orders from './pages/workspace/Orders';
import Usage from './pages/workspace/Usage';
import Team from './pages/workspace/Team';
import Integrations from './pages/workspace/Integrations';

function RequireSession() {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Route-level role check, driven by the same list the sidebar uses. */
function RoleGate({ path, children }) {
  const { role } = useSession();
  if (!rolesForPath(path).includes(role)) return <Navigate to={homeFor(role)} replace />;
  return children;
}

function WorkspaceHome() {
  const { role } = useSession();
  return <Navigate to={homeFor(role)} replace />;
}

/** Screens that are routed and permissioned but wait on backend APIs. */
const PLACEHOLDERS = {
  'sub-tenants': { title: 'Sub-tenants', specRef: 'doc §28.3', planned: ['Client sub-tenant list', 'Create sub-tenant', 'Delegated management toggle', 'Billing roll-up view'] },
  settings: { title: 'Settings', specRef: 'doc §29.3', planned: ['Branding defaults (voice, greeting)', 'Data residency preference', 'Retention settings within platform bounds'] },
  queue: { title: 'My Queue', specRef: 'doc §29.4', planned: ['Calls handed off to you, with the context summary', 'Accept / complete escalations'] },
  calls: { title: 'Calls & Transcripts', specRef: 'doc §29.4', planned: ['Calls relevant to your role only', 'Transcripts and dispositions'] },
  calendar: { title: 'Calendar', specRef: 'doc §29.4', planned: ['Your Nylas-connected calendar', 'Bookings the agent made on your behalf'] },
  reports: { title: 'Dashboards', specRef: 'doc §29.5, FR-ANALYTICS-01–03', planned: ['Call outcome dashboards by agent and date range', 'Usage and cost views', 'Agent-specific funnels (campaign, lead, pipeline, inquiry-to-viewing)'] },
  'admin/tenants': { title: 'Tenants', specRef: 'doc §29.6', planned: ['All tenants, including MSP / sub-tenant hierarchy', 'Audit-logged impersonation for support'] },
  'admin/catalog': { title: 'Agent Catalog', specRef: 'doc §29.6', planned: ['Create / edit agent templates and versions', 'Publish / unpublish listings', 'Manage brochures'] },
  'admin/pricing': { title: 'Pricing & Quotes', specRef: 'doc §29.6', planned: ['Edit plans and tiers', 'Respond to quote requests', 'Approve enterprise terms'] },
  'admin/provisioning': { title: 'Provisioning', specRef: 'doc §29.6, §30.15', planned: ['Live provisioning jobs (Queued / In progress / Blocked / Failed)', 'Manual retry', 'Pax8 provisioning monitor'] },
  'admin/audit': { title: 'Audit & Compliance', specRef: 'doc §29.6', planned: ['Audit log search', 'Consent records', 'SOC 2 evidence views', 'Access reviews'] },
  'admin/analytics': { title: 'Platform Analytics', specRef: 'doc §29.6', planned: ['Cross-tenant aggregate usage, revenue, call volume', 'Revenue by sales channel (direct vs Pax8)'] },
  'admin/incidents': { title: 'Risk & Incidents', specRef: 'doc §29.6', planned: ['Failure-matrix occurrences', 'Open risks register'] },
};

const PAGES = {
  dashboard: <Dashboard />,
  agents: <MyAgents />,
  orders: <Orders />,
  usage: <Usage />,
  team: <Team />,
  integrations: <Integrations />,
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<AgentCatalog />} />
        <Route path="agents" element={<Navigate to="/" replace />} />
        <Route path="agents/:slug" element={<AgentDetail />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="request-demo" element={<RequestAccess kind="demo" />} />
        <Route path="request-quote" element={<RequestAccess kind="quote" />} />
      </Route>
      <Route path="signin" element={<SignIn />} />

      <Route path="app" element={<RequireSession />}>
        <Route element={<WorkspaceLayout />}>
          <Route index element={<WorkspaceHome />} />
          {Object.entries(PAGES).map(([path, page]) => (
            <Route key={path} path={path} element={<RoleGate path={path}>{page}</RoleGate>} />
          ))}
          <Route path="agents/:instanceId/:tab?" element={<RoleGate path="agents"><AgentWorkspace /></RoleGate>} />
          {Object.entries(PLACEHOLDERS).map(([path, meta]) => (
            <Route key={path} path={path} element={<RoleGate path={path}><PlaceholderPage {...meta} /></RoleGate>} />
          ))}
          <Route path="*" element={<WorkspaceHome />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
