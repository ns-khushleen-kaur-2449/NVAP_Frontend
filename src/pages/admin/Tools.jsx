import { Wrench } from 'lucide-react';
import ToolsManager from '@/components/admin/ToolsManager';

/** Platform Vapi tools (Super Admin): the same ToolsManager that used to be Settings → Tools. */
export default function AdminToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" /> Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Platform tools shared with tenants' agents, and who may use them.</p>
      </div>
      <ToolsManager />
    </div>
  );
}
