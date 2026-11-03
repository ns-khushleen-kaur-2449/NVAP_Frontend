import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listAdminAgents } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const load = () => listAdminAgents().then((r) => setAgents(r.data.agents || [])).catch(() => setError('Could not load imported agents.'));
  useEffect(() => { load(); }, []);
  return <div className="max-w-5xl space-y-5">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold flex gap-2 items-center"><Bot className="w-6 h-6" />Agents</h1><p className="text-sm text-muted-foreground">Imported Vapi assistants and tenant assignment status.</p></div><Button asChild><Link to="/admin/agents/import"><Plus className="w-4 h-4 mr-1" />Import</Link></Button></header>
    {error && <p role="alert">{error}</p>}
    <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh list</Button>
    <div className="space-y-2">{agents.length ? agents.map((agent) => <Card className="card-base p-4" key={agent.id}><Link to={`/admin/agents/${agent.id}`} className="flex justify-between gap-3"><span><b>{agent.name || 'Unnamed assistant'}</b><span className="block text-xs text-muted-foreground">{agent.vapi_assistant_id}</span></span><span className="text-sm">{agent.owner?.tenant_name || agent.status}</span></Link></Card>) : <Card className="card-base p-5 text-sm text-muted-foreground">No imported agents yet.</Card>}</div>
  </div>;
}
