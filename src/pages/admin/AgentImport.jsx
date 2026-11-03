import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Bot, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { errorText } from '@/components/admin/userBits';
import { assignAgent, listTenants, lookupAgent } from '@/lib/api';

const TOOL_KIND = { platform: 'Platform tool', unknown: 'Not a platform tool', inline: 'Inline' };

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{children || '—'}</dd>
    </div>
  );
}

function Warnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <Card className="card-base p-4 space-y-3 border-amber-500/40" data-testid="agent-warnings">
      <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Before this agent takes calls</h2>
      <ul className="space-y-2 text-sm">
        {warnings.map((w) => (
          <li key={w.code}>
            <p>{w.message}</p>
            {w.items?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5 break-all">{w.items.join(', ')}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Agent Fetch (Super Admin): find an existing Vapi assistant and assign it to one tenant. Nothing is changed in
 * Vapi and no tools are granted; an agent another tenant owns cannot be assigned (the backend answers 409).
 */
export default function AgentImportPage() {
  const [ref, setRef] = useState('');
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    listTenants().then((r) => setTenants((r.data?.tenants || []).filter((t) => t.status === 'active'))).catch(() => setTenants([]));
  }, []);

  const search = async (event) => {
    event.preventDefault();
    const value = ref.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setAgent(null);
    setResult(null);
    try {
      setAgent((await lookupAgent(value)).data);
    } catch (e) {
      setError(errorText(e, 'Could not look up the agent'));
    } finally {
      setLoading(false);
    }
  };

  const assign = async (reason) => {
    try {
      const response = await assignAgent(agent.vapi_assistant_id, tenantId, reason);
      setResult(response.data);
      setAgent({ ...response.data.agent, warnings: response.data.warnings });
      toast.success(response.data.already_assigned ? 'Already assigned to this tenant' : 'Agent assigned');
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not assign the agent'));
      return false;
    }
  };

  const owner = agent?.owner;
  const tenantName = tenants.find((t) => t.tenant_id === tenantId)?.name;

  return (
    <div className="max-w-4xl space-y-6" data-testid="agent-import-page">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bot className="w-6 h-6 text-primary" /> Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find an existing Vapi assistant and assign it to a tenant. The assistant itself is not changed and no tools are granted.
        </p>
      </div>

      <Card className="card-base p-4">
        <form onSubmit={search} className="flex flex-col sm:flex-row gap-2" role="search">
          <label htmlFor="agent-ref" className="sr-only">Vapi assistant ID or agent ID</label>
          <Input id="agent-ref" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off"
            placeholder="Vapi assistant ID, or this platform's agent ID" className="bg-[hsl(var(--surface-2))] border-border" />
          <Button type="submit" disabled={loading || !ref.trim()} className="bg-primary text-primary-foreground shrink-0">
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />} Look up
          </Button>
        </form>
      </Card>

      {error && (
        <Card className="card-base p-4 flex items-start gap-3 border-destructive/40" role="alert" data-testid="agent-error">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </Card>
      )}

      {agent && (
        <>
          <Card className="card-base p-5 space-y-4" data-testid="agent-preview">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold break-words">{agent.name || 'Unnamed assistant'}</h2>
                <p className="text-xs text-muted-foreground break-all">{agent.vapi_assistant_id}</p>
              </div>
              {owner
                ? <Badge variant="outline" className="text-[11px]" data-testid="agent-owner">Owned by {owner.tenant_name || owner.tenant_id}</Badge>
                : <Badge variant="outline" className="text-[11px]">Not assigned</Badge>}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fact label="Model">{[agent.model?.provider, agent.model?.model].filter(Boolean).join(' · ')}</Fact>
              <Fact label="Voice">{[agent.voice?.provider, agent.voice?.voice_id].filter(Boolean).join(' · ')}</Fact>
              <Fact label="Language">{agent.language}</Fact>
              <Fact label="Webhook (server URL)">
                {!agent.server?.configured ? 'Not set' : agent.server.points_to_smartsdr ? 'SmartSDR' : `Elsewhere (${agent.server.host})`}
              </Fact>
            </dl>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tools</p>
              {agent.tools?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((t, i) => (
                    <Badge key={`${t.kind}-${t.name || t.vapi_tool_id}-${i}`} variant="outline" className="text-[11px]" title={TOOL_KIND[t.kind]}>
                      {t.name || t.vapi_tool_id}{t.kind !== 'platform' && <span className="text-muted-foreground ml-1">({TOOL_KIND[t.kind]})</span>}
                    </Badge>
                  ))}
                </div>
              ) : <p className="text-sm">None</p>}
            </div>
            {agent.prompt_preview && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Prompt (start)</p>
                <p className="text-sm whitespace-pre-wrap rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3" dir="auto">{agent.prompt_preview}</p>
              </div>
            )}
          </Card>

          <Warnings warnings={agent.warnings} />

          <Card className="card-base p-5 space-y-3" data-testid="agent-assign">
            <h2 className="text-sm font-semibold">Assign to a tenant</h2>
            {result ? (
              <p className="text-sm flex items-center gap-2" data-testid="agent-assigned">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {result.already_assigned ? 'Already assigned to this tenant; nothing changed.' : `Assigned as agent #${result.assistant_id}.`}
              </p>
            ) : owner ? (
              <p className="text-sm text-muted-foreground" data-testid="agent-owned-note">
                {owner.tenant_name || 'Another tenant'} already owns this agent. An agent belongs to one tenant and is not reassigned here.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border sm:w-72" aria-label="Tenant">
                    <SelectValue placeholder="Choose an active tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button disabled={!tenantId} onClick={() => setConfirming(true)} className="bg-primary text-primary-foreground">Assign…</Button>
              </div>
            )}
          </Card>

          <ReasonDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={`Assign ${agent.name || 'this agent'} to ${tenantName || 'the tenant'}?`}
            description="Calls and tool requests from this assistant will be treated as this tenant's. Nothing changes in Vapi."
            changes={['A local agent record owned by the tenant is created', 'Tools are not granted (see the warnings)']}
            confirmLabel="Assign"
            reasonPlaceholder="Why? It is kept in the platform audit trail."
            onConfirm={assign}
          />
        </>
      )}
    </div>
  );
}
