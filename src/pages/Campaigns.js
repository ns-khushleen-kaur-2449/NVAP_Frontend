import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSdrCampaigns } from '@/lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSdrCampaigns().then((r) => setCampaigns(r.data)).catch(() => setCampaigns([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Sequences built by AI Strategist, run against real prospects you've selected.</p>
        </div>
        <Link to="/strategist" className="inline-flex items-center gap-2 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-full">
          <Sparkles className="w-3.5 h-3.5" /> New via AI Strategist
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <Link key={c.id} to={`/campaigns/${c.id}`}>
            <Card className="card-base card-hover p-5 block h-full">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="capitalize">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.metadata?.messaging_angle}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[['Prospects', c.total_leads], ['Drafted', c.stats?.drafted || 0], ['Approved', c.stats?.approved || 0], ['Sent', c.stats?.sent || 0]].map(([l, v]) => (
                  <div key={l}>
                    <div className="font-display font-semibold text-lg">{v}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</div>
                  </div>
                ))}
              </div>
            </Card>
          </Link>
        ))}
        {!loading && campaigns.length === 0 && (
          <div className="md:col-span-2 border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            No campaigns yet. Ask the <Link to="/strategist" className="underline">AI Strategist</Link> for one and launch it in one click.
          </div>
        )}
      </div>
    </div>
  );
}
