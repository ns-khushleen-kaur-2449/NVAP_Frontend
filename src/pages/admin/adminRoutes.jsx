import { Navigate, Route } from 'react-router-dom';
import SuperAdminRoute from '@/components/auth/SuperAdminRoute';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminOverviewPage from '@/pages/admin/Overview';
import AgentImportPage from '@/pages/admin/AgentImport';
import AgentsPage from '@/pages/admin/Agents';
import AgentDetailPage from '@/pages/admin/AgentDetail';
import AdminToolsPage from '@/pages/admin/Tools';
import TenantsAdminPage from '@/pages/admin/Tenants';
import PlatformUsersPage from '@/pages/admin/PlatformUsers';
import TenantAdminsPage from '@/pages/admin/TenantAdmins';
import AdminAuditLogsPage from '@/pages/admin/AuditLogs';
import SecurityPage from '@/pages/admin/Security';
import ControlsPage from '@/pages/admin/Controls';
import OperationsPage from '@/pages/admin/Operations';
import UsagePage from '@/pages/admin/Usage';
import HierarchyPage from '@/pages/admin/Hierarchy';
import IntegrationsPage from '@/pages/admin/Integrations';

/**
 * The platform control area: /admin -> /admin/overview; Super Admin only (SuperAdminRoute). Every page calls /api/admin only;
 * the backend checks every request.
 */
export function adminRoutes() {
  return (
    <Route key="admin" path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
      <Route index element={<Navigate to="/admin/overview" replace />} />
      <Route path="overview" element={<AdminOverviewPage />} />
      <Route path="tenants" element={<TenantsAdminPage />} />
      <Route path="users" element={<PlatformUsersPage />} />
      <Route path="tenant-users" element={<TenantAdminsPage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="hierarchy" element={<HierarchyPage />} />
      <Route path="operations" element={<OperationsPage />} />
      <Route path="usage" element={<UsagePage />} />
      <Route path="controls" element={<ControlsPage />} />
      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="agents/import" element={<AgentImportPage />} />
      <Route path="agents/:agentId" element={<AgentDetailPage />} />
      <Route path="tools" element={<AdminToolsPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Route>
  );
}
