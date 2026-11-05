import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AiFilterSearch from '@/components/prospecting/AiFilterSearch';
import ApolloPreview from '@/components/prospecting/ApolloPreview';
import SavedSearches from '@/components/prospecting/SavedSearches';
import { getApolloStatus } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function ProspectingPage() {
  // Roles as the backend sends them at login. They only decide what is offered on screen;
  // the backend enforces who may use, share and edit saved searches.
  const role = useAuth().user?.role;
  const savedSearchesAvailable = role !== 'super_admin';
  const canShare = role === 'tenant_admin' || role === 'manager';

  const [tab, setTab] = useState('search');
  // Saved searches and Apollo Preview are first rendered when their tab is opened,
  // then kept so their state survives tab changes.
  const [opened, setOpened] = useState({ saved: false, apollo: false });
  // Changes whenever a filter is saved or updated in Search leads, so Saved searches reloads.
  const [savedVersion, setSavedVersion] = useState(0);
  // A saved search to load into Search leads; a new object each time, so the same one can be loaded twice.
  const [loadRequest, setLoadRequest] = useState(null);
  // The Apollo Preview tab is offered when a Super Admin has granted this user's tenant access and their role
  // may use it: GET /api/apollo/status → access_granted (a database check; it never calls Apollo). A service
  // problem, such as no API key, is shown inside the tab instead. Hiding the tab is display only: the backend
  // checks the grant on every Apollo request.
  const [apolloGranted, setApolloGranted] = useState(false);
  const wasGranted = useRef(false);

  const applyApolloStatus = useCallback((data) => {
    const granted = data?.access_granted === true;
    if (wasGranted.current && !granted) {
      // Revoked while the page was open: leave the tab for Search leads.
      setTab((current) => (current === 'apollo' ? 'search' : current));
      toast.info('Apollo Preview is no longer enabled for your organisation.');
    }
    wasGranted.current = granted;
    setApolloGranted(granted);
  }, []);

  const refreshApolloAccess = useCallback(() => {
    getApolloStatus().then(({ data }) => applyApolloStatus(data)).catch(() => applyApolloStatus(null));
  }, [applyApolloStatus]);

  // Checked when the page opens and again whenever the window regains focus.
  useEffect(() => {
    refreshApolloAccess();
    window.addEventListener('focus', refreshApolloAccess);
    return () => window.removeEventListener('focus', refreshApolloAccess);
  }, [refreshApolloAccess]);

  const changeTab = (next) => {
    setTab(next);
    if (next === 'saved' || next === 'apollo') setOpened((current) => ({ ...current, [next]: true }));
  };

  const editInSearchLeads = (saved) => {
    setLoadRequest({ saved });
    setTab('search');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" /> Prospecting
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Search and filter the prospects you already have. Describe who you are looking for in plain English, or reuse your saved searches.</p>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="search">Search leads</TabsTrigger>
          {savedSearchesAvailable && <TabsTrigger value="saved">Saved searches</TabsTrigger>}
          {apolloGranted && <TabsTrigger value="apollo">Apollo Preview</TabsTrigger>}
        </TabsList>

        {/* Each tab stays mounted while hidden, so it keeps its own filter and results. */}
        <TabsContent value="search" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <AiFilterSearch
            savedFiltersAvailable={savedSearchesAvailable}
            canShare={canShare}
            loadRequest={loadRequest}
            onSaved={() => setSavedVersion((version) => version + 1)}
          />
        </TabsContent>

        {savedSearchesAvailable && opened.saved && (
          <TabsContent value="saved" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <SavedSearches refreshKey={savedVersion} canShare={canShare} onEdit={editInSearchLeads} />
          </TabsContent>
        )}

        {apolloGranted && opened.apollo && (
          <TabsContent value="apollo" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <ApolloPreview onStatus={applyApolloStatus} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
