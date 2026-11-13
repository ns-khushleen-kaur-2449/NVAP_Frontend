import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Loader2, PlugZap, Plus, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  connectZoho, disconnectZoho, getZohoConnections, getZohoDeliveries, getZohoHealth, getZohoInboundEvents,
  getZohoFields, getZohoJobs, getZohoMappings, getZohoWebhookSetup, importZohoLeads, provisionZohoWebhookSecret,
  rotateZohoWebhookSecret, saveZohoMappings,
} from '@/lib/api';

const date = (value) => value ? new Date(value).toLocaleString() : '—';
const errorText = (error, fallback) => error?.response?.data?.detail?.message || error?.response?.data?.detail || fallback;
const statusClass = (value) => value === 'CONNECTED' || value === 'COMPLETED' || value === 'DELIVERED' || value === 'PROCESSED'
  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
  : value === 'ACTION_REQUIRED' || value === 'FAILED' ? 'bg-red-500/10 text-red-700 border-red-500/30'
    : 'bg-amber-500/10 text-amber-700 border-amber-500/30';

const SDR_PROSPECT_FIELDS = [
  'first_name', 'last_name', 'full_name', 'email', 'phone', 'job_title', 'source',
  'country', 'state', 'city', 'website', 'linkedin_url', 'timezone', 'language', 'region', 'priority_tier',
];

const RECOMMENDED_INBOUND_MAPPINGS = [
  { internal_field: 'first_name', external_field: 'First_Name', direction: 'INBOUND' },
  { internal_field: 'last_name', external_field: 'Last_Name', direction: 'INBOUND' },
  { internal_field: 'email', external_field: 'Email', direction: 'INBOUND' },
  { internal_field: 'phone', external_field: 'Phone', direction: 'INBOUND' },
  { internal_field: 'job_title', external_field: 'Designation', direction: 'INBOUND' },
  { internal_field: 'city', external_field: 'City', direction: 'INBOUND' },
];

/** Tenant-scoped Zoho setup. The backend, not this component, enforces scope. */
export default function ZohoIntegration({ tenantId, compact = false }) {
  const params = useMemo(() => tenantId ? { tenant_id: tenantId } : undefined, [tenantId]);
  const [connections, setConnections] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [zohoFields, setZohoFields] = useState([]);

  const loadConnections = useCallback(async (preferredId) => {
    try {
      const rows = (await getZohoConnections(params)).data.connections || [];
      setConnections(rows);
      setSelectedId((current) => preferredId || current || rows[0]?.connection_id || null);
    } catch (error) {
      toast.error(errorText(error, 'Unable to load Zoho connections'));
      setConnections([]);
    }
  }, [params]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    setLoadingDetail(true);
    try {
      const [health, setup, map, jobs, inbound, deliveries] = await Promise.all([
        getZohoHealth(selectedId, params), getZohoWebhookSetup(selectedId, params), getZohoMappings({ connection_id: selectedId, module: 'Leads', ...params }),
        getZohoJobs({ connection_id: selectedId, ...params }), getZohoInboundEvents({ connection_id: selectedId, ...params }),
        getZohoDeliveries({ connection_id: selectedId, ...params }),
      ]);
      setDetail({ health: health.data, setup: setup.data, jobs: jobs.data.jobs || [], inbound: inbound.data.events || [], deliveries: deliveries.data.deliveries || [] });
      setMappings(map.data.mappings || []);
    } catch (error) {
      toast.error(errorText(error, 'Unable to load Zoho sync details'));
    } finally {
      setLoadingDetail(false);
    }
  }, [params, selectedId]);

  const selected = connections?.find((row) => row.connection_id === selectedId) || null;
  const isConnected = selected?.connection_status === 'CONNECTED';

  useEffect(() => { loadConnections(); }, [loadConnections]);
  useEffect(() => {
    // Detail endpoints are intentionally restricted to active connections.
    // Avoid showing spurious 404 errors for a historical, disconnected card.
    if (isConnected) {
      loadDetail();
    } else {
      setDetail({});
      setMappings([]);
    }
  }, [isConnected, loadDetail]);
  useEffect(() => {
    if (!isConnected || !selectedId) {
      setZohoFields([]);
      return undefined;
    }
    let cancelled = false;
    getZohoFields({ connection_id: selectedId, module: 'Leads', ...(params || {}) })
      .then((response) => { if (!cancelled) setZohoFields(response.data.fields || []); })
      // Manual API-name entry remains available if Zoho field metadata is unavailable.
      .catch(() => { if (!cancelled) setZohoFields([]); });
    return () => { cancelled = true; };
  }, [isConnected, params, selectedId]);
  const beginOAuth = async (switchOrg = false) => {
    setBusy(true);
    try {
      const payload = { ...(params || {}), ...(selectedId ? { connection_id: selectedId } : {}), ...(switchOrg ? { confirm_org_switch: true } : {}) };
      const response = await connectZoho(payload);
      window.location.assign(response.data.authorization_url);
    } catch (error) {
      toast.error(errorText(error, 'Could not start Zoho authorization'));
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      await importZohoLeads(selectedId, params);
      toast.success('Lead import queued');
      await loadDetail();
    } catch (error) { toast.error(errorText(error, 'Could not queue the import')); }
    finally { setBusy(false); }
  };

  const revealSecret = async (rotate = false) => {
    setBusy(true);
    try {
      const response = rotate ? await rotateZohoWebhookSecret(selectedId, {}, params) : await provisionZohoWebhookSecret(selectedId, params);
      setSecret(response.data.secret);
      toast.success(rotate ? 'Webhook secret rotated' : 'Webhook secret provisioned');
      await loadDetail();
    } catch (error) { toast.error(errorText(error, 'Could not update the webhook secret')); }
    finally { setBusy(false); }
  };

  const saveMappings = async () => {
    const rows = mappings.filter((row) => row.internal_field?.trim() && row.external_field?.trim());
    if (new Set(rows.map((row) => row.internal_field)).size !== rows.length || new Set(rows.map((row) => row.external_field)).size !== rows.length) {
      toast.error('Each SDR and Zoho field can be mapped only once'); return;
    }
    setBusy(true);
    try {
      await saveZohoMappings(selectedId, { module: 'Leads', mappings: rows }, params);
      toast.success('Mappings saved'); await loadDetail();
    } catch (error) { toast.error(errorText(error, 'Could not save mappings')); }
    finally { setBusy(false); }
  };

  const addMapping = () => setMappings((all) => [...all, { internal_field: '', external_field: '', direction: 'INBOUND' }]);
  const addRecommendedMappings = () => {
    setMappings((all) => {
      const internals = new Set(all.map((row) => row.internal_field));
      const externals = new Set(all.map((row) => row.external_field));
      return [...all, ...RECOMMENDED_INBOUND_MAPPINGS.filter((row) => !internals.has(row.internal_field) && !externals.has(row.external_field))];
    });
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Zoho? Pending outbound deliveries will be settled and no data is deleted.')) return;
    setBusy(true);
    try {
      await disconnectZoho(selectedId, params); toast.success('Zoho disconnected'); setSelectedId(null); setSecret(null); await loadConnections();
    } catch (error) { toast.error(errorText(error, 'Could not disconnect Zoho')); }
    finally { setBusy(false); }
  };

  if (!connections) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!selected) return (
    <Card className="card-base p-6 text-center space-y-4" data-testid="zoho-empty-state">
      <PlugZap className="w-9 h-9 mx-auto text-primary" />
      <div><h2 className="font-semibold">Connect Zoho CRM</h2><p className="text-sm text-muted-foreground mt-1">Authorize your organisation to sync Leads with SmartSDR.</p></div>
      <Button onClick={() => beginOAuth(false)} disabled={busy} className="bg-primary text-primary-foreground"><PlugZap className="w-4 h-4 mr-1" /> Connect Zoho CRM</Button>
    </Card>
  );

  return (
    <div className="space-y-4" data-testid="zoho-integration">
      <Card className="card-base p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><h2 className="font-semibold">Zoho CRM</h2><Badge variant="outline" className={statusClass(selected.connection_status)}>{selected.connection_status}</Badge></div>
            <p className="text-sm text-muted-foreground mt-1">Organisation: {selected.provider_account_id || 'Unknown'} · Last successful sync: {date(selected.last_successful_sync_at)}</p>
            <p className="text-xs text-muted-foreground mt-1">Connection ID: <code>{selected.connection_id}</code></p></div>
          <div className="flex flex-wrap gap-2">
            {isConnected ? <>
              <Button variant="outline" size="sm" onClick={loadDetail} disabled={loadingDetail}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
              <Button variant="outline" size="sm" onClick={() => beginOAuth(false)} disabled={busy}>Reauthorize</Button>
              <Button variant="destructive" size="sm" onClick={disconnect} disabled={busy}><Trash2 className="w-4 h-4 mr-1" /> Disconnect</Button>
            </> : <Button onClick={() => beginOAuth(false)} disabled={busy} className="bg-primary text-primary-foreground"><PlugZap className="w-4 h-4 mr-1" /> Connect Zoho CRM</Button>}
          </div>
        </div>
        {selected.connection_status === 'ACTION_REQUIRED' && <p className="text-sm text-red-600">Zoho requires attention: {selected.last_error || 'Please reauthorize this connection.'}</p>}
        {!compact && isConnected && <div className="grid md:grid-cols-3 gap-3 text-sm"><div className="rounded border p-3"><p className="text-muted-foreground">Worker heartbeat</p><p>{date(detail.health?.worker_last_heartbeat_at)}</p></div><div className="rounded border p-3"><p className="text-muted-foreground">Failed deliveries</p><p>{detail.health?.failed_deliveries ?? '—'}</p></div><div className="rounded border p-3"><p className="text-muted-foreground">Webhook receipt</p><p>{date(detail.setup?.last_received_at)}</p></div></div>}
      </Card>

      {!compact && isConnected && <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="mappings">Field mapping</TabsTrigger><TabsTrigger value="import">Import Leads</TabsTrigger><TabsTrigger value="webhook">Webhooks</TabsTrigger><TabsTrigger value="history">Sync history</TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-4"><Card className="card-base p-5 space-y-3"><h3 className="font-medium">Setup checklist</h3><p className="text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Account connected</p><p className="text-sm flex gap-2"><ShieldCheck className={`w-4 h-4 ${detail.setup?.configured ? 'text-emerald-600' : 'text-muted-foreground'}`} /> Connection-specific webhook secret {detail.setup?.configured ? 'configured' : 'not configured'}</p><p className="text-sm text-muted-foreground">Deals export remains disabled until scopes and conversion policy are explicitly enabled.</p></Card></TabsContent>
        <TabsContent value="mappings" className="mt-4">
          <Card className="card-base p-5 space-y-5">
            <div className="space-y-1">
              <h3 className="font-medium">Lead field mappings</h3>
              <p className="text-sm text-muted-foreground">Choose the fields SmartSDR should update when a Zoho Lead is imported or changed by webhook.</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Mappings are saved together. You can add multiple rows; each SmartSDR field and Zoho field can be used once.
            </div>
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_80px] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>SmartSDR field</span><span>Zoho CRM field</span><span>Sync direction</span><span />
            </div>
            <div className="space-y-3">
              {mappings.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No explicit mappings yet. SmartSDR uses its recommended inbound fields until you save a custom set.</div>}
              {mappings.map((row, index) => <MappingRow key={`${row.internal_field}-${row.external_field}-${index}`} row={row} index={index} zohoFields={zohoFields} onChange={(patch) => setMappings((all) => all.map((value, i) => i === index ? { ...value, ...patch } : value))} onRemove={() => setMappings((all) => all.filter((_, i) => i !== index))} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button variant="outline" onClick={addMapping} disabled={busy}><Plus className="w-4 h-4 mr-1" /> Add field</Button>
              <Button variant="ghost" onClick={addRecommendedMappings} disabled={busy}>Add recommended fields</Button>
              <div className="flex-1" />
              <Button onClick={saveMappings} disabled={busy}>{busy ? 'Saving…' : 'Save mappings'}</Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="import" className="mt-4"><Card className="card-base p-5 space-y-3"><p className="text-sm text-muted-foreground">Imports Zoho Leads into this tenant only. Re-importing updates existing provider mappings rather than duplicating records.</p><Button onClick={runImport} disabled={busy}><Upload className="w-4 h-4 mr-1" /> Import Leads</Button></Card></TabsContent>
        <TabsContent value="webhook" className="mt-4"><Card className="card-base p-5 space-y-3"><p className="text-sm">Use this connection-specific URL and header in Zoho. The secret is shown only once.</p><Input readOnly value={detail.setup?.url || 'Set SERVER_URL to display the webhook URL'} /><pre className="rounded bg-muted p-3 text-xs overflow-auto">{JSON.stringify(detail.setup?.payload_template || {}, null, 2)}</pre>{secret && <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm"><p className="font-medium">Copy this webhook secret now. It cannot be retrieved again.</p><div className="flex gap-2 mt-2"><Input readOnly value={secret} /><Button variant="outline" onClick={() => navigator.clipboard?.writeText(secret).then(() => toast.success('Copied'))}><Copy className="w-4 h-4" /></Button></div></div>}<div className="flex gap-2"><Button onClick={() => revealSecret(false)} disabled={busy || detail.setup?.configured}><KeyRound className="w-4 h-4 mr-1" /> Provision secret</Button><Button variant="outline" onClick={() => revealSecret(true)} disabled={busy || !detail.setup?.configured}>Rotate secret</Button></div></Card></TabsContent>
        <TabsContent value="history" className="mt-4"><Card className="card-base p-5 space-y-5"><History title="Imports" rows={detail.jobs} columns={['status', 'module', 'created_at']} /><History title="Inbound webhooks" rows={detail.inbound} columns={['status', 'external_record_id', 'received_at']} /><History title="Outbound deliveries" rows={detail.deliveries} columns={['status', 'attempts', 'next_attempt_at', 'error_code']} /></Card></TabsContent>
      </Tabs>}
    </div>
  );
}

function MappingRow({ row, index, zohoFields, onChange, onRemove }) {
  const fieldListId = `zoho-lead-fields-${index}`;
  return <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_80px] md:items-center">
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground md:hidden">SmartSDR field</span>
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.internal_field} onChange={(event) => onChange({ internal_field: event.target.value })}>
        <option value="">Select a field</option>
        {SDR_PROSPECT_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
      </select>
    </label>
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground md:hidden">Zoho CRM field</span>
      <Input list={fieldListId} value={row.external_field} placeholder="Start typing an API field name" onChange={(event) => onChange({ external_field: event.target.value })} />
      <datalist id={fieldListId}>{zohoFields.map((field) => <option key={field.api_name} value={field.api_name}>{field.field_label || field.api_name}</option>)}</datalist>
    </label>
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground md:hidden">Sync direction</span>
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.direction} onChange={(event) => onChange({ direction: event.target.value })}>
        <option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option><option value="BIDIRECTIONAL">Bidirectional</option>
      </select>
    </label>
    <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground hover:text-destructive md:justify-self-end" onClick={onRemove}>Remove</Button>
  </div>;
}

function History({ title, rows = [], columns }) {
  return <section><h3 className="font-medium text-sm mb-2">{title}</h3>{rows.length === 0 ? <p className="text-sm text-muted-foreground">No records yet.</p> : <div className="overflow-auto"><table className="w-full text-sm"><tbody>{rows.map((row, index) => <tr key={row.job_id || row.event_id || row.delivery_id || index} className="border-t">{columns.map((column) => <td key={column} className="py-2 pr-3">{column === 'status' ? <Badge variant="outline" className={statusClass(row[column])}>{row[column]}</Badge> : String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>}</section>;
}
