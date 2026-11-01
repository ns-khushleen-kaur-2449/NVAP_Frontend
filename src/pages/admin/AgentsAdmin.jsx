import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/components/admin/userBits';
import {
  createAgent, getAgentAccess, getAgentHealth, listAgentAssistants, listAgents, registerAgentAssistant,
  removeAgentAssistant, setAgentAccess, updateAgent,
} from '@/lib/api';
import { AGENT_STATUS_ACTIONS, AGENT_STATUS_LABELS, accessSummary, healthState, problemLabel } from '@/lib/agents';

const STATUS_STYLE = {
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  retired: 'bg-red-500/10 text-red-600 border-red-500/25',
};

const field = 'block text-xs font-medium text-muted-foreground';

const HEALTH = {
  ready: { label: 'Ready', style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  attention: { label: 'Needs attention', style: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  no_code: { label: 'No code on this server', style: 'bg-red-500/10 text-red-600 border-red-500/25' },
  unknown: { label: "Couldn't check", style: 'text-muted-foreground' },
};

/** ``health`` is undefined while loading, null when the check failed, else the endpoint's answer. */
function HealthCell({ health }) {
  if (health === undefined) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Checking" />;
  const state = healthState(health);
  // "no_code_pack" is what the badge already says.
  const problems = state === 'attention' ? health.problems : [];
  return (
    <div className="space-y-1">
      <Badge variant="outline" className={`text-[11px] ${HEALTH[state].style}`}>{HEALTH[state].label}</Badge>
      {problems.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4">
          {problems.map((code) => <li key={code}>{problemLabel(code)}</li>)}
        </ul>
      )}
    </div>
  );
}

function NewAgentDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ key: '', name: '', industry: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setForm({ key: '', name: '', industry: '', description: '' }); setError(null); }
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    if (!form.key.trim() || !form.name.trim()) { setError('A key and a name are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await createAgent({
        key: form.key.trim(), name: form.name.trim(),
        industry: form.industry.trim() || null, description: form.description.trim() || null,
      });
      toast.success(`${form.name.trim()} created as a draft`);
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e, 'Could not create the agent'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
          <DialogDescription>Starts as a draft: no organisation can use it until you activate it and open access.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className={field}>Key (lowercase letters, digits, underscores)
            <Input value={form.key} onChange={(e) => set({ key: e.target.value })} className="mt-1" placeholder="hiring" />
          </label>
          <label className={field}>Name
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
          </label>
          <label className={field}>Industry
            <Input value={form.industry} onChange={(e) => set({ industry: e.target.value })} className="mt-1" />
          </label>
          <label className={field}>Description
            <Input value={form.description} onChange={(e) => set({ description: e.target.value })} className="mt-1" />
          </label>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create agent
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({ agent, onClose, onSaved }) {
  const [scope, setScope] = useState('selected');
  const [tenants, setTenants] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agent) return undefined;
    let cancelled = false;
    setScope(agent.access_scope);
    setTenants(null);
    setError(null);
    getAgentAccess(agent.id).then((response) => {
      if (cancelled) return;
      setTenants(response.data);
      setSelected(new Set(response.data.filter((t) => t.granted).map((t) => t.tenant_id)));
    }).catch((e) => { if (!cancelled) setError(errorText(e, 'Could not load organisations')); });
    return () => { cancelled = true; };
  }, [agent]);

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setAgentAccess(agent.id, scope, scope === 'selected' ? [...selected] : []);
      toast.success('Access updated');
      onSaved?.();
      onClose();
    } catch (e) {
      setError(errorText(e, 'Could not update access'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]" data-testid="agent-access-dialog">
        <DialogHeader>
          <DialogTitle>Who can use {agent?.name}</DialogTitle>
          <DialogDescription>Only active agents reach organisations. Revoking takes effect at once.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" variant={scope === 'all' ? 'default' : 'outline'} aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}>All organisations</Button>
          <Button type="button" variant={scope === 'selected' ? 'default' : 'outline'} aria-pressed={scope === 'selected'}
            onClick={() => setScope('selected')}>Selected organisations</Button>
        </div>
        {scope === 'selected' && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {!tenants ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">There are no organisations yet.</p>
            ) : tenants.map((tenant) => (
              <label key={tenant.tenant_id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                <Checkbox checked={selected.has(tenant.tenant_id)} onCheckedChange={() => toggle(tenant.tenant_id)}
                  aria-label={tenant.name} />
                {tenant.name}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <DialogFooter>
          <Button onClick={save} disabled={saving || (scope === 'selected' && !tenants)} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssistantsDialog({ agent, onClose }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ vapi_assistant_id: '', name: '', purpose: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows((await listAgentAssistants(agent.id)).data);
    } catch (e) {
      setError(errorText(e, 'Could not load assistants'));
      setRows([]);
    }
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    setRows(null);
    setError(null);
    setForm({ vapi_assistant_id: '', name: '', purpose: '' });
    load();
  }, [agent, load]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const add = async () => {
    if (!form.vapi_assistant_id.trim() || !form.name.trim()) { setError('A Vapi assistant id and a name are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await registerAgentAssistant(agent.id, {
        vapi_assistant_id: form.vapi_assistant_id.trim(), name: form.name.trim(), purpose: form.purpose.trim() || null,
      });
      setForm({ vapi_assistant_id: '', name: '', purpose: '' });
      await load();
    } catch (e) {
      setError(errorText(e, 'Could not register the assistant'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row) => {
    try {
      await removeAgentAssistant(agent.id, row.id);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not remove the assistant'));
    }
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]" data-testid="agent-assistants-dialog">
        <DialogHeader>
          <DialogTitle>Shared assistants of {agent?.name}</DialogTitle>
          <DialogDescription>
            Vapi assistants every organisation using this agent shares. Only you see these ids; organisations cannot import or edit them.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border overflow-x-auto">
          {!rows ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No shared assistants registered yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Purpose</TableHead><TableHead>Vapi id</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm">{row.purpose || '—'}</TableCell>
                    <TableCell><code className="text-xs">{row.vapi_assistant_id}</code></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Remove ${row.name}`} onClick={() => remove(row)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className={field}>Vapi assistant id
            <Input value={form.vapi_assistant_id} onChange={(e) => set({ vapi_assistant_id: e.target.value })} className="mt-1" />
          </label>
          <label className={field}>Name
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
          </label>
          <label className={field}>Purpose
            <Input value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} className="mt-1" placeholder="intake" />
          </label>
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <DialogFooter>
          <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Register assistant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Super Admin: author the platform's agents, decide who may use them, and register their shared Vapi assistants. */
export default function AgentsAdminPage() {
  const [agents, setAgents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState(null);
  const [assistantsFor, setAssistantsFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [health, setHealth] = useState({});

  const load = useCallback(async () => {
    try {
      setAgents((await listAgents()).data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load agents'));
      setAgents([]);
    }
  }, []);

  // One check per agent; a failed check marks only that agent.
  const checkHealth = useCallback(async (list) => {
    setHealth({});
    const results = await Promise.allSettled(list.map((agent) => getAgentHealth(agent.id)));
    setHealth(Object.fromEntries(list.map((agent, i) => [
      agent.id, results[i].status === 'fulfilled' ? results[i].value.data : null,
    ])));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (agents?.length) checkHealth(agents); }, [agents, checkHealth]);

  const changeStatus = async (agent, status) => {
    setBusyId(agent.id);
    try {
      await updateAgent(agent.id, { status });
      toast.success(`${agent.name} is now ${AGENT_STATUS_LABELS[status].toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not change the status'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="agents-admin-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bot className="w-6 h-6 text-primary" /> Agent catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The agents the platform offers. Organisations only see an agent that is active and open to them, never its Vapi setup.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> New agent</Button>
      </div>

      <Card className="card-base p-4">
        {!agents ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No agents yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead>Available to</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">Health
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Check health again"
                        onClick={() => checkHealth(agents)}><RefreshCw className="w-3 h-3" /></Button>
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id} data-testid={`agent-row-${agent.key}`}>
                    <TableCell>
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.key}{agent.industry ? ` · ${agent.industry}` : ''}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] ${STATUS_STYLE[agent.status] || ''}`}>{AGENT_STATUS_LABELS[agent.status] || agent.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{accessSummary(agent)}</TableCell>
                    <TableCell data-testid={`agent-health-${agent.key}`}><HealthCell health={health[agent.id]} /></TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      {(AGENT_STATUS_ACTIONS[agent.status] || []).map((status) => (
                        <Button key={status} variant="outline" size="sm" disabled={busyId === agent.id}
                          onClick={() => changeStatus(agent, status)}>
                          {status === 'active' ? 'Activate' : status === 'retired' ? 'Retire' : 'Back to draft'}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setAccessFor(agent)}>Access</Button>
                      <Button variant="outline" size="sm" onClick={() => setAssistantsFor(agent)}>Assistants</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <NewAgentDialog open={creating} onOpenChange={setCreating} onCreated={load} />
      <AccessDialog agent={accessFor} onClose={() => setAccessFor(null)} onSaved={load} />
      <AssistantsDialog agent={assistantsFor} onClose={() => setAssistantsFor(null)} />
    </div>
  );
}
