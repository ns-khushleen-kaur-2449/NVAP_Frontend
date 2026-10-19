import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, UsersRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddUserDialog from '@/components/admin/AddUserDialog';
import { StatusBadge, UserIdentity, errorText } from '@/components/admin/userBits';
import { listTeams, moveUserToTeam } from '@/lib/api';

const NO_TEAM = 'none';

/**
 * Tenant Admin: teams in the organisation.  A team is a Manager and the Sales Reps who report
 * to them, so creating a team means adding a Manager, and moving a rep changes who they report to.
 */
export default function TeamsPage() {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [addingManager, setAddingManager] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await listTeams()).data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load teams'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (rep, target) => {
    setBusyId(rep.id);
    try {
      await moveUserToTeam(rep.id, target === NO_TEAM ? null : Number(target));
      toast.success(`${rep.name} moved`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not move the rep'));
    } finally {
      setBusyId(null);
    }
  };

  const managers = (data?.teams || []).map((t) => t.manager).filter((m) => (m.status || '').toLowerCase() === 'active');

  const repRow = (rep, currentManagerId) => (
    <div key={rep.id} className="flex items-center gap-3 py-2" data-testid={`team-member-${rep.id}`}>
      <div className="flex-1 min-w-0"><UserIdentity user={rep} /></div>
      <StatusBadge user={rep} />
      <Select value={currentManagerId ? String(currentManagerId) : NO_TEAM} onValueChange={(value) => move(rep, value)}
        disabled={busyId === rep.id}>
        <SelectTrigger className="w-[180px]" aria-label={`Team for ${rep.name}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TEAM}>No team</SelectItem>
          {managers.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}'s team</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="teams-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><UsersRound className="w-6 h-6 text-primary" /> Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">A team is a Manager and the Sales Reps who report to them. Managers see and manage only their own team.</p>
        </div>
        <Button onClick={() => setAddingManager(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> New team (add a Manager)</Button>
      </div>

      {!data ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {data.teams.length === 0 && (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-8 text-center">No teams yet. Add a Manager to start one.</p>
          )}
          {data.teams.map((team) => (
            <Card key={team.manager.id} className="card-base p-4 space-y-2" data-testid={`team-${team.manager.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><UserIdentity user={team.manager} /><StatusBadge user={team.manager} /></div>
                <span className="text-xs text-muted-foreground">{team.members.length} Sales Rep{team.members.length === 1 ? '' : 's'}</span>
              </div>
              <div className="divide-y divide-border border-t border-border">
                {team.members.length ? team.members.map((rep) => repRow(rep, team.manager.id))
                  : <p className="text-xs text-muted-foreground py-2">No Sales Reps yet.</p>}
              </div>
            </Card>
          ))}
          {data.unassigned.length > 0 && (
            <Card className="card-base p-4 space-y-2" data-testid="team-unassigned">
              <h2 className="text-sm font-semibold">Without a team</h2>
              <div className="divide-y divide-border">
                {data.unassigned.map((rep) => repRow(rep, null))}
              </div>
            </Card>
          )}
        </>
      )}

      <AddUserDialog open={addingManager} onOpenChange={setAddingManager} onCreated={load} defaultRole="manager" />
    </div>
  );
}
