import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import VoiceDashboard from '@/components/voice/VoiceDashboard';
import Filters, { defaultFilters } from '@/components/analytics/Filters';
import { AnalyticsProvider } from '@/components/analytics/Section';
import RepDashboard from '@/components/analytics/roles/RepDashboard';
import RepReports, { REP_REPORT_SECTIONS } from '@/components/analytics/roles/RepReports';
import ManagerDashboard from '@/components/analytics/roles/ManagerDashboard';
import ManagerReports, { MANAGER_REPORT_SECTIONS } from '@/components/analytics/roles/ManagerReports';
import AdminDashboard from '@/components/analytics/roles/AdminDashboard';
import AdminReports, { ADMIN_REPORT_SECTIONS } from '@/components/analytics/roles/AdminReports';
import { exportReportsCsv } from '@/lib/analytics/service';
import { useAuth } from '@/lib/AuthContext';
import { canViewAssistants, roleLabel } from '@/lib/rbac';

// The page for the logged-in user's role. Which records each section contains is decided by the backend
// (scope from the token); this only picks the layout that fits the role.
const ROLE_VIEWS = {
  rep: { scope: 'Your own prospects and activity', Dashboard: RepDashboard, Reports: RepReports, sections: REP_REPORT_SECTIONS, filter: null },
  manager: { scope: 'Your team', Dashboard: ManagerDashboard, Reports: ManagerReports, sections: MANAGER_REPORT_SECTIONS, filter: 'rep' },
  tenant_admin: { scope: 'Your whole organisation', Dashboard: AdminDashboard, Reports: AdminReports, sections: ADMIN_REPORT_SECTIONS, filter: 'team' },
};

function useRoleView() {
  const { user } = useAuth();
  const view = ROLE_VIEWS[user?.role];
  const [filters, setFilters] = useState(() => defaultFilters(view?.filter ? { [view.filter]: 'all' } : {}));
  return { user, view, filters, setFilters };
}

function Header({ title, user, view, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{view.scope}{user ? ` · ${roleLabel(user.role)}` : ''}</p>
      </div>
      {children}
    </header>
  );
}

const NoView = () => <p className="ops-card p-4 text-sm text-muted-foreground">There is no dashboard for this role.</p>;

/** /dashboard — the landing page after login: the role's Dashboard only, no Reports content. */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user, view, filters, setFilters } = useRoleView();
  if (!view) return <main className="ops mx-auto max-w-[1280px] p-4 sm:p-6"><NoView /></main>;
  return (
    <TooltipProvider>
      <main className="ops mx-auto max-w-[1280px] space-y-5 p-4 sm:p-6" data-testid="role-dashboard">
        <Header title="Dashboard" user={user} view={view} />
        <Filters value={filters} onChange={setFilters} show={view.filter ? [view.filter] : []} />
        <AnalyticsProvider role={user.role} filters={filters}><view.Dashboard /></AnalyticsProvider>
        {/* Voice call stats, kept from the previous dashboard: only for roles that may view assistants. */}
        {canViewAssistants(user) && (
          <section aria-label="Voice agent activity" data-testid="voice-dashboard-section" className="pt-2">
            <VoiceDashboard embedded onNavigate={(tab) => navigate(`/voice_agent?tab=${tab}`)} />
          </section>
        )}
      </main>
    </TooltipProvider>
  );
}

/** /reports — Reports & Analytics for the same role. Every section reloads with the filters. */
export function ReportsPage() {
  const { user, view, filters, setFilters } = useRoleView();
  const [exporting, setExporting] = useState(false);
  if (!view) return <main className="ops mx-auto max-w-[1280px] p-4 sm:p-6"><NoView /></main>;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportReportsCsv({ role: user.role, filters, sections: view.sections });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `smartsdr-report-${new Date().toISOString().slice(0, 10)}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('The report could not be exported. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <TooltipProvider>
      <main className="ops mx-auto max-w-[1280px] space-y-5 p-4 sm:p-6" data-testid="role-reports">
        <Header title="Reports & Analytics" user={user} view={view}>
          <OpsButton onClick={exportCsv} busy={exporting}><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</OpsButton>
        </Header>
        <Filters value={filters} onChange={setFilters} show={['campaign', 'channel', ...(view.filter ? [view.filter] : [])]} />
        <p className="text-xs text-muted-foreground">Hover a chart for exact values, use “Show data” for the numbers behind it, and ⓘ for each definition.</p>
        <AnalyticsProvider role={user.role} filters={filters}><view.Reports /></AnalyticsProvider>
      </main>
    </TooltipProvider>
  );
}
