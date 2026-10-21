import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { TopBar } from "@/components/layout/TopBar";
import { ExecSidebar } from "@/components/layout/ExecSidebar";
import { Sidebar } from "@/components/layout/Sidebar";
import SidebarTopBar from "@/components/layout/SidebarTopBar";
import DashboardPage from "@/pages/Dashboard";
import LeadsPage from "@/pages/Leads";
import ResearchPage from "@/pages/Research";
import ReportsPage from "@/pages/Reports";
// import CallsPage from "@/pages/Calls";
import PropertiesPage from "@/pages/Properties";
import SettingsPage from "@/pages/Settings";
import LoginPage from "@/pages/Login";
import AgentRunsPage from "@/pages/AgentRuns";
import VoiceAgentPage from "@/pages/VoiceAgent";
import VoiceCampaigns from "@/components/voice/VoiceCampaigns";
import VoiceCampaignDetail from "@/components/voice/VoiceCampaignDetail";
import LandingPage from "@/pages/LandingPage";
import MarketplaceListingsPage from "@/pages/MarketplaceListings";
import MarketplaceDetailsPage from "@/pages/MarketplaceDetails";
// import AdminDashboardPage from "@/pages/AdminDashboard";
import AudioUploadPage from "@/pages/AudioUpload";
import CallQualityDashboard from "@/pages/CallQualityDashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ProjectsPage from "@/pages/Projects";
// import AgentPerformancePage from "@/pages/AgentPerformance";
import GoogleSheetsSyncPage from "@/pages/GoogleSheetsSync";
import WeightConfigPage from "@/pages/WeightConfig";
import KnowledgeBasePage from "@/pages/KnowledgeBase";
// import ChatWidget from "@/components/shared/ChatWidget";
import ProspectingPage from "@/pages/Prospecting";
import StrategistPage from "@/pages/Strategist";
import ForbiddenPage from "@/pages/Forbidden";
import RoleDashboard from "@/pages/RoleDashboard";
import UsersAdminPage from "@/pages/admin/Users";
import TeamsAdminPage from "@/pages/admin/Teams";
import TenantsAdminPage from "@/pages/admin/Tenants";
import RequirePermission from "@/components/auth/RequirePermission";
import { PERMISSIONS } from "@/lib/rbac";
import AuthGate from "@/components/auth/AuthGate";
import InboxPage from "@/pages/Inbox";
import MeetingsPage from "@/pages/Meetings";
import { operationsRoutes } from "@/pages/Operations";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// The backend's roles (lib/rbac.js).  Older routes said "admin", a role that never existed.
const ADMINS = ['super_admin', 'tenant_admin'];
const ADMINS_AND_MANAGERS = ['super_admin', 'tenant_admin', 'manager'];

/** Shows LandingPage for guests; redirects logged-in users to /dashboard */
function SmartRoot() {
  const { user, token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (user || token) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

// Pages that get the persistent left Sidebar instead of the TopBar. Everything
// else in AppShell keeps the TopBar exactly as before.
const SIDEBAR_SECTION_PATHS = ['/dashboard', '/prospecting', '/strategist', '/inbox', '/meetings', '/settings',
  '/operations', '/leads'];

function AppShell() {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  const useSidebar = SIDEBAR_SECTION_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  const routes = (
    <Routes>
      <Route path="/dashboard" element={<RoleDashboard />} />
      <Route path="/welcome" element={<DashboardPage />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/research" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><ResearchPage /></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><ReportsPage /></ProtectedRoute>
      } />
      <Route path="/properties" element={<PropertiesPage />} />
      <Route path="/agent-runs" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><AgentRunsPage /></ProtectedRoute>
      } />
      <Route path="/prospecting" element={<ProspectingPage />} />
      <Route path="/strategist" element={<StrategistPage />} />
      {/* The SDR Campaigns pages are hidden for now; Voice Campaigns is the campaign page. */}
      <Route path="/campaigns/*" element={<Navigate to="/voice-campaigns" replace />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/meetings" element={<MeetingsPage />} />
      {/* Appointments, callbacks, do-not-call and intent review (old /appointments, /callbacks and /do-not-call redirect). */}
      {operationsRoutes()}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/settings/users" element={<RequirePermission perm={PERMISSIONS.USERS_VIEW}><UsersAdminPage /></RequirePermission>} />
      <Route path="/settings/teams" element={<RequirePermission perm={PERMISSIONS.TEAMS_MANAGE}><TeamsAdminPage /></RequirePermission>} />
      <Route path="/settings/tenants" element={<RequirePermission perm={PERMISSIONS.TENANTS_MANAGE}><TenantsAdminPage /></RequirePermission>} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/calendar" element={<SettingsPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  if (useSidebar) {
    return (
      <div className="app-shell-row">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <SidebarTopBar />
          <div className="page-content">{routes}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="page-content">{routes}</div>
    </div>
  );
}

function ExecAppShell({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="flex bg-background" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="p-3 shrink-0">
          <ExecSidebar />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="page-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// The main sidebar shell: TopBar-less, renders <Sidebar /> beside the page.
// Used by Voice Agent and Report Agent alike so following a link between them
// does not swap the chrome out from under the user.
function SidebarShell({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell-row bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <SidebarTopBar />
        <div className="page-content bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="smartsdr-theme">
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
        <Routes>
          <Route path="/" element={<SmartRoot />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/marketplace" element={<Navigate to="/" replace />} />
          <Route path="/marketplace/listings" element={<MarketplaceListingsPage />} />
          <Route path="/marketplace/listings/:id" element={<MarketplaceDetailsPage />} />
          {/* Admin dashboard — hidden for now; /admin falls through to the
              catch-all below and redirects to /dashboard.
          <Route path="/admin" element={
            <ProtectedRoute roles={ADMINS_AND_MANAGERS}>
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
          */}
          <Route path="/projects" element={<ExecAppShell><ProjectsPage /></ExecAppShell>} />
          <Route path="/audio-upload" element={<SidebarShell><AudioUploadPage /></SidebarShell>} />
          <Route path="/call-quality" element={<SidebarShell><CallQualityDashboard /></SidebarShell>} />
          <Route path="/manager-dashboard" element={<SidebarShell><ManagerDashboard /></SidebarShell>} />
          {/* <Route path="/agent-performance" element={<ExecAppShell><ProtectedRoute roles={ADMINS_AND_MANAGERS}><AgentPerformancePage /></ProtectedRoute></ExecAppShell>} /> */}
          <Route path="/sheets-sync" element={<SidebarShell><ProtectedRoute roles={ADMINS_AND_MANAGERS}><GoogleSheetsSyncPage /></ProtectedRoute></SidebarShell>} />
          <Route path="/weight-config" element={<SidebarShell><ProtectedRoute roles={ADMINS}><WeightConfigPage /></ProtectedRoute></SidebarShell>} />
          <Route path="/knowledge-base" element={<ExecAppShell><ProtectedRoute roles={ADMINS}><KnowledgeBasePage /></ProtectedRoute></ExecAppShell>} />

          <Route path="/voice_agent" element={<SidebarShell><VoiceAgentPage /></SidebarShell>} />
          <Route path="/voice-campaigns" element={<SidebarShell><VoiceCampaigns /></SidebarShell>} />
          <Route path="/voice-campaigns/:campaignId" element={<SidebarShell><VoiceCampaignDetail /></SidebarShell>} />
          {/* <Route path="/calls" element={<SidebarShell><CallsPage /></SidebarShell>} /> */}
          <Route path="/*" element={<AppShell />} />
        </Routes>
        </AuthGate>
        {/* <AuthedChatWidget /> */}
      </AuthProvider>

      <Toaster position="bottom-right" />
    </BrowserRouter>
    </ThemeProvider>
  );
}

// Chatbot launcher — hidden for now. Restore this plus the ChatWidget import
// and the <AuthedChatWidget /> render above to bring it back.
// function AuthedChatWidget() {
//   const { user, token } = useAuth();
//   if (!user && !token) return null;
//   return <ChatWidget />;
// }

export default App;
