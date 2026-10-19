import { Pencil, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { canManageUser } from '@/lib/rbac';
import { RoleBadge, StatusBadge, UserIdentity } from '@/components/admin/userBits';

/**
 * Users with their role, team and status.  Edit / Deactivate / Reactivate appear only on rows
 * the actor may manage (canManageUser: role + tenant + team); the backend enforces the same rule.
 */
export default function UsersTable({ users, actor, showTenant = false, onEdit, onToggleActive, busyId = null }) {
  if (!users.length) {
    return <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-8 text-center">No users match.</p>;
  }
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            {showTenant && <TableHead>Tenant</TableHead>}
            <TableHead>Team</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((row) => {
            const manageable = canManageUser(actor, row);
            const active = (row.status || '').toLowerCase() === 'active';
            return (
              <TableRow key={row.id} data-testid={`user-row-${row.id}`}>
                <TableCell><UserIdentity user={row} /></TableCell>
                <TableCell><RoleBadge role={row.role} /></TableCell>
                {showTenant && <TableCell className="text-sm">{row.tenant_name || '—'}</TableCell>}
                <TableCell className="text-sm">
                  {row.role === 'manager' ? 'Leads a team' : row.manager_name || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><StatusBadge user={row} /></TableCell>
                <TableCell className="text-right">
                  {manageable && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" aria-label={`Edit ${row.name}`}
                        onClick={() => onEdit?.(row)} disabled={busyId === row.id}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${active ? 'text-red-600' : ''}`}
                        title={active ? 'Deactivate' : 'Reactivate'} aria-label={`${active ? 'Deactivate' : 'Reactivate'} ${row.name}`}
                        onClick={() => onToggleActive?.(row)} disabled={busyId === row.id}>
                        {active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
