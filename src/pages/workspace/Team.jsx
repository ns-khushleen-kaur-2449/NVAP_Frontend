import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { ROLE_LABELS } from '../../config/roles';
import { AsyncBoundary, Badge, Button, PageHeader, Panel } from '../../components/primitives';

/** Team & roles (doc §23, §29.3). Invite flow lands with the backend. */
export default function Team() {
  const query = useNvipQuery(() => workspaceApi.team(), []);
  return (
    <>
      <PageHeader title="Team & Roles" subtitle="Who can configure agents, handle escalations and view reports." actions={<Button disabled title="Available once the users API is connected">Invite user</Button>} />
      <Panel>
        <AsyncBoundary query={query}>
          {(users) => (
            <ul className="divide-y divide-[var(--nv-line)]">
              {users.map((u) => (
                <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-[var(--nv-muted)] truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{ROLE_LABELS[u.role] ?? u.role}</span>
                    <Badge tone={u.status === 'active' ? 'success' : 'warning'}>{u.status === 'active' ? 'Active' : 'Invited'}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </Panel>
    </>
  );
}
