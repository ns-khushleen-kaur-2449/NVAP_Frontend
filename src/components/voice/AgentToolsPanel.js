import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Wrench } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { listBuilderTools } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const errorDetail = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

/**
 * The agent's tool selection (part of the builder config).  Ticking a tool also ticks the
 * tools it needs; unticking one also unticks the tools that need it.  Nothing changes in
 * Vapi until the agent is saved and published; the prompt then explains each tool.
 */
export default function AgentToolsPanel({ selected, onChange }) {
  const { hasRole } = useAuth();
  const canEdit = hasRole('tenant_admin', 'super_admin');
  const [tools, setTools] = useState(null);

  useEffect(() => {
    listBuilderTools()
      .then((res) => setTools(res.data))
      .catch((e) => { setTools([]); toast.error(errorDetail(e, 'Failed to load tools')); });
  }, []);

  const byType = useMemo(() => Object.fromEntries((tools || []).map((t) => [t.type_key, t])), [tools]);
  const byName = useMemo(() => Object.fromEntries((tools || []).map((t) => [t.name, t])), [tools]);
  const chosen = new Set(selected);
  // Selected earlier but no longer offered (revoked, renamed or not synced): saving will fail until removed.
  const unavailable = selected.filter((name) => tools && !byName[name]);

  const withRequirements = (names) => {
    const result = new Set(names);
    let grew = true;
    while (grew) {
      grew = false;
      [...result].forEach((name) => (byName[name]?.requires || []).forEach((typeKey) => {
        const dependency = byType[typeKey];
        if (dependency && !result.has(dependency.name)) { result.add(dependency.name); grew = true; }
      }));
    }
    return result;
  };

  // Drop ``removed``, then every selected tool left without something it needs.
  const withoutDependents = (names, removed) => {
    const result = new Set(names.filter((name) => name !== removed));
    const gone = [];
    let shrank = true;
    while (shrank) {
      shrank = false;
      [...result].forEach((name) => {
        const unmet = (byName[name]?.requires || []).some((typeKey) => !byType[typeKey] || !result.has(byType[typeKey].name));
        if (unmet) { result.delete(name); gone.push(name); shrank = true; }
      });
    }
    return { result, gone };
  };

  const toggle = (tool, on) => {
    if (on) {
      const next = withRequirements([...selected, tool.name]);
      const added = [...next].filter((name) => name !== tool.name && !chosen.has(name));
      if (added.length) toast.info(`Also added ${added.join(', ')}: ${tool.name} needs ${added.length > 1 ? 'them' : 'it'}.`);
      onChange([...next]);
    } else {
      const { result, gone } = withoutDependents(selected, tool.name);
      if (gone.length) toast.warning(`Also removed ${gone.join(', ')}: ${gone.length > 1 ? 'they need' : 'it needs'} ${tool.name}.`);
      onChange([...result]);
    }
  };

  if (!tools) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Tools this agent can use. The prompt is written for exactly these tools. Changes apply when you save and publish.
        {!canEdit && ' Only a tenant admin can change them.'}
      </p>
      {unavailable.map((name) => (
        <div key={name} className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/25 bg-amber-500/10">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-amber-700">
            <span className="font-mono">{name}</span> is no longer available to your workspace. Remove it to save.
          </p>
          <Switch checked disabled={!canEdit} onCheckedChange={() => onChange(selected.filter((n) => n !== name))} />
        </div>
      ))}
      {tools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          <Wrench className="w-5 h-5 mx-auto mb-2" />
          No tools have been enabled for your workspace yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {tools.map((tool) => (
            <div key={tool.name} className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{tool.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{tool.name}</span>
                </div>
                {tool.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>}
                {tool.requires?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Needs</span>
                    {tool.requires.map((typeKey) => (
                      <Badge key={typeKey} variant="outline" className="text-[10px]">{byType[typeKey]?.name || typeKey}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <Switch checked={chosen.has(tool.name)} disabled={!canEdit} onCheckedChange={(on) => toggle(tool, on)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
