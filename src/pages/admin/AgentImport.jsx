import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bot, Loader2, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import { fetchAdminAgent, importAdminAgent } from '@/lib/api';

export default function AgentImportPage() {
  const navigate = useNavigate();
  const [id, setId] = useState(''); const [preview, setPreview] = useState(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const fetch = async (event) => { event.preventDefault(); setBusy(true); setError(''); setPreview(null);
    try { setPreview((await fetchAdminAgent(id.trim())).data); }
    catch (e) { setError(errorText(e, 'Vapi could not find this assistant. It may not exist or may belong to another Vapi account.')); }
    finally { setBusy(false); }
  };
  const save = async (reason) => { try { const response = await importAdminAgent(preview.vapi_assistant_id, reason);
    navigate(`/admin/agents/${response.data.id}`); return true;
  } catch (e) { setError(errorText(e, 'Could not import this assistant')); return false; } };
  return <div className="max-w-4xl space-y-5">
    <header><h1 className="text-2xl font-semibold flex items-center gap-2"><Bot className="w-6 h-6" />Import Vapi assistant</h1><p className="text-sm text-muted-foreground mt-1">Fetch from the Vapi account connected to this backend, review the safe preview, then import locally.</p></header>
    <Card className="card-base p-4"><form onSubmit={fetch} className="flex gap-2"><Input aria-label="Vapi assistant ID" value={id} onChange={(e) => setId(e.target.value)} placeholder="Vapi assistant ID" /><Button disabled={busy || !id.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}Fetch</Button></form></Card>
    {error && <Card role="alert" className="card-base p-4 border-destructive/40 flex gap-2"><AlertTriangle className="w-4 h-4" />{error}</Card>}
    {preview && <Card className="card-base p-5 space-y-3"><div><h2 className="font-semibold">{preview.name || 'Unnamed assistant'}</h2><p className="text-xs text-muted-foreground break-all">{preview.vapi_assistant_id}</p></div><dl className="grid sm:grid-cols-2 gap-2 text-sm"><div>Model: {preview.model?.provider} / {preview.model?.model}</div><div>Voice: {preview.voice?.provider} / {preview.voice?.voice_id}</div><div>Language: {preview.language || '—'}</div><div>Server URL: {preview.server?.points_to_smartsdr ? 'SmartSDR' : preview.server?.configured ? `Other (${preview.server.host || 'host unavailable'})` : 'Not configured'}</div></dl><div><b className="text-sm">Tools</b><p className="text-sm">{preview.tools?.map((t) => t.name || t.vapi_tool_id || 'inline tool').join(', ') || 'None'}</p></div>{preview.prompt_preview && <p className="text-sm whitespace-pre-wrap border rounded p-3">{preview.prompt_preview}</p>}<p className="text-sm">Import state: {preview.status}{preview.owner?.tenant_name ? ` · owned by ${preview.owner.tenant_name}` : ''}</p>{preview.warnings?.length > 0 && <ul className="text-sm text-amber-700 list-disc pl-5">{preview.warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>}{!preview.imported && <Button onClick={() => setConfirm(true)}>Import locally…</Button>}{preview.imported && <Button variant="outline" onClick={() => navigate(`/admin/agents/${preview.local_agent_id}`)}>Open imported agent</Button>}</Card>}
    <ReasonDialog open={confirm} onOpenChange={setConfirm} title={`Import ${preview?.name || 'assistant'}?`} description="Creates one unassigned local record. It does not change the Vapi assistant." changes={['Store a sanitized dashboard snapshot', 'Assistant remains unassigned until assigned to a tenant']} confirmLabel="Import" reasonPlaceholder="Why is this assistant being imported?" onConfirm={save} />
  </div>;
}
