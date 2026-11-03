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
import TenantUsersPage from '@/pages/admin/Users';
import AdminAuditLogsPage from '@/pages/admin/AuditLogs';

/**
 * The platform control area: /admin -> /admin/overview; Super Admin only (SuperAdminRoute). Tenants and Users reuse
 * the existing pages and APIs (/api/tenants, /api/users); the backend checks every request.
 */
export function adminRoutes() {
  return (
    <Route key="admin" path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
      <Route index element={<Navigate to="/admin/overview" replace />} />
      <Route path="overview" element={<AdminOverviewPage />} />
      <Route path="tenants" element={<TenantsAdminPage />} />
      <Route path="users" element={<PlatformUsersPage />} />
      <Route path="tenant-users" element={<TenantUsersPage />} />
      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="agents/import" element={<AgentImportPage />} />
      <Route path="agents/:agentId" element={<AgentDetailPage />} />
      <Route path="tools" element={<AdminToolsPage />} />
      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Route>
  );
}
