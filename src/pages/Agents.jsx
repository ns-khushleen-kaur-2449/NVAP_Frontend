import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Bot, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { errorText } from '@/components/admin/userBits';
import { listAvailableAgents } from '@/lib/api';
import { agentRoute } from '@/lib/agents';

/** The agents the signed-in user's organisation may use. Nothing here reveals how an agent is set up. */
export default function AgentsPage() {
  const [agents, setAgents] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listAvailableAgents()
      .then((response) => { if (!cancelled) setAgents(response.data); })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorText(e, 'Failed to load agents'));
        setAgents([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="agents-page">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bot className="w-6 h-6 text-primary" /> Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">The AI agents available to your organisation.</p>
      </div>

      {!agents ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : agents.length === 0 ? (
        <Card className="card-base p-8 text-center text-sm text-muted-foreground">
          No agents are available to your organisation yet. Ask your platform administrator to enable one.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const route = agentRoute(agent);
            return (
              <Card key={agent.id} className="card-base p-5 flex flex-col gap-3" data-testid={`agent-card-${agent.key}`}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{agent.name}</h2>
                  {agent.industry && <Badge variant="outline" className="text-[11px]">{agent.industry}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground flex-1">{agent.description || 'No description.'}</p>
                {route ? (
                  <Button asChild className="bg-primary text-primary-foreground self-start"><Link to={route}>Open</Link></Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Coming soon to your workspace</span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
