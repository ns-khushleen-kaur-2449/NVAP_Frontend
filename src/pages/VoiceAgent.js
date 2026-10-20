import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { getProspects, getProperties, getAssistants, previewCampaignCsv, getCsvCallResults, initiateSmartsdrCall, createKnowledgeBase, getKnowledgeFiles, getDashboardStats, getSystemHealth, getVoiceCallStats } from '../lib/api';
import { toLeadRow } from '../lib/prospects';
import CallLogsList from '../components/voice/CallLogsList';
import LeadCampaignBuilder from '../components/voice/LeadCampaignBuilder';
import CampaignLaunchDialog from '../components/voice/CampaignLaunchDialog';
import AssistantBuilder from '../components/voice/AssistantBuilder';
import KpiCard from '../components/shared/KpiCard';
import PendingRequestsQueue from '../components/admin/PendingRequestsQueue';
import WebhookLogViewer from '../components/admin/WebhookLogViewer';
import VoiceDashboard from '../components/voice/VoiceDashboard';
import { useAuth } from '@/lib/AuthContext';
import { canViewAssistants } from '@/lib/rbac';
import VoiceAgentAnalytics from '@/components/shared/VoiceAgentAnalytics';
import { Loader2, PhoneCall, BookOpen, Mic, UploadCloud, Phone, AlertTriangle, CheckCircle2, RotateCw, Activity, Layers, Info, FileText, Database, Search, Copy, Check, LayoutDashboard } from 'lucide-react';

/* ─── Sidebar Tab Definitions (Voice Agent's own sub-views; nav itself now
   lives in the shared app Sidebar, components/layout/Sidebar.js) ─────────── */
const TABS = [
  { id: 'dashboard',  label: 'Dashboard',              icon: LayoutDashboard },
  { id: 'builder',    label: 'Lead-to-Campaign Builder', icon: Layers },
  { id: 'logs',       label: 'Call Logs',              icon: Phone },
  { id: 'create',     label: 'Create Agent',           icon: Mic },
  { id: 'kb',         label: 'Knowledge Base',         icon: BookOpen },
  { id: 'analytics',  label: 'Analytics',              icon: Activity },
  { id: 'csv',        label: 'CSV Call Campaign',      icon: UploadCloud },
  { id: 'single',     label: 'Single Call',            icon: PhoneCall },
];

export default function VoiceAgentPage() {
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [properties, setProperties] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [loadingCampaignData, setLoadingCampaignData] = useState(true);
  
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [callName, setCallName] = useState('');
  const [callPhone, setCallPhone] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvProcessId, setCsvProcessId] = useState('');
  // Parsed upload waiting for its campaign details: { contacts, filename, skipped }.
  const [csvSource, setCsvSource] = useState(null);
  const [csvResults, setCsvResults] = useState(null);
  const [fetchingResults, setFetchingResults] = useState(false);
  const [calling, setCalling] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbFile, setKbFile] = useState(null);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbFilesList, setKbFilesList] = useState([]);
  const [loadingKbFiles, setLoadingKbFiles] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Voice Agent KPI metrics
  const [logsAssistant, setLogsAssistant] = useState({ id: '', name: '' });
  const [agentStats, setAgentStats] = useState(null);
  const [agentHealth, setAgentHealth] = useState(null);
  const [callStats, setCallStats] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  // Active sidebar tab
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // The dashboard follows /api/v1/assistants: roles that cannot view assistants
  // (Sales Reps) land on the campaign builder instead.
  const { user } = useAuth();
  const canSeeDashboard = canViewAssistants(user);
  const homeTab = canSeeDashboard ? 'dashboard' : 'builder';
  const [activeTab, setActiveTab] = useState(() => {
    const view = searchParams.get('view');
    const tab = searchParams.get('tab');
    if (view === 'logs' || tab === 'logs') return 'logs';
    if (tab && TABS.some(t => t.id === tab) && (tab !== 'dashboard' || canSeeDashboard)) return tab;
    return homeTab;
  });
  useEffect(() => {
    const view = searchParams.get('view');
    const tab = searchParams.get('tab');
    if (view === 'logs' || tab === 'logs') {
      setActiveTab('logs');
    } else if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchKbFiles = useCallback(async () => {
    setLoadingKbFiles(true);
    try {
      const res = await getKnowledgeFiles();
      setKbFilesList(res.data || []);
    } catch (e) {
      console.error('Failed to fetch knowledge base files:', e);
      setKbFilesList([]);
    }
    setLoadingKbFiles(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'kb') {
      fetchKbFiles();
    }
  }, [activeTab, fetchKbFiles]);

  const refreshLeads = useCallback(async () => {
    try {
      const res = await getProspects({ leads_only: true, limit: 1000 });
      setLeads((res.data?.prospects || []).map(toLeadRow));
    } catch (err) {
      console.error('Failed to refresh leads:', err);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingCampaignData(true);
      try {
        const [leadsRes, propsRes, assistantsRes] = await Promise.allSettled([
          getProspects({ leads_only: true, limit: 1000 }),
          getProperties({}),
          getAssistants().catch(() => ({ data: [] }))
        ]);

        if (leadsRes.status === 'fulfilled') {
          setLeads((leadsRes.value.data?.prospects || []).map(toLeadRow));
        } else {
          setLeads([]);
        }
        setLoadingLeads(false);

        if (propsRes.status === 'fulfilled') {
          setProperties(propsRes.value.data?.properties || []);
        }

        if (assistantsRes.status === 'fulfilled') {
          setAssistants(assistantsRes.value.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch initial voice agent data:', err);
        setLeads([]);
        setLoadingLeads(false);
      } finally {
        setLoadingCampaignData(false);
      }
    };

    fetchInitialData();
    
    // Fetch KPI data - restrictive to avoid slowness for non-admins
    const currentUser = JSON.parse(localStorage.getItem('estateops_user') || '{}');
    if (currentUser.role === 'admin') {
      getDashboardStats().then((res) => setAgentStats(res.data)).catch(() => setAgentStats(null));
      getSystemHealth().then((res) => setAgentHealth(res.data)).catch(() => setAgentHealth(null));
      getVoiceCallStats().then((res) => setCallStats(res.data)).catch(() => setCallStats(null));
    }
  }, []);

  const leadOptions = useMemo(() => leads.map((lead) => ({
    id: String(lead.id),
    name: lead.name || lead.email || `Lead ${lead.id}`,
  })), [leads]);

  const liveAssistants = useMemo(() => {
    return assistants.filter((ast) => ast.is_live);
  }, [assistants]);

  useEffect(() => {
    if (liveAssistants.length > 0 && !selectedAssistantId) {
      setSelectedAssistantId(liveAssistants[0]?.vapi_assistant_id || '');
    }
  }, [liveAssistants, selectedAssistantId]);

  // An uploaded file is a campaign source: parse it, then collect the campaign details.
  const handleCsvUpload = async () => {
    if (!csvFile) { toast.error('Select a CSV file first'); return; }
    setCsvUploading(true);
    try {
      const r = await previewCampaignCsv(csvFile);
      if (r.data.skipped_rows) toast.warning(`${r.data.skipped_rows} row(s) skipped: missing or invalid phone number.`);
      setCsvSource({ type: 'csv', contacts: r.data.contacts, filename: r.data.filename });
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : (detail?.message || 'Could not read that file'));
    }
    setCsvUploading(false);
  };

  // Every launch, from leads or a file, lands on the new campaign's page.
  const handleCampaignStarted = (campaign) => {
    if (campaign?.id) navigate(`/voice-campaigns/${campaign.id}`);
  };

  const handleFetchResults = async (overrideId = null) => {
    const idToFetch = overrideId || csvProcessId;
    if (!idToFetch) { toast.error('Enter a CSV process id'); return; }
    setFetchingResults(true);
    try {
      const r = await getCsvCallResults(idToFetch);
      setCsvResults(r.data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to fetch call history');
      setCsvResults(null);
    }
    setFetchingResults(false);
  };

  const handleSingleCall = async () => {
    if (!callName || !callPhone) { toast.error('Enter name and phone number'); return; }
    setCalling(true);
    try {
      await initiateSmartsdrCall({
        phone_number: callPhone,
        user_name: callName,
        assistant_id: selectedAssistantId || undefined
      });
      toast.success('Call initiated', {
        description: 'It is listed in Call Logs now and updates when the call ends.',
        action: { label: 'View call logs', onClick: () => setActiveTab('logs') },
      });
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to initiate call');
    }
    setCalling(false);
  };

  const handleKnowledgeBase = async () => {
    if (!kbTitle && !kbContent && !kbFile) { toast.error('Add a title, content, or file'); return; }
    setKbSaving(true);
    try {
      await createKnowledgeBase({ title: kbTitle || undefined, content: kbContent || undefined }, kbFile);
      toast.success('Knowledge base updated');
      setKbTitle('');
      setKbContent('');
      setKbFile(null);
      // Reset input element
      const fileInput = document.getElementById('kb-file-input');
      if (fileInput) fileInput.value = '';
      fetchKbFiles();
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update knowledge base');
    }
    setKbSaving(false);
  };

  const formatCell = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const renderResultsTable = () => {
    const items = Array.isArray(csvResults?.results) ? csvResults.results : Array.isArray(csvResults) ? csvResults : null;
    // An empty array is still an array: fall through to the empty state rather than
    // rendering a bare header row with no rows under it.
    if (!items || items.length === 0) return null;
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
            <TableHead className="text-xs">Lead</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Scheduled</TableHead>
            <TableHead className="text-xs">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row, index) => (
            <TableRow key={row.id || index} className="hover:bg-[hsl(var(--surface-2))]">
              <TableCell className="text-sm">{formatCell(row.lead_name || row.lead_id)}</TableCell>
              <TableCell className="text-sm">{formatCell(row.status)}</TableCell>
              <TableCell className="text-sm font-mono text-xs">{formatCell(row.scheduled_at || row.created_at)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatCell(row.message || row.note)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };



  const totalCalls = callStats?.total || 0;
  const completedCalls = callStats?.connected || 0;
  const failedCalls = callStats?.failed || 0;
  const bookedCalls = callStats?.appointment_booked || 0;
  const failedRuns = agentStats?.agent_runs?.failed || 0;
  const successRuns = agentStats?.agent_runs?.success || 0;
  const totalRuns = agentStats?.agent_runs?.total || 1;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
  const pendingRetries = agentHealth?.leads_retry_pending || 0;
  const webhookErrors = agentHealth?.webhook_errors_total || 0;
  const manualFollowups = agentHealth?.leads_manual_followup || 0;

  const voiceKpis = [
    { id: 'total_calls', title: 'Total Calls', value: totalCalls, icon: Phone, color: '#F87217', panel: null },
    { id: 'pending_retries', title: 'Pending Retries', value: pendingRetries, icon: RotateCw, color: pendingRetries > 0 ? '#d97706' : '#F87217', panel: 'queue' },
    { id: 'webhook_errors', title: 'Webhook Errors', value: webhookErrors, icon: AlertTriangle, color: webhookErrors > 0 ? '#dc2626' : '#F87217', panel: 'logs' },
    { id: 'manual_followups', title: 'Manual Follow-ups', value: manualFollowups, icon: CheckCircle2, color: manualFollowups > 0 ? '#d97706' : '#F87217', panel: 'queue' },
  ];

  const handleKpiClick = (kpi) => {
    if (!kpi.panel) return;
    setActivePanel(prev => prev === kpi.panel ? null : kpi.panel);
  };

  /* ─── Content Renderers per Tab ────────────────────────────── */

  const renderSingleCall = () => (
    <div className="va-tab-content">
      <div className="va-tab-header">
        <div className="va-tab-icon-wrap"><PhoneCall className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-semibold">Single Call</h2>
          <p className="text-sm text-muted-foreground">Initiate a direct call to a single lead or contact</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {voiceKpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            onClick={() => handleKpiClick(kpi)}
            className={`${kpi.panel ? 'cursor-pointer' : ''} ${activePanel === kpi.panel ? 'ring-2 ring-primary/40 shadow-md' : ''}`}
          />
        ))}
      </div>

      {/* Action Required Queue */}
      {activePanel === 'queue' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <PendingRequestsQueue
            pendingLeads={agentHealth?.retry_pending_leads || []}
            manualFollowups={agentHealth?.manual_followup_leads || []}
          />
        </div>
      )}

      {/* System Logs */}
      {activePanel === 'logs' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <WebhookLogViewer
            webhookErrors={agentHealth?.webhook_errors || []}
            dlqItems={agentHealth?.dlq_items || []}
          />
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Select Lead</label>
            <Select
              value={selectedLeadId}
              onValueChange={(value) => {
                setSelectedLeadId(value);
                const match = leads.find((lead) => String(lead.id) === value);
                setCallName(match?.name || '');
                setCallPhone(match?.phone || '');
              }}
            >
              <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                <SelectValue placeholder={loadingLeads ? 'Loading leads...' : 'Select a lead'} />
              </SelectTrigger>
              <SelectContent>
                {leadOptions.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Customer Name</label>
              <Input
                placeholder="Enter customer name"
                value={callName}
                onChange={(e) => setCallName(e.target.value)}
                className="bg-[hsl(var(--surface-2))] border-border"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Phone Number</label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={callPhone}
                onChange={(e) => setCallPhone(e.target.value)}
                className="bg-[hsl(var(--surface-2))] border-border"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Select Voice Assistant</label>
            <Select
              value={selectedAssistantId}
              onValueChange={setSelectedAssistantId}
              disabled={liveAssistants.length === 0}
            >
              <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border">
                <SelectValue placeholder={liveAssistants.length === 0 ? "No agents available — publish an agent first." : "Select an assistant"} />
              </SelectTrigger>
              <SelectContent>
                {liveAssistants.map((ast) => (
                  <SelectItem key={ast.vapi_assistant_id} value={ast.vapi_assistant_id}>
                    {ast.name} ({ast.voice_provider || 'Vapi'} voice)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSingleCall}
            disabled={calling}
            className="w-full ai-btn-glow bg-primary text-primary-foreground hover:bg-[#C2560E] h-11 text-sm font-medium"
          >
            {calling ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Initiating Call...</>
            ) : (
              <><Phone className="w-4 h-4 mr-2" /> Initiate Call</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderCsvCampaign = () => (
    <div className="va-tab-content">
      <div className="va-tab-header">
        <div className="va-tab-icon-wrap"><UploadCloud className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-semibold">CSV Call Campaign</h2>
          <p className="text-sm text-muted-foreground">Upload a contact file, then fill in the campaign details to start or schedule it</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
        <Info className="w-4 h-4 shrink-0 text-amber-500" />
        <p className="text-xs">
          <span className="font-semibold">Temporary:</span> In production, leads will be pulled automatically from <span className="font-semibold">Zoho CRM</span>.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Upload CSV File</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="bg-[hsl(var(--surface-2))] border-border"
              />
              <Button
                onClick={handleCsvUpload}
                disabled={csvUploading}
                className="bg-primary text-primary-foreground hover:bg-[#C2560E] shrink-0"
              >
                {csvUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Reading file...</> : 'Launch Campaign'}
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Older CSV runs</label>
            <p className="text-[11px] text-muted-foreground mb-2">New uploads are campaigns: follow them under Voice Campaigns. Enter a process id to see a run from before that change.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="CSV process id"
                value={csvProcessId}
                onChange={(e) => setCsvProcessId(e.target.value)}
                className="bg-[hsl(var(--surface-2))] border-border"
              />
              <Button
                variant="outline"
                onClick={() => handleFetchResults()}
                disabled={fetchingResults}
                className="border-border bg-card hover:bg-[hsl(var(--surface-2))] shrink-0"
              >
                {fetchingResults ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</> : 'Fetch Call History'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-[hsl(var(--surface-2))] overflow-hidden">
            {renderResultsTable() || (
              <p className="text-sm text-muted-foreground p-8 text-center">
                {csvResults
                  ? 'No calls found for that process ID yet.'
                  : 'No call history loaded yet. Enter a process ID from an older CSV run.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CampaignLaunchDialog
        open={Boolean(csvSource)}
        onOpenChange={(open) => { if (!open) setCsvSource(null); }}
        source={csvSource}
        assistants={liveAssistants.length ? liveAssistants : assistants}
        defaultAssistantId={selectedAssistantId}
        onCreated={handleCampaignStarted}
      />
    </div>
  );

  const renderBuilder = () => (
    <div className="va-tab-content h-full">
      <div className="h-[calc(100vh-90px)]">
        <LeadCampaignBuilder 
          onCampaignStarted={handleCampaignStarted} 
          onLeadCreated={refreshLeads}
          leads={leads}
          properties={properties}
          assistants={assistants}
          loading={loadingCampaignData}
        />
      </div>
    </div>
  );

  const renderCreateAgent = () => (
    <div className="va-tab-content h-[calc(100vh-180px)]">
      <AssistantBuilder />
    </div>
  );

  const renderKnowledgeBase = () => {
    const formatBytes = (bytes) => {
      if (!bytes) return '0 Bytes';
      const num = Number(bytes);
      if (isNaN(num)) return bytes;
      if (num === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(num) / Math.log(k));
      return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleCopyId = (id) => {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('Vapi File ID copied!');
      setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredFiles = kbFilesList.filter((f) => {
      if (!kbSearchQuery) return true;
      return (
        f.name?.toLowerCase().includes(kbSearchQuery.toLowerCase()) ||
        f.id?.toLowerCase().includes(kbSearchQuery.toLowerCase())
      );
    });

    return (
      <div className="va-tab-content">
        <div className="va-tab-header">
          <div className="va-tab-icon-wrap"><BookOpen className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground">Train your voice agent with custom scripts and documents</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel: Upload/Notes Form */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-primary" />
                  Add Knowledge
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Title</label>
                  <Input
                    placeholder="Knowledge base title"
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    className="bg-[hsl(var(--surface-2))] border-border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Content / Notes</label>
                  <Textarea
                    placeholder="Add custom notes, FAQs, or call scripts for your voice assistant to reference..."
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    className="bg-[hsl(var(--surface-2))] border-border min-h-[160px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Upload Document</label>
                  <Input
                    id="kb-file-input"
                    type="file"
                    onChange={(e) => setKbFile(e.target.files?.[0] || null)}
                    className="bg-[hsl(var(--surface-2))] border-border text-sm file:text-primary file:font-semibold file:bg-primary/5 file:border-primary/10 file:rounded-md"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Supports PDF, TXT, DOCX, etc. (Max 10MB)</p>
                </div>
                <Button
                  onClick={handleKnowledgeBase}
                  disabled={kbSaving}
                  className="w-full ai-btn-glow bg-primary text-primary-foreground hover:bg-[#C2560E] h-10 text-xs font-medium mt-2"
                >
                  {kbSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                  ) : (
                    <><BookOpen className="w-4 h-4 mr-2" /> Train Assistant</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Knowledge Library Browser */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Knowledge Library ({filteredFiles.length})
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchKbFiles}
                  disabled={loadingKbFiles}
                  className="border-border bg-card hover:bg-[hsl(var(--surface-2))] text-xs h-8 gap-1.5"
                >
                  <RotateCw className={`w-3 h-3 ${loadingKbFiles ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search library documents by name or ID..."
                    value={kbSearchQuery}
                    onChange={(e) => setKbSearchQuery(e.target.value)}
                    className="pl-9 bg-[hsl(var(--surface-2))] border-border text-sm h-9"
                  />
                </div>

                {/* Library Files List */}
                <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-2.5">
                  {loadingKbFiles && filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">Loading knowledge library files...</p>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-[hsl(var(--surface-1))]">
                      <FileText className="w-10 h-10 text-muted-foreground opacity-30 mb-2" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {kbSearchQuery ? 'No matching documents found' : 'No documents in library'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">
                        {kbSearchQuery 
                          ? 'Try resetting your search query or check the file name.' 
                          : 'Use the left form to upload documents or scripts to train your voice assistant.'}
                      </p>
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group relative flex items-start gap-3 p-3.5 rounded-xl border border-border bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--surface-2))] hover:border-[#F87217]/30 transition-all duration-200 shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-medium truncate text-foreground pr-4" title={file.name}>
                              {file.name}
                            </h4>
                            <span className="shrink-0 flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-[9px] font-semibold px-2 py-0.5 rounded-full select-none">
                              <Check className="w-2.5 h-2.5" />
                              Vapi Parsed
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                            <span>Size: {formatBytes(file.size)}</span>
                            <span>•</span>
                            <span className="font-mono text-[9px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                              ID: {file.id || 'N/A'}
                              {file.id && (
                                <button
                                  onClick={() => handleCopyId(file.id)}
                                  className="ml-1 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                                  title="Copy Vapi File ID"
                                >
                                  {copiedId === file.id ? (
                                    <Check className="w-2.5 h-2.5 text-green-500" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':  return canSeeDashboard ? <VoiceDashboard onNavigate={setActiveTab} /> : renderBuilder();
      case 'analytics':  return <div className="va-tab-content"><VoiceAgentAnalytics /></div>;
      case 'single':     return renderSingleCall();
      case 'csv':        return renderCsvCampaign();
      case 'builder':    return renderBuilder();
      case 'logs':       return (
        <CallLogsList
          onClose={() => setActiveTab(homeTab)}
          assistantId={logsAssistant.id}
          assistantName={logsAssistant.name}
          onClearAssistant={() => setLogsAssistant({ id: '', name: '' })}
        />
      );
      case 'create':     return renderCreateAgent();
      case 'kb':         return renderKnowledgeBase();
      default:           return renderSingleCall();
    }
  };

  return (
    <div className="va-layout">
      {/* Nav is now handled by the shared app Sidebar (components/layout/Sidebar.js),
          which links here as /voice_agent?tab=<id> — read via searchParams above. */}
      <main className="va-main">
        {renderContent()}
      </main>

    </div>
  );
}
