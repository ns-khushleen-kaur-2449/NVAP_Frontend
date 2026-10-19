import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { visibleNavItems } from '@/lib/adminNav';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CalendarConnections from '@/components/CalendarConnections';
import ToolsManager from '@/components/admin/ToolsManager';
import SchedulingSetup from '@/components/admin/SchedulingSetup';
import { useAuth } from '@/lib/AuthContext';
import { getSettings, updateSettings } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const { hasRole, user } = useAuth();
  const adminItems = visibleNavItems(user);

  useEffect(() => { getSettings().then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await updateSettings({
        stale_lead_days: Number(settings.stale_lead_days),
        hot_lead_score: Number(settings.hot_lead_score),
        engagement_tone: settings.engagement_tone,
        default_sequence_days: Number(settings.default_sequence_days),
        preferred_language: settings.preferred_language,
      });
      setSettings(r.data);
      toast.success('Settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-2">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account configurations and third-party integrations.
          </p>
        </div>
      </div>

      {adminItems.length > 0 && (
        <Card className="card-base p-5 space-y-3" data-testid="settings-admin">
          <h2 className="text-sm font-semibold">Administration</h2>
          <div className="divide-y divide-border rounded-lg border border-border">
            {adminItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <CalendarConnections />

      {/* Platform Vapi tools are managed by Super Admins only. */}
      {hasRole('super_admin') && <ToolsManager />}

      {/* Meeting types and executives for the appointment tools: Tenant Admins edit, Managers view. */}
      {hasRole('tenant_admin', 'manager') && <SchedulingSetup canEdit={hasRole('tenant_admin')} />}

      {settings && (
        <Card className="card-base p-5 space-y-4">
          <h2 className="text-sm font-semibold">Lead engagement defaults</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Stale after (days)</label>
              <Input type="number" value={settings.stale_lead_days} onChange={(e) => setSettings({ ...settings, stale_lead_days: e.target.value })} className="mt-1 bg-[hsl(var(--surface-2))] border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hot-lead score threshold</label>
              <Input type="number" value={settings.hot_lead_score} onChange={(e) => setSettings({ ...settings, hot_lead_score: e.target.value })} className="mt-1 bg-[hsl(var(--surface-2))] border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Default sequence length (days)</label>
              <Input type="number" value={settings.default_sequence_days} onChange={(e) => setSettings({ ...settings, default_sequence_days: e.target.value })} className="mt-1 bg-[hsl(var(--surface-2))] border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Engagement tone</label>
              <Select value={settings.engagement_tone} onValueChange={(v) => setSettings({ ...settings, engagement_tone: v })}>
                <SelectTrigger className="mt-1 bg-[hsl(var(--surface-2))] border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </Card>
      )}
    </div>
  );
}
