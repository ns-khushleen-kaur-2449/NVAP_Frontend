import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wrench } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { attachAssistantTool, detachAssistantTool, listAssistantTools } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const errorDetail = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

/**
 * Platform tools granted to this agent's tenant.  Tenant Admins switch them on or off;
 * the change is applied to the live agent in Vapi straight away.
 */
export default function AgentToolsPanel({ assistantId, onChange }) {
  const { hasRole } = useAuth();
  const canEdit = hasRole('tenant_admin', 'super_admin');
  const [tools, setTools] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await listAssistantTools(assistantId);
      setTools(res.data);
    } catch (e) {
      setTools([]);
      toast.error(errorDetail(e, 'Failed to load tools'));
    }
  }, [assistantId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (tool, on) => {
    setBusyId(tool.tool_id);
    try {
      if (on) await attachAssistantTool(assistantId, tool.tool_id);
      else await detachAssistantTool(assistantId, tool.tool_id);
      toast.success(on ? `${tool.name} added to the agent` : `${tool.name} removed from the agent`);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to update the agent in Vapi'));
    } finally {
      setBusyId(null);
    }
  };

  if (!tools) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Tools your workspace has access to. Changes apply to the live agent immediately.
        {!canEdit && ' Only a tenant admin can change them.'}
      </p>
      {tools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          <Wrench className="w-5 h-5 mx-auto mb-2" />
          No tools have been enabled for your workspace yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {tools.map((tool) => (
            <div key={tool.tool_id} className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-medium">{tool.name}</span>
                  {!tool.available && <Badge variant="outline" className="text-[10px]">Not ready</Badge>}
                </div>
                {tool.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>}
              </div>
              {busyId === tool.tool_id ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
              ) : (
                <Switch
                  checked={tool.attached}
                  disabled={!canEdit || (!tool.available && !tool.attached)}
                  onCheckedChange={(on) => toggle(tool, on)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
