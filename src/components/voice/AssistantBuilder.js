import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import AgentToolsPanel from './AgentToolsPanel';
import {
  User, Building2, MessageSquare, ShieldCheck, Book, StickyNote, Cpu,
  Loader2, Plus, X, ListRestart, Save, Rocket, RotateCcw, AlertTriangle,
  CheckCircle2, FileEdit, History, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listBuilderConfigs, getBuilderConfig, createBuilderConfig, updateBuilderConfig,
  previewBuilderConfig, publishBuilderConfig, rollbackBuilderConfig, retryBuilderConfig,
  getKnowledgeFiles, listAssistantTools,
} from '../../lib/api';

// Option values mirror the backend contract in
// app/schemas/requests/assistant_builder.py and the vocabularies in
// app/features/assistant_builder/prompt_builder.py.
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];
const GOALS = [
  { value: 'qualify_leads', label: 'Qualify leads', hint: 'Understand needs, suggest options, offer a visit' },
  { value: 'book_appointment', label: 'Book appointments', hint: 'Go straight to scheduling a visit' },
  { value: 'answer_questions', label: 'Answer questions', hint: 'Handle enquiries, then qualify if interested' },
];
const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'calm', label: 'Calm' },
];
const APPROACHES = [
  { value: 'consultative', label: 'Consultative', hint: 'Understand first, then recommend' },
  { value: 'direct', label: 'Direct', hint: 'Get to key requirements quickly' },
  { value: 'soft', label: 'Soft', hint: 'Let the customer lead' },
];
const LENGTHS = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
];
const VERTICALS = [
  { value: 'automobile', label: 'Automobile dealership' },
  { value: 'real_estate', label: 'Real estate' },
];
const QUALIFICATION_SUGGESTIONS = {
  automobile: ['budget', 'type of car', 'fuel type', 'transmission', 'purchase timeline', 'trade-in'],
  real_estate: ['budget', 'preferred location', 'property type', 'size', 'possession timeline'],
};
const RULES = [
  { key: 'one_question_at_a_time', label: 'One question at a time', hint: 'Ask a single question per turn and wait.' },
  { key: 'no_unlisted_pricing', label: 'No unlisted pricing', hint: 'Never guess a price or range that no tool returned.' },
  { key: 'check_stock_before_confirming', label: 'Check stock before confirming', hint: 'Only call something available if the catalog says so.' },
  { key: 'transfer_on_request', label: 'Hand over on request', hint: 'Route to a human when the customer asks for one.' },
];
const VOICE_STACK_LABELS = {
  stt: { 'deepgram-nova-3': 'Deepgram Nova-3' },
  llm: { groq: 'Groq', openai: 'OpenAI' },
  tts: { '11labs': 'ElevenLabs', vapi: 'Vapi' },
};
const CUSTOM_INSTRUCTIONS_MAX = 5000;

const STATUS_STYLES = {
  published: { label: 'Published', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  syncing: { label: 'Syncing', className: 'bg-blue-500/10 text-blue-600 border-blue-500/25' },
  sync_failed: { label: 'Sync failed', className: 'bg-red-500/10 text-red-600 border-red-500/25' },
  superseded: { label: 'Superseded', className: 'bg-muted text-muted-foreground border-border' },
  draft: { label: 'Draft', className: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
};

const defaultForm = () => ({
  assistant: {
    name: '',
    language: 'en',
    goal: 'qualify_leads',
    tone: 'friendly',
    sales_approach: 'consultative',
    conversation_length: 'balanced',
  },
  business: { company: '', vertical: 'automobile', locations: [] },
  target_customer: '',
  qualification: [],
  rules: {
    one_question_at_a_time: true,
    no_unlisted_pricing: true,
    check_stock_before_confirming: true,
    transfer_on_request: true,
  },
  knowledge_ids: [],
  voice_stack: { stt: 'deepgram-nova-3', llm: 'groq', tts: '11labs' },
  custom_instructions: '',
});

// Merge a stored payload over the defaults so older versions missing a field still load.
const formFromPayload = (payload) => {
  const base = defaultForm();
  if (!payload) return base;
  return {
    ...base,
    ...payload,
    assistant: { ...base.assistant, ...(payload.assistant || {}) },
    business: { ...base.business, ...(payload.business || {}) },
    rules: { ...base.rules, ...(payload.rules || {}) },
    voice_stack: { ...base.voice_stack, ...(payload.voice_stack || {}) },
    custom_instructions: payload.custom_instructions || '',
  };
};

// The exact AssistantBuilderConfig shape (the backend forbids unknown top-level fields).
const toPayload = (form) => ({
  assistant: { ...form.assistant, name: form.assistant.name.trim() },
  business: { ...form.business, company: form.business.company.trim() },
  target_customer: form.target_customer.trim(),
  qualification: form.qualification,
  rules: form.rules,
  knowledge_ids: form.knowledge_ids,
  voice_stack: form.voice_stack,
  custom_instructions: form.custom_instructions.trim() || null,
});

const missingFields = (form) => [
  !form.assistant.name.trim() && 'Agent name',
  !form.business.company.trim() && 'Company',
  !form.target_customer.trim() && 'Target customer',
].filter(Boolean);

const errorDetail = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = (detail[0].loc || []).filter((p) => p !== 'body').join('.');
    return field ? `${field}: ${detail[0].msg}` : detail[0].msg;
  }
  return fallback;
};

// Keep a value the backend accepted visible even if this UI doesn't list it.
const withCurrent = (options, value) =>
  !value || options.some((o) => o.value === value) ? options : [...options, { value, label: value }];

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return <Badge variant="outline" className={style.className}>{style.label}</Badge>;
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OptionSelect({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
      <SelectContent>
        {withCurrent(options, value).map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TagInput({ values, onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const value = raw.trim();
    if (!value || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  const unused = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1.5 min-h-[40px]">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { add(draft); setDraft(''); }}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none py-1"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssistantBuilder() {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [configs, setConfigs] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [config, setConfig] = useState(null); // BuilderConfigResponse of the config being edited
  // Platform tools attached to the published agent (managed in the Tools tab).
  const [attachedTools, setAttachedTools] = useState([]);
  const assistantId = config?.assistant_id;
  const loadAttachedTools = useCallback(() => {
    if (!assistantId) { setAttachedTools([]); return; }
    listAssistantTools(assistantId)
      .then((res) => setAttachedTools(res.data.filter((t) => t.attached)))
      .catch(() => setAttachedTools([]));
  }, [assistantId]);
  useEffect(() => { loadAttachedTools(); }, [loadAttachedTools]);
  const [form, setForm] = useState(defaultForm);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const previewSeq = useRef(0);

  const [knowledgeFiles, setKnowledgeFiles] = useState([]);

  const payload = useMemo(() => toPayload(form), [form]);
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const isDirty = savedSnapshot !== payloadKey;
  const missing = missingFields(form);

  const fetchConfigs = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await listBuilderConfigs();
      setConfigs(res.data || []);
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to load agents'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list') fetchConfigs();
  }, [view, fetchConfigs]);

  useEffect(() => {
    if (view !== 'editor') return;
    getKnowledgeFiles()
      .then((res) => setKnowledgeFiles(res.data || []))
      .catch(() => setKnowledgeFiles([]));
  }, [view]);

  // Live prompt preview, debounced. Stale responses are dropped by sequence number.
  useEffect(() => {
    if (view !== 'editor') return undefined;
    if (missing.length) {
      setPreview(null);
      setPreviewError(null);
      return undefined;
    }
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await previewBuilderConfig(JSON.parse(payloadKey));
        if (seq === previewSeq.current) {
          setPreview(res.data);
          setPreviewError(null);
        }
      } catch (e) {
        if (seq === previewSeq.current) setPreviewError(errorDetail(e, 'Preview failed'));
      } finally {
        if (seq === previewSeq.current) setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
    // missing is derived from form, which payloadKey already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, view]);

  const loadConfig = (data) => {
    setConfig(data);
    const loaded = formFromPayload(data.latest?.payload);
    setForm(loaded);
    setSavedSnapshot(JSON.stringify(toPayload(loaded)));
    setSelectedVersion(String(data.current_version));
  };

  const openNew = () => {
    setConfig(null);
    setForm(defaultForm());
    setSavedSnapshot(null);
    setSelectedVersion('');
    setPreview(null);
    setView('editor');
  };

  const openExisting = async (id) => {
    try {
      const res = await getBuilderConfig(id);
      loadConfig(res.data);
      setView('editor');
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to load agent'));
    }
  };

  // Re-read the config's Vapi version info only; keeps any unsaved edits in the form.
  const refreshVapiState = async (id) => {
    try {
      const res = await getBuilderConfig(id);
      setConfig(res.data);
    } catch {
      /* not critical */
    }
  };

  const refreshConfig = async (id) => {
    try {
      const res = await getBuilderConfig(id);
      loadConfig(res.data);
    } catch {
      /* the action's own error toast is enough */
    }
  };

  const update = (path, value) => {
    setForm((prev) => {
      const [section, key] = path.split('.');
      if (!key) return { ...prev, [section]: value };
      return { ...prev, [section]: { ...prev[section], [key]: value } };
    });
  };

  // Saving always creates a new immutable version (v1 on create).
  const save = async () => {
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return null;
    }
    setSaving(true);
    try {
      const res = config
        ? await updateBuilderConfig(config.id, payload)
        : await createBuilderConfig(payload);
      loadConfig(res.data);
      toast.success(`Saved as version ${res.data.current_version}`);
      return res.data;
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to save agent'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const runPublish = async (action, configId, version, successMessage) => {
    setPublishing(true);
    try {
      const res = await action(configId, version);
      toast.success(`${successMessage} (version ${res.data.version})`);
    } catch (e) {
      toast.error(errorDetail(e, 'Publishing to Vapi failed. See the version status for details.'));
    } finally {
      await refreshConfig(configId);
      setPublishing(false);
    }
  };

  const publishLatest = async () => {
    let target = config;
    if (!target || isDirty) {
      target = await save();
      if (!target) return;
    }
    await runPublish(publishBuilderConfig, target.id, target.current_version, 'Published to Vapi');
  };

  const publishSelected = async () => {
    const version = Number(selectedVersion);
    if (!config || !version) return;
    if (config.latest?.status === 'sync_failed' && version === config.current_version) {
      await runPublish(retryBuilderConfig, config.id, version, 'Retried publish');
    } else if (config.published_version && version < config.published_version) {
      if (!window.confirm(`Roll the live assistant back to version ${version}?`)) return;
      await runPublish(rollbackBuilderConfig, config.id, version, 'Rolled back');
    } else {
      await runPublish(publishBuilderConfig, config.id, version, 'Published to Vapi');
    }
  };

  // ── List view ────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full bg-card text-foreground overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Agent Builder</h2>
            <p className="text-sm text-muted-foreground">Configure, version and publish your voice agents</p>
          </div>
          <Button onClick={openNew} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Create agent
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {loadingList ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No agents yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Describe your business and goal; the builder writes a safe prompt for you.
              </p>
              <Button onClick={openNew} variant="outline" className="mt-6">Build your first agent</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {configs.map((c) => {
                const p = c.latest?.payload || {};
                const goal = GOALS.find((g) => g.value === p.assistant?.goal)?.label;
                return (
                  <Card key={c.id} className="group hover:border-primary/50 transition-all cursor-pointer" onClick={() => openExisting(c.id)}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <StatusBadge status={c.latest?.status} />
                      </div>
                      <h4 className="font-bold leading-none">{c.name}</h4>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                        {[p.business?.company, goal].filter(Boolean).join(' · ') || 'No details'}
                      </p>
                      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <History className="w-3 h-3" />
                          v{c.current_version}
                          {c.published_version ? ` · live v${c.published_version}` : ' · not published'}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          <FileEdit className="w-3 h-3" /> Edit
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // ── Editor view ──────────────────────────────────────────────
  const latestStatus = config?.latest?.status;
  const versionOptions = config ? Array.from({ length: config.current_version }, (_, i) => config.current_version - i) : [];
  const selectedNum = Number(selectedVersion);
  const selectedAction = !config ? '' :
    latestStatus === 'sync_failed' && selectedNum === config.current_version ? 'Retry publish' :
    config.published_version && selectedNum < config.published_version ? 'Roll back to this version' :
    selectedNum === config.published_version ? 'Re-publish this version' : 'Publish this version';

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('list')} className="text-muted-foreground">
            <ListRestart className="w-4 h-4 mr-2" /> Back to agents
          </Button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none">{config?.name || 'New agent'}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {config ? `Version ${config.current_version}${config.published_version ? ` · live v${config.published_version}` : ''}` : 'Not saved yet'}
              {isDirty && config ? ' · unsaved changes' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config && <StatusBadge status={latestStatus} />}
          <Button variant="outline" size="sm" onClick={save} disabled={saving || publishing || (!!config && !isDirty)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {config ? 'Save new version' : 'Save draft'}
          </Button>
          <Button size="sm" onClick={publishLatest} disabled={saving || publishing} className="bg-primary text-primary-foreground">
            {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            {isDirty || !config ? 'Save & publish' : 'Publish'}
          </Button>
        </div>
      </div>

      {latestStatus === 'sync_failed' && config?.latest?.sync_error && (
        <div className="flex items-start gap-2 px-6 py-2.5 text-sm bg-red-500/10 border-b border-red-500/20 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Version {config.current_version} failed to sync with Vapi: {config.latest.sync_error}</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <ScrollArea className="flex-1 border-r border-border bg-card">
          <div className="p-8 space-y-10 max-w-3xl mx-auto pb-20">
            <Section icon={User} title="Agent identity" description="Who the agent is and what it should achieve">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Agent name" required>
                  <Input value={form.assistant.name} maxLength={255} onChange={(e) => update('assistant.name', e.target.value)} placeholder="e.g. Riya" className="bg-muted border-border" />
                </Field>
                <Field label="Language">
                  <OptionSelect value={form.assistant.language} onChange={(v) => update('assistant.language', v)} options={LANGUAGES} />
                </Field>
              </div>
              <Field label="Call goal">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {withCurrent(GOALS, form.assistant.goal).map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => update('assistant.goal', g.value)}
                      className={`text-left rounded-lg border p-3 transition-colors ${form.assistant.goal === g.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    >
                      <p className="text-sm font-medium">{g.label}</p>
                      {g.hint && <p className="text-[11px] text-muted-foreground mt-1">{g.hint}</p>}
                    </button>
                  ))}
                </div>
              </Field>
            </Section>

            <Section icon={Building2} title="Business" description="Facts the agent can say about your business">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company" required>
                  <Input value={form.business.company} maxLength={255} onChange={(e) => update('business.company', e.target.value)} placeholder="e.g. Apex Motors" className="bg-muted border-border" />
                </Field>
                <Field label="Industry">
                  <OptionSelect value={form.business.vertical} onChange={(v) => update('business.vertical', v)} options={VERTICALS} />
                </Field>
              </div>
              <Field label="Locations" hint="Press Enter after each branch. The agent offers these when booking a visit.">
                <TagInput values={form.business.locations} onChange={(v) => update('business.locations', v.slice(0, 50))} placeholder="e.g. Solan" />
              </Field>
              <Field label="Target customer" required hint="Who you sell to, in a sentence.">
                <Textarea value={form.target_customer} maxLength={2000} onChange={(e) => update('target_customer', e.target.value)} placeholder="e.g. Families and first-time car buyers in Himachal" className="bg-muted border-border min-h-[80px] resize-none" />
              </Field>
            </Section>

            <Section icon={MessageSquare} title="Conversation" description="How the agent talks and what it needs to find out">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tone">
                  <OptionSelect value={form.assistant.tone} onChange={(v) => update('assistant.tone', v)} options={TONES} />
                </Field>
                <Field label="Sales approach" hint={APPROACHES.find((a) => a.value === form.assistant.sales_approach)?.hint}>
                  <OptionSelect value={form.assistant.sales_approach} onChange={(v) => update('assistant.sales_approach', v)} options={APPROACHES} />
                </Field>
              </div>
              <Field label="Reply length">
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => update('assistant.conversation_length', l.value)}
                      className={`px-4 py-1.5 text-sm rounded-md transition-colors ${form.assistant.conversation_length === l.value ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="What to qualify" hint="Leave empty to use sensible defaults for the industry.">
                <TagInput
                  values={form.qualification}
                  onChange={(v) => update('qualification', v.slice(0, 50))}
                  placeholder="e.g. budget"
                  suggestions={QUALIFICATION_SUGGESTIONS[form.business.vertical] || []}
                />
              </Field>
            </Section>

            <Section icon={ShieldCheck} title="Guardrails" description="Protected rules layered on top of the core safety rules">
              <div className="space-y-2">
                {RULES.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-[11px] text-muted-foreground">{r.hint}</p>
                    </div>
                    <Switch checked={form.rules[r.key]} onCheckedChange={(v) => update(`rules.${r.key}`, v)} />
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={Book} title="Knowledge" description="Documents this agent may draw on">
              {knowledgeFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No knowledge files yet. Upload them from the Knowledge Base tab.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {knowledgeFiles.map((f) => {
                    const selected = form.knowledge_ids.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => update('knowledge_ids', selected ? form.knowledge_ids.filter((id) => id !== f.id) : [...form.knowledge_ids, f.id])}
                        className={`flex items-center gap-2 text-left rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                      >
                        {selected ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Book className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section icon={StickyNote} title="Business notes" description="Offers, policies and preferences. Lower priority than the guardrails.">
              <Textarea
                value={form.custom_instructions}
                maxLength={CUSTOM_INSTRUCTIONS_MAX}
                onChange={(e) => update('custom_instructions', e.target.value)}
                placeholder="e.g. Mention the free first service on every booking. Showroom is closed on Tuesdays."
                className="bg-muted border-border min-h-[120px]"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {form.custom_instructions.length}/{CUSTOM_INSTRUCTIONS_MAX}
              </p>
            </Section>

            <Section icon={Cpu} title="Voice stack" description="Managed by the platform; the voice and model are set on the server.">
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[['Speech-to-text', 'stt'], ['Language model', 'llm'], ['Voice', 'tts']].map(([label, key]) => (
                  <div key={key} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="font-medium">{VOICE_STACK_LABELS[key][form.voice_stack[key]] || form.voice_stack[key]}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </ScrollArea>

        <div className="w-[420px] shrink-0 hidden lg:flex flex-col bg-card">
          <Tabs defaultValue="prompt" className="flex flex-col h-full">
            <TabsList className="m-3 mb-0 grid grid-cols-3">
              <TabsTrigger value="prompt">Generated prompt</TabsTrigger>
              <TabsTrigger value="versions" disabled={!config}>Versions</TabsTrigger>
              <TabsTrigger value="tools" disabled={!config?.assistant_id}>Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Live preview of what the agent will be told</span>
                    {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  </div>
                  {missing.length > 0 ? (
                    <p className="text-sm text-muted-foreground">Fill in {missing.join(', ')} to see the prompt.</p>
                  ) : previewError ? (
                    <p className="text-sm text-red-600">{previewError}</p>
                  ) : preview ? (
                    <>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-muted rounded-lg p-3 border border-border">{preview.prompt}</pre>
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5" /> Tools
                        </p>
                        {preview.tools?.length || attachedTools.length ? (
                          <ul className="space-y-1.5">
                            {preview.tools?.map((t) => (
                              <li key={t.name} className="text-xs rounded border border-border px-2.5 py-1.5">
                                <code className="font-mono text-primary">{t.name}</code>
                                <p className="text-muted-foreground mt-0.5">{t.description}</p>
                              </li>
                            ))}
                            {attachedTools.map((t) => (
                              <li key={t.tool_id} className="text-xs rounded border border-border px-2.5 py-1.5">
                                <code className="font-mono text-primary">{t.name}</code>
                                <span className="ml-2 text-[10px] text-muted-foreground">attached in the Tools tab</span>
                                {t.description && <p className="text-muted-foreground mt-0.5">{t.description}</p>}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No tools attached. Add tools in the Tools tab once the agent is published.
                          </p>
                        )}
                        {!preview.tools?.length && (
                          <p className="text-[11px] text-muted-foreground mt-2">
                            No catalog tool, so the agent won't quote prices or stock; a representative follows up.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tools" className="flex-1 min-h-0 mt-0">
              {config?.assistant_id ? (
                <ScrollArea className="h-full"><AgentToolsPanel assistantId={config.assistant_id} onChange={() => { loadAttachedTools(); refreshVapiState(config.id); }} /></ScrollArea>
              ) : (
                <p className="p-4 text-xs text-muted-foreground">Publish the agent to add tools.</p>
              )}
            </TabsContent>

            <TabsContent value="versions" className="flex-1 min-h-0 mt-0">
              {config && (
                <div className="p-4 space-y-4 text-sm">
                  <dl className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border px-3 py-2">
                      <dt className="text-[11px] text-muted-foreground">Latest version</dt>
                      <dd className="font-semibold">v{config.current_version}</dd>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2">
                      <dt className="text-[11px] text-muted-foreground">Live on Vapi</dt>
                      <dd className="font-semibold">
                        {config.published_version ? `v${config.published_version}` : 'Not published'}
                        {(config.vapi_live?.version || config.vapi_versions?.[config.published_version]) && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            · Vapi {config.vapi_live?.version || config.vapi_versions[config.published_version]}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {config.vapi_live?.changed_outside && (
                    <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Vapi is running {config.vapi_live.version || 'a newer version'}
                        {config.vapi_live.sdr_version ? `, built from v${config.vapi_live.sdr_version}` : ''}, which was changed outside SmartSDR
                        (for example in the Vapi dashboard). Publishing a version here replaces it.
                      </span>
                    </div>
                  )}
                  {config.latest?.published_at && (
                    <p className="text-xs text-muted-foreground">
                      v{config.current_version} published {new Date(config.latest.published_at).toLocaleString()}
                    </p>
                  )}
                  <Field label="Version" hint="Every save creates a new version. Publishing an older one rolls the live agent back.">
                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                      <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Pick a version" /></SelectTrigger>
                      <SelectContent>
                        {versionOptions.map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            v{v}{v === config.current_version ? ' (latest)' : ''}{v === config.published_version ? ' · live' : ''}
                            {config.vapi_versions?.[v] ? ` · Vapi ${config.vapi_versions[v]}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button onClick={publishSelected} disabled={publishing || !selectedVersion} variant="outline" className="w-full">
                    {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                    {selectedAction}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    The form always shows the latest version. Rolling back changes what's live, not the form.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
