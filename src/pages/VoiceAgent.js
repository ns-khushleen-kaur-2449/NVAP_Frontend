import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { getLeads, getProperties, getAssistants, initiateCsvCalls, getCsvCallResults, initiateRealEstateCall, scheduleVoiceCall, createKnowledgeBase, getKnowledgeFiles, getCalendarEvents, deleteCalendarEvent, createCalendarEvent, getDashboardStats, getSystemHealth, getVoiceCallStats } from '../lib/api';
import ScheduleFloatingButton from '../components/voice/ScheduleFloatingButton';
import ScheduleDrawer from '../components/voice/ScheduleDrawer';
import ReminderForm from '../components/voice/ReminderForm';
import SuccessToast from '../components/voice/SuccessToast';
import CallLogsList from '../components/voice/CallLogsList';
import LeadCampaignBuilder from '../components/voice/LeadCampaignBuilder';
import CreateAgent from '../components/voice/CreateAgent';
import KpiCard from '../components/shared/KpiCard';
import PendingRequestsQueue from '../components/admin/PendingRequestsQueue';
import WebhookLogViewer from '../components/admin/WebhookLogViewer';
import VoiceFleetDashboard from '../components/voice/VoiceFleetDashboard';
import VoiceAgentAnalytics from '@/components/shared/VoiceAgentAnalytics';
import { Calendar, Trash2, ExternalLink, Video, Loader2, PhoneCall, BookOpen, Mic, UploadCloud, Phone, AlertTriangle, CheckCircle2, RotateCw, AlertCircle, Activity, Layers, Clock, ChevronRight, Info, FileText, Database, Search, Copy, Check, LayoutDashboard } from 'lucide-react';

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
  { id: 'schedule',   label: 'Schedule a Call',        icon: Calendar },
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
  const [csvResults, setCsvResults] = useState(null);
  const [fetchingResults, setFetchingResults] = useState(false);
  const [calling, setCalling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbFile, setKbFile] = useState(null);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbFilesList, setKbFilesList] = useState([]);
  const [loadingKbFiles, setLoadingKbFiles] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Google Calendar events
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(null);

  // Voice Agent KPI metrics
  const [logsAssistant, setLogsAssistant] = useState({ id: '', name: '' });
  const [agentStats, setAgentStats] = useState(null);
  const [agentHealth, setAgentHealth] = useState(null);
  const [callStats, setCallStats] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  // Active sidebar tab
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const view = searchParams.get('view');
    const tab = searchParams.get('tab');
    if (view === 'logs' || tab === 'logs') return 'logs';
    if (tab && TABS.some(t => t.id === tab)) return tab;
    return 'dashboard';
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

  const fetchCalendarEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await getCalendarEvents();
      setCalendarEvents(res.data?.events || []);
    } catch {
      setCalendarEvents([]);
    }
    setLoadingEvents(false);
  }, []);

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
    if (activeTab === 'schedule') {
      fetchCalendarEvents();
    }
  }, [activeTab, fetchKbFiles, fetchCalendarEvents]);

  const refreshLeads = useCallback(async () => {
    try {
      const res = await getLeads({ limit: 1000 });
      setLeads(res.data?.leads || []);
    } catch (err) {
      console.error('Failed to refresh leads:', err);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingCampaignData(true);
      try {
        const [leadsRes, propsRes, assistantsRes] = await Promise.allSettled([
          getLeads({ limit: 1000 }),
          getProperties({}),
          getAssistants().catch(() => ({ data: [] }))
        ]);

        if (leadsRes.status === 'fulfilled') {
          setLeads(leadsRes.value.data?.leads || []);
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
    fetchCalendarEvents();
    
    // Fetch KPI data - restrictive to avoid slowness for non-admins
    const currentUser = JSON.parse(localStorage.getItem('estateops_user') || '{}');
    if (currentUser.role === 'admin') {
      getDashboardStats().then((res) => setAgentStats(res.data)).catch(() => setAgentStats(null));
      getSystemHealth().then((res) => setAgentHealth(res.data)).catch(() => setAgentHealth(null));
      getVoiceCallStats().then((res) => setCallStats(res.data)).catch(() => setCallStats(null));
    }
  }, [fetchCalendarEvents]);

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

  const handleCsvUpload = async () => {
    if (!csvFile) { toast.error('Select a CSV file first'); return; }
    setCsvUploading(true);
    try {
      const r = await initiateCsvCalls(csvFile);
      const processId = r.data?.process_id || r.data?.csv_process_id || r.data?.id || '';
      setCsvProcessId(processId ? String(processId) : '');
      toast.success('CSV call campaign initiated');
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to initiate CSV calls');
    }
    setCsvUploading(false);
  };

  const handleCampaignStarted = (processId) => {
    if (processId) {
      setCsvProcessId(String(processId));
      setTimeout(() => { handleFetchResults(String(processId)); }, 1500);
    }
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
      await initiateRealEstateCall({
        phone_number: callPhone,
        user_name: callName,
        assistant_id: selectedAssistantId || undefined
      });
      toast.success('Call initiated');
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to initiate call');
    }
    setCalling(false);
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);
    setScheduling(true);
    setScheduleError('');
    try {
      const lead = leads.find((l) => String(l.id) === String(selectedLeadId));
      const targetName = lead?.name || callName || 'Scheduled Meeting';
      const targetEmail = lead?.email || '';
      await createCalendarEvent({
        name: targetName,
        email: targetEmail,
        start_time: scheduledAt.toISOString(),
        subject: scheduleNotes ? `Meeting: ${scheduleNotes.substring(0, 50)}` : `Meeting with ${targetName}`,
      });
      setShowSuccess(true);
      setScheduleOpen(false);
      setScheduleNotes('');
      fetchCalendarEvents();
    } catch (e) {
      console.error(e);
      setScheduleError('Something went wrong. Please try again.');
    }
    setScheduling(false);
  };

  const getCampaignEventDetails = (description = '') => {
    if (!description.includes('Type: scheduled_campaign')) return null;
    const details = {};
    description.split('\n').forEach((line) => {
      const [rawKey, ...rest] = line.split(':');
      if (!rawKey || rest.length === 0) return;
      details[rawKey.trim().toLowerCase().replace(/\s+/g, '_')] = rest.join(':').trim();
    });
    return details;
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
  const completedCalls = callStats?.completed || 0;
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

  const handleViewAgentCalls = (vapiAssistantId, name) => {
    setLogsAssistant({ id: vapiAssistantId || '', name: name || '' });
    setActiveTab('logs');
  };

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
          <p className="text-sm text-muted-foreground">Upload a CSV to initiate bulk call campaigns</p>
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
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="bg-[hsl(var(--surface-2))] border-border"
              />
              <Button
                onClick={handleCsvUpload}
                disabled={csvUploading}
                className="bg-primary text-primary-foreground hover:bg-[#C2560E] shrink-0"
              >
                {csvUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : 'Initiate CSV Calls'}
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Fetch Results</label>
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
                  : 'No call history loaded yet. Upload a CSV or enter a process ID to get started.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
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
      <CreateAgent />
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

  const renderSchedule = () => (
    <div className="va-tab-content">
      <div className="va-tab-header">
        <div className="va-tab-icon-wrap"><Calendar className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-semibold">Schedule a Call</h2>
          <p className="text-sm text-muted-foreground">View upcoming events and schedule new calls</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Calendar Events */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Upcoming Events
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCalendarEvents}
                disabled={loadingEvents}
                className="border-border bg-card hover:bg-[hsl(var(--surface-2))] text-xs gap-1"
              >
                {loadingEvents ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingEvents && calendarEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : calendarEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No upcoming events found.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {calendarEvents.slice(0, 15).map((evt) => {
                  const startDate = evt.start ? new Date(evt.start) : null;
                  const timeStr = startDate
                    ? startDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';
                  const campaignDetails = getCampaignEventDetails(evt.description || '');
                  const isCampaignEvent = Boolean(campaignDetails);
                  return (
                    <div
                      key={evt.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 group ${
                        isCampaignEvent
                          ? 'border-[#F87217]/25 bg-[#F87217]/5 hover:bg-[#F87217]/8 hover:border-[#F87217]/40'
                          : 'border-border hover:bg-[hsl(var(--surface-2))] hover:border-[#F87217]/30'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isCampaignEvent ? 'bg-[#F87217]' : 'bg-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium truncate">{evt.summary || 'Untitled Event'}</p>
                          {isCampaignEvent && (
                            <Badge className="shrink-0 bg-[#F87217] text-white border-0 text-[9px] py-0">
                              Campaign
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{timeStr}</p>
                        {isCampaignEvent && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div className="rounded-md bg-white/70 px-2 py-1 border border-[#F87217]/10">
                              <span className="block text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Leads</span>
                              <span className="font-semibold text-gray-800">{campaignDetails.lead_count || '-'}</span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1 border border-[#F87217]/10">
                              <span className="block text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Assistant</span>
                              <span className="font-semibold text-gray-800 truncate block">{campaignDetails.assistant_id || '-'}</span>
                            </div>
                            {campaignDetails.notes && (
                              <div className="col-span-2 rounded-md bg-white/70 px-2 py-1 border border-[#F87217]/10">
                                <span className="block text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Notes</span>
                                <span className="text-gray-700 line-clamp-2">{campaignDetails.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {evt.attendees?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {evt.attendees.slice(0, 3).map((a, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] py-0 border-0 bg-[hsl(var(--surface-2))]">
                                {a.name || a.email}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {evt.hangoutLink && (
                          <a href={evt.hangoutLink} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-[#F87217]/8 text-primary transition-colors">
                            <Video className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {evt.htmlLink && (
                          <a href={evt.htmlLink} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-[hsl(var(--surface-2))] text-muted-foreground transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={async () => {
                            setDeletingEventId(evt.id);
                            try {
                              await deleteCalendarEvent(evt.id);
                              toast.success('Event deleted');
                              fetchCalendarEvents();
                            } catch {
                              toast.error('Failed to delete event');
                            }
                            setDeletingEventId(null);
                          }}
                          disabled={deletingEventId === evt.id}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          {deletingEventId === evt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Form */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              New Scheduled Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderForm
              scheduleDate={scheduleDate}
              setScheduleDate={setScheduleDate}
              scheduleTime={scheduleTime}
              setScheduleTime={setScheduleTime}
              scheduleNotes={scheduleNotes}
              setScheduleNotes={setScheduleNotes}
              onSubmit={handleSchedule}
              scheduling={scheduling}
              error={scheduleError}
              leadSelected={Boolean(selectedLeadId)}
              calendarEvents={calendarEvents}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':  return <VoiceFleetDashboard onNavigate={setActiveTab} onViewAgentCalls={handleViewAgentCalls} />;
      case 'analytics':  return <div className="va-tab-content"><VoiceAgentAnalytics /></div>;
      case 'single':     return renderSingleCall();
      case 'csv':        return renderCsvCampaign();
      case 'builder':    return renderBuilder();
      case 'logs':       return (
        <CallLogsList
          onClose={() => setActiveTab('dashboard')}
          assistantId={logsAssistant.id}
          assistantName={logsAssistant.name}
          onClearAssistant={() => setLogsAssistant({ id: '', name: '' })}
        />
      );
      case 'create':     return renderCreateAgent();
      case 'kb':         return renderKnowledgeBase();
      case 'schedule':   return renderSchedule();
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

      {/* Floating elements */}
      <ScheduleFloatingButton onClick={() => setScheduleOpen(true)} />
      <ScheduleDrawer
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title="Schedule a Call"
        subtitle="Pick a time and set a reminder"
      >
        <ReminderForm
          scheduleDate={scheduleDate}
          setScheduleDate={setScheduleDate}
          scheduleTime={scheduleTime}
          setScheduleTime={setScheduleTime}
          scheduleNotes={scheduleNotes}
          setScheduleNotes={setScheduleNotes}
          onSubmit={handleSchedule}
          scheduling={scheduling}
          error={scheduleError}
          leadSelected={Boolean(selectedLeadId)}
          calendarEvents={calendarEvents}
        />
      </ScheduleDrawer>
      <SuccessToast open={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
