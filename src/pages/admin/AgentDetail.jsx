import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import { assignAdminAgent, applyAdminAgentTools, getAdminAgent, listTenants, previewAdminAgentTools, refreshAdminAgent } from '@/lib/api';

export default function AgentDetailPage() {
  const { agentId } = useParams(); const [agent, setAgent] = useState(null); const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(''); const [selected, setSelected] = useState([]); const [change, setChange] = useState(null);
  const [action, setAction] = useState(''); const [error, setError] = useState('');
  const load = useCallback(() => getAdminAgent(agentId).then((r) => { setAgent(r.data); setSelected(r.data.selected_tool_ids || []); }).catch((e) => setError(errorText(e, 'Could not load agent'))), [agentId]);
  useEffect(() => { load(); listTenants().then((r) => setTenants((r.data.tenants || []).filter((t) => t.status === 'active'))).catch(() => {}); }, [agentId, load]);
  const reasonAction = async (reason) => {
    try {
      if (action === 'refresh') await refreshAdminAgent(agentId, reason);
      if (action === 'assign') await assignAdminAgent(agentId, tenantId, reason);
      if (action === 'apply') { const r = await applyAdminAgentTools(agentId, selected, reason); if (r.data.status === 'failed') setError(r.data.message); }
      setAction(''); await load(); return true;
    } catch (e) { setError(errorText(e, 'Could not complete this action')); return false; }
  };
  const previewTools = async () => { try { setChange((await previewAdminAgentTools(agentId, selected)).data); } catch (e) { setError(errorText(e, 'Could not preview tool changes')); } };
  if (!agent) return <p className="text-sm" role="alert">{error || 'Loading agent…'}</p>;
  return <div className="max-w-5xl space-y-5"><p><Link className="underline text-sm" to="/admin/agents">← Agents</Link></p>
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">{agent.name}</h1><p className="text-xs text-muted-foreground">{agent.vapi_assistant_id} · {agent.status}{agent.owner ? ` · ${agent.owner.tenant_name}` : ' · Unassigned'}</p></div><Button variant="outline" onClick={() => setAction('refresh')}><RefreshCw className="w-4 h-4 mr-1"/>Refresh from Vapi</Button></header>
    {error && <Card role="alert" className="card-base p-3 border-destructive/40">{error}</Card>}
    {agent.warnings?.length > 0 && <Card className="card-base p-4 border-amber-500/40"><h2 className="font-semibold text-sm">Warnings</h2><ul className="list-disc pl-5 text-sm mt-2">{agent.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></Card>}
    <Card className="card-base p-5 space-y-3"><h2 className="font-semibold">Configuration snapshot</h2><p className="text-sm">Model: {agent.model?.provider} / {agent.model?.model} · Voice: {agent.voice?.provider} / {agent.voice?.voice_id} · Language: {agent.language || '—'}</p><p className="text-sm">Server URL: {agent.server?.points_to_smartsdr ? 'SmartSDR' : agent.server?.configured ? `Other (${agent.server.host || 'host hidden'})` : 'Not configured'}</p><p className="text-xs text-muted-foreground">Last fetched: {agent.last_fetched_at ? new Date(agent.last_fetched_at).toLocaleString() : 'Never'}</p>{agent.prompt_preview && <p className="text-sm whitespace-pre-wrap border rounded p-3">{agent.prompt_preview}</p>}</Card>
    {!agent.owner && <Card className="card-base p-5 space-y-3"><h2 className="font-semibold">Assign tenant</h2><div className="flex gap-2"><Select value={tenantId} onValueChange={setTenantId}><SelectTrigger aria-label="Tenant"><SelectValue placeholder="Choose active tenant"/></SelectTrigger><SelectContent>{tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}</SelectContent></Select><Button disabled={!tenantId} onClick={() => setAction('assign')}>Assign…</Button></div></Card>}
    <Card className="card-base p-5 space-y-3"><h2 className="font-semibold">Tenant granted tools</h2>{agent.owner ? agent.available_tools?.length ? agent.available_tools.map((tool) => <label key={tool.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected.includes(tool.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, tool.id] : prev.filter((id) => id !== tool.id))}/>{tool.name}</label>) : <p className="text-sm text-muted-foreground">No live tools are granted to this tenant.</p> : <p className="text-sm text-muted-foreground">Assign the agent before selecting tools.</p>}
      {agent.owner && <div className="flex gap-2"><Button variant="outline" onClick={previewTools}>Preview change</Button><Button onClick={() => setAction('apply')}>Apply tools…</Button></div>}
      {agent.tools_sync_status && <p className="text-sm">Sync state: {agent.tools_sync_status} {agent.tools_sync_error && <span className="text-destructive">· {agent.tools_sync_error}</span>}</p>}
      {change && <Card className="p-3 space-y-2"><b className="text-sm">Exact Vapi tool ID changes</b><p className="text-xs break-all">Add: {change.vapi_tool_ids_to_add.join(', ') || 'none'}</p><p className="text-xs break-all">Remove: {change.vapi_tool_ids_to_remove.join(', ') || 'none'}</p><p className="text-xs break-all">Final managed tool IDs: {change.tool_ids_after.join(', ') || 'none'}</p></Card>}
    </Card>
    <ReasonDialog open={Boolean(action)} onOpenChange={(open) => !open && setAction('')} title={action === 'assign' ? 'Assign to tenant?' : action === 'refresh' ? 'Refresh from Vapi?' : 'Apply selected tools?'} description={action === 'assign' ? 'This changes local tenant ownership only.' : action === 'refresh' ? 'Update the sanitized snapshot from the connected Vapi account.' : 'Send the previewed tool configuration to Vapi and record the change.'} changes={action === 'assign' ? ['Webhook calls will resolve to this tenant'] : action === 'apply' ? ['Only live tools already granted to the tenant can be selected'] : ['Update the local snapshot']} confirmLabel={action === 'apply' ? 'Apply' : action === 'assign' ? 'Assign' : 'Refresh'} reasonPlaceholder="Why is this change needed? The reason is kept in the admin audit trail." onConfirm={reasonAction}/>
  </div>;
}
