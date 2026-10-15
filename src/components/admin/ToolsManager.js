import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Building2, Eye, Loader2, Pencil, Plus, RefreshCw, Trash2, Wrench, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createTool, deleteTool, getToolTenants, listTools, listToolTypes, previewTool, setToolTenants, syncTool, updateTool,
} from '@/lib/api';

const SYNC_STYLES = {
  active: { label: 'Synced', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  failed: { label: 'Sync failed', className: 'bg-red-500/10 text-red-600 border-red-500/25' },
};

// Vapi tool message types (see docs/tools/tools.md in the backend).
const MESSAGE_TYPES = [
  { value: 'request-start', label: 'When the tool starts' },
  { value: 'request-complete', label: 'When the tool completes' },
  { value: 'request-failed', label: 'When the tool fails' },
  { value: 'request-response-delayed', label: 'When the response is slow' },
];

const fieldClass = 'mt-1 bg-[hsl(var(--surface-2))] border-border';

// Backend errors come as {detail: {errors: [...]}} (tool validation), a string, or Pydantic's list.
const errorList = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail?.errors)) return detail.errors;
  if (typeof detail === 'string') return [detail];
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = (d.loc || []).filter((p) => p !== 'body').join('.');
      return field ? `${field}: ${d.msg}` : d.msg;
    });
  }
  return [fallback];
};

const isFunction = (toolType) => toolType?.vapi_type === 'function';

function formFrom(definition, typeKey) {
  return {
    type_key: typeKey,
    name: definition.name || '',
    description: definition.description || '',
    request_schema_text: definition.request_schema ? JSON.stringify(definition.request_schema, null, 2) : '',
    response_template: definition.response_template || '',
    messages: (definition.messages || []).map((m) => ({ ...m })),
    settings: {
      async: Boolean(definition.settings?.async),
      timeout_seconds: definition.settings?.timeout_seconds ?? 20,
      server_path: definition.settings?.server_path || '',
    },
  };
}

// Build the API body; throws an Error with a readable message for a bad JSON schema.
function definitionFrom(form, toolType) {
  const messages = form.messages.map((m) => {
    const base = { type: m.type, content: m.content };
    if (m.type === 'request-start') return { ...base, blocking: Boolean(m.blocking) };
    if (m.type === 'request-response-delayed') return { ...base, timingMilliseconds: Number(m.timingMilliseconds) || 3000 };
    return base;
  });
  const body = { name: form.name.trim(), description: form.description, messages };
  if (!isFunction(toolType)) return body;
  let schema;
  try {
    schema = JSON.parse(form.request_schema_text);
  } catch {
    throw new Error('Request schema is not valid JSON');
  }
  return {
    ...body,
    request_schema: schema,
    response_template: form.response_template.trim() ? form.response_template : null,
    settings: {
      async: form.settings.async,
      timeout_seconds: Number(form.settings.timeout_seconds),
      server_path: form.settings.server_path,
    },
  };
}

function SyncBadge({ status }) {
  const style = SYNC_STYLES[status] || SYNC_STYLES.pending;
  return <Badge variant="outline" className={style.className}>{style.label}</Badge>;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function MessagesEditor({ messages, onChange }) {
  const update = (index, patch) => onChange(messages.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Select value={m.type} onValueChange={(v) => update(i, { type: v })}>
              <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {m.type === 'request-response-delayed' && (
              <Input
                type="number" min={100} max={120000} value={m.timingMilliseconds ?? 3000}
                onChange={(e) => update(i, { timingMilliseconds: e.target.value })}
                className="w-28 h-8 text-xs bg-[hsl(var(--surface-2))] border-border" title="After (ms)"
              />
            )}
            {m.type === 'request-start' && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <Switch checked={Boolean(m.blocking)} onCheckedChange={(v) => update(i, { blocking: v })} /> Wait to finish
              </label>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => onChange(messages.filter((_, j) => j !== i))}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input value={m.content} maxLength={1000} onChange={(e) => update(i, { content: e.target.value })}
            placeholder="What the assistant says" className="bg-[hsl(var(--surface-2))] border-border" />
        </div>
      ))}
      {messages.length < 10 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...messages, { type: 'request-start', content: '' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add message
        </Button>
      )}
    </div>
  );
}

function ToolEditorDialog({ open, onOpenChange, types, tool, onSaved }) {
  const editing = Boolean(tool);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null); // 'save' | 'preview'
  const toolType = types.find((t) => t.type_key === form?.type_key);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setPreview(null);
    if (tool) setForm(formFrom(tool, tool.type_key));
    else if (types[0]) setForm(formFrom(types[0].default_definition, types[0].type_key));
  }, [open, tool, types]);

  if (!form) return null;
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setPreview(null); };
  const setSettings = (patch) => set({ settings: { ...form.settings, ...patch } });

  const chooseType = (typeKey) => {
    const next = types.find((t) => t.type_key === typeKey);
    setForm(formFrom(next.default_definition, typeKey));
    setErrors([]);
    setPreview(null);
  };

  const body = () => {
    try {
      return definitionFrom(form, toolType);
    } catch (e) {
      setErrors([e.message]);
      return null;
    }
  };

  const runPreview = async () => {
    const draft = body();
    if (!draft) return;
    setBusy('preview');
    try {
      const res = await previewTool(editing ? { tool_id: tool.id, draft } : { type_key: form.type_key, draft });
      setPreview(res.data);
      setErrors(res.data.errors || []);
    } catch (e) {
      setErrors(errorList(e, 'Preview failed'));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const draft = body();
    if (!draft) return;
    setBusy('save');
    try {
      const res = editing
        ? await updateTool(tool.id, draft)
        : await createTool({ type_key: form.type_key, overrides: draft });
      if (res.data.sync_status === 'failed') {
        toast.warning(`Saved, but Vapi sync failed: ${res.data.last_error}`);
      } else {
        toast.success(editing ? 'Tool updated in Vapi' : 'Tool created in Vapi');
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setErrors(errorList(e, 'Failed to save tool'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${tool.name}` : 'New tool'}</DialogTitle>
          <DialogDescription>
            {toolType?.summary} Saving sends the tool to Vapi{editing ? ' and updates the same Vapi tool' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tool type">
              <Select value={form.type_key} onValueChange={chooseType} disabled={editing}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t.type_key} value={t.type_key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Name" hint="Lowercase letters, digits and underscores (max 64).">
              <Input value={form.name} maxLength={64} onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
            </Field>
          </div>

          <Field
            label="Description"
            hint="Tells the assistant when to use this tool."
          >
            <Textarea value={form.description} maxLength={1000} rows={3} onChange={(e) => set({ description: e.target.value })} className={`${fieldClass} resize-none`} />
          </Field>

          {isFunction(toolType) && (
            <>
              <Field label="Request schema (JSON Schema)">
                {toolType.contract.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[11px] text-muted-foreground">Required, cannot be removed or retyped:</span>
                    {toolType.contract.map((c) => (
                      <Badge key={c.name} variant="secondary" className="text-[11px]">{c.name}: {c.type}</Badge>
                    ))}
                  </div>
                )}
                <Textarea
                  value={form.request_schema_text} rows={10} spellCheck={false}
                  onChange={(e) => set({ request_schema_text: e.target.value })}
                  className={`${fieldClass} font-mono text-xs`}
                />
              </Field>

              <Field
                label="Response template"
                hint={`Jinja2 text the assistant receives after the tool runs. Sample values: ${Object.keys(toolType.sample_data || {}).join(', ') || 'none'}.`}
              >
                <Textarea value={form.response_template} maxLength={2000} rows={4} spellCheck={false}
                  onChange={(e) => set({ response_template: e.target.value })} className={`${fieldClass} font-mono text-xs`} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Timeout (seconds)">
                  <Input type="number" min={1} max={300} value={form.settings.timeout_seconds}
                    onChange={(e) => setSettings({ timeout_seconds: e.target.value })} className={fieldClass} />
                </Field>
                <Field label="Webhook path" hint="Under the server's SERVER_URL.">
                  <Input value={form.settings.server_path} onChange={(e) => setSettings({ server_path: e.target.value })} className={fieldClass} />
                </Field>
                <Field label="Run in background">
                  <div className="flex items-center gap-2 mt-2.5">
                    <Switch checked={form.settings.async} onCheckedChange={(v) => setSettings({ async: v })} />
                    <span className="text-xs text-muted-foreground">Don't wait for the result</span>
                  </div>
                </Field>
              </div>
            </>
          )}

          <Field label="Spoken messages">
            <div className="mt-1">
              <MessagesEditor messages={form.messages} onChange={(messages) => set({ messages })} />
            </div>
          </Field>

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-600 space-y-1">
              {errors.map((err) => <p key={err} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{err}</p>)}
            </div>
          )}

          {preview?.valid && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold">Preview</h4>
                {preview.would_change !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    {preview.would_change ? 'Saving will update the Vapi tool.' : 'No change for Vapi.'}
                  </span>
                )}
              </div>
              {preview.rendered_response && (
                <div>
                  <p className="text-[11px] text-muted-foreground">Response with sample data</p>
                  <p className="text-sm">{preview.rendered_response}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">Payload sent to Vapi</p>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-[hsl(var(--surface-2))] p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(preview.vapi_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={runPreview} disabled={Boolean(busy)}>
            {busy === 'preview' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />} Preview
          </Button>
          <Button onClick={save} disabled={Boolean(busy)} className="bg-primary text-primary-foreground">
            {busy === 'save' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {editing ? 'Save changes' : 'Create tool'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Super Admin: which tenants may use one tool.  Unticking a tenant removes the tool from its agents. */
function TenantAccessDialog({ tool, onOpenChange, onSaved }) {
  const [tenants, setTenants] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tool) return;
    setTenants(null);
    getToolTenants(tool.id)
      .then((res) => {
        setTenants(res.data.tenants);
        setSelected(new Set(res.data.tenants.filter((t) => t.granted).map((t) => t.tenant_id)));
      })
      .catch((e) => toast.error(errorList(e, 'Failed to load tenants')[0]));
  }, [tool]);

  const toggle = (id, on) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const save = async () => {
    const losing = (tenants || []).filter((t) => t.granted && !selected.has(t.tenant_id) && t.assistant_count > 0);
    if (losing.length && !window.confirm(
      `${losing.map((t) => t.name).join(', ')} will lose this tool on ${losing.reduce((n, t) => n + t.assistant_count, 0)} agent(s). Continue?`,
    )) return;
    setSaving(true);
    try {
      const res = await setToolTenants(tool.id, [...selected]);
      if (res.data.detach_errors?.length) {
        toast.warning(`Access saved, but Vapi did not update ${res.data.detach_errors.length} agent(s). Run tool sync for those tenants.`);
      } else {
        toast.success('Tenant access saved');
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorList(e, 'Failed to save tenant access')[0]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(tool)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Tenant access · {tool?.name}</DialogTitle>
          <DialogDescription>Tenants ticked here can attach this tool to their agents.</DialogDescription>
        </DialogHeader>
        {!tenants ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tenants yet.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
            {tenants.map((t) => (
              <label key={t.tenant_id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={selected.has(t.tenant_id)} onCheckedChange={(v) => toggle(t.tenant_id, Boolean(v))} />
                <span className="flex-1 text-sm">{t.name}</span>
                {t.assistant_count > 0 && (
                  <span className="text-[11px] text-muted-foreground">used by {t.assistant_count} agent{t.assistant_count === 1 ? '' : 's'}</span>
                )}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={save} disabled={saving || !tenants} className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Super Admin: platform Vapi tools (create, edit, re-sync, delete, tenant access). */
export default function ToolsManager() {
  const [tools, setTools] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState({ open: false, tool: null });
  const [busyId, setBusyId] = useState(null);
  const [accessTool, setAccessTool] = useState(null);

  const load = useCallback(async () => {
    try {
      const [toolsRes, typesRes] = await Promise.all([listTools(), listToolTypes()]);
      setTools(toolsRes.data);
      setTypes(typesRes.data);
    } catch (e) {
      toast.error(errorList(e, 'Failed to load tools')[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const typeLabel = (key) => types.find((t) => t.type_key === key)?.label || key;

  const resync = async (tool) => {
    setBusyId(tool.id);
    try {
      const res = await syncTool(tool.id);
      const { outcome } = res.data;
      if (outcome === 'failed') toast.error(`Sync failed: ${res.data.tool.last_error}`);
      else toast.success(outcome === 'unchanged' ? 'Already up to date in Vapi' : 'Synced to Vapi');
      await load();
    } catch (e) {
      toast.error(errorList(e, 'Sync failed')[0]);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (tool) => {
    if (!window.confirm(`Delete "${tool.name}"? It is also deleted in Vapi.`)) return;
    setBusyId(tool.id);
    try {
      await deleteTool(tool.id);
      toast.success('Tool deleted');
      await load();
    } catch (e) {
      toast.error(errorList(e, 'Failed to delete tool')[0]);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="card-base p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Vapi tools</h2>
          <p className="text-xs text-muted-foreground mt-1">Tools your voice agents can use. Changes are sent to Vapi when you save.</p>
        </div>
        <Button size="sm" onClick={() => setEditor({ open: true, tool: null })} disabled={!types.length} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> New tool
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : tools.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-6 text-center">No tools yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {tools.map((tool) => (
            <div key={tool.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium">{tool.name}</span>
                  <Badge variant="secondary" className="text-[11px]">{typeLabel(tool.type_key)}</Badge>
                  <SyncBadge status={tool.sync_status} />
                </div>
                {tool.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>}
                {tool.sync_status === 'failed' && tool.last_error && (
                  <p className="text-xs text-red-600 mt-1 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{tool.last_error}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Tenant access" disabled={busyId === tool.id}
                  onClick={() => setAccessTool(tool)}><Building2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" disabled={busyId === tool.id}
                  onClick={() => setEditor({ open: true, tool })}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Re-sync with Vapi" disabled={busyId === tool.id}
                  onClick={() => resync(tool)}>
                  <RefreshCw className={`w-4 h-4 ${busyId === tool.id ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete" disabled={busyId === tool.id}
                  onClick={() => remove(tool)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TenantAccessDialog tool={accessTool} onOpenChange={(open) => !open && setAccessTool(null)} onSaved={load} />

      <ToolEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        types={types}
        tool={editor.tool}
        onSaved={load}
      />
    </Card>
  );
}
