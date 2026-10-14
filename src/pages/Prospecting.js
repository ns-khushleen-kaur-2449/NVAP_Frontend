import { useState } from 'react';
import { Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AiFilterSearch from '@/components/prospecting/AiFilterSearch';
import ApolloPreview from '@/components/prospecting/ApolloPreview';
import SavedSearches from '@/components/prospecting/SavedSearches';
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
          <TabsTrigger value="apollo">Apollo Preview</TabsTrigger>
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

        {opened.apollo && (
          <TabsContent value="apollo" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <ApolloPreview />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
