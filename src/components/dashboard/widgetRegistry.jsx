import { Activity, Building2, CalendarCheck, Megaphone, Phone, Star, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import KpiCard from '@/components/shared/KpiCard';
import ProspectSearchBox from '@/components/dashboard/ProspectSearchBox';
import { PERMISSIONS, roleLabel } from '@/lib/rbac';

/**
 * Dashboard widgets.  Each declares the permission it needs and which group of
 * /api/v1/dashboard data it reads; RoleDashboard renders only the allowed ones.
 * The backend computes a group only for roles that have its permission.
 */

const Section = ({ title, note, children }) => (
  <Card className="card-base p-4 space-y-3">
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
    {children}
  </Card>
);

const score = (value) => (value == null ? '—' : `${value}`);
const Empty = ({ children }) => <p className="text-xs text-muted-foreground">{children}</p>;

export const WIDGETS = [
  {
    id: 'platform-stats', title: 'Platform', perm: PERMISSIONS.DASHBOARD_PLATFORM, group: 'platform',
    render: (d) => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Tenants" value={d.tenants.total} icon={Building2} subtitle={`${d.tenants.active} active, ${d.tenants.suspended} suspended`} />
        <KpiCard title="Users" value={Object.values(d.users_by_role).reduce((a, b) => a + b, 0)} icon={Users}
          subtitle={Object.entries(d.users_by_role).map(([r, n]) => `${n} ${roleLabel(r)}`).join(', ')} />
        <KpiCard title="Calls (30 days)" value={d.calls_last_30_days} icon={Phone} />
      </div>
    ),
  },
  {
    id: 'tenant-kpis', title: 'Your organisation', perm: PERMISSIONS.DASHBOARD_TENANT, group: 'tenant',
    render: (d) => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Users" value={d.kpis.users} icon={Users} />
        <KpiCard title="Calls (30 days)" value={d.kpis.calls_last_30_days} icon={Phone} />
        <KpiCard title="Active campaigns" value={d.kpis.active_campaigns} icon={Megaphone} />
        <KpiCard title="Upcoming meetings" value={d.kpis.upcoming_meetings} icon={CalendarCheck} />
      </div>
    ),
  },
  {
    id: 'team-leaderboard', title: 'Team leaderboard', perm: PERMISSIONS.DASHBOARD_TENANT, group: 'tenant',
    render: (d) => (
      <Section title="Team leaderboard" note="Calls from campaigns each team created, last 30 days.">
        {d.team_leaderboard.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Manager</TableHead><TableHead>Reps</TableHead><TableHead>Campaigns</TableHead><TableHead>Calls</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.team_leaderboard.map((row) => (
                <TableRow key={row.manager_id}><TableCell>{row.manager_name}</TableCell><TableCell>{row.members}</TableCell>
                  <TableCell>{row.campaigns}</TableCell><TableCell>{row.calls_last_30_days}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty>No teams yet.</Empty>}
      </Section>
    ),
  },
  {
    id: 'team-call-scores', title: 'Team call scores', perm: PERMISSIONS.DASHBOARD_TEAM, group: 'team',
    render: (d) => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Average intent confidence" value={score(d.team_call_scores.average_confidence)} icon={Star}
          subtitle="Intent assessments of prospects in your team's campaigns, last 30 days" />
        <KpiCard title="Assessments" value={d.team_call_scores.assessments} icon={Activity} />
      </div>
    ),
  },
  {
    id: 'rep-performance', title: 'Rep performance', perm: PERMISSIONS.DASHBOARD_TEAM, group: 'team',
    render: (d) => (
      <Section title="Rep performance" note="Campaigns each person created, and their calls in the last 30 days.">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Campaigns</TableHead><TableHead>Calls</TableHead><TableHead>Avg. confidence</TableHead></TableRow></TableHeader>
          <TableBody>
            {d.rep_performance.map((row) => (
              <TableRow key={row.user_id}><TableCell>{row.name} <span className="text-xs text-muted-foreground">({roleLabel(row.role)})</span></TableCell>
                <TableCell>{row.campaigns}</TableCell><TableCell>{row.calls_last_30_days}</TableCell><TableCell>{score(row.average_confidence)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    ),
  },
  {
    // Spec: Rep Dashboard "Search Box".  Reads nothing from /api/v1/dashboard; it searches
    // through AI Filtering, which applies the Rep's own ownership scope.
    id: 'prospect-search', title: 'Find prospects', perm: PERMISSIONS.DASHBOARD_OWN, group: 'own',
    render: () => <ProspectSearchBox />,
  },
  {
    id: 'my-calls', title: 'My calls', perm: PERMISSIONS.DASHBOARD_OWN, group: 'own',
    render: (d) => (
      <Section title="My calls" note={`${d.my_calls.last_30_days} in the last 30 days, from your campaigns and calls you scheduled.`}>
        {d.my_calls.recent.length ? (
          <ul className="divide-y divide-border text-sm">
            {d.my_calls.recent.map((call) => (
              <li key={call.id} className="py-2 flex justify-between gap-2">
                <span>{call.customer_name || 'Unknown caller'}</span>
                <span className="text-muted-foreground">{call.status}{call.duration_seconds ? ` · ${call.duration_seconds}s` : ''}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No calls yet.</Empty>}
      </Section>
    ),
  },
  {
    id: 'my-scores', title: 'My scores', perm: PERMISSIONS.DASHBOARD_OWN, group: 'own',
    render: (d) => (
      <div className="grid grid-cols-2 gap-4">
        <KpiCard title="My average intent confidence" value={score(d.my_scores.average_confidence)} icon={Star} />
        <KpiCard title="Assessments" value={d.my_scores.assessments} icon={Activity} />
      </div>
    ),
  },
  {
    id: 'my-callbacks', title: 'My callbacks', perm: PERMISSIONS.DASHBOARD_OWN, group: 'own',
    render: (d) => (
      <Section title="My callbacks" note="Open callbacks requested on your calls.">
        {d.my_callbacks.length ? (
          <ul className="divide-y divide-border text-sm">
            {d.my_callbacks.map((task) => (
              <li key={task.id} className="py-2 flex justify-between gap-2">
                <span>{task.kind === 'human_handoff' ? 'Wants a person' : 'Callback'} · {task.reason.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">{new Date(task.due_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No open callbacks.</Empty>}
      </Section>
    ),
  },
];

/** The widgets `can` allows, in order, that have data from the server. */
export const allowedWidgets = (can, widgets = WIDGETS, data = {}) =>
  widgets.filter((widget) => can(widget.perm) && data[widget.group]);
