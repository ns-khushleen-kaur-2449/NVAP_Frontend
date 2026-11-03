import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import { listPlatformUsers, createPlatformUser, updatePlatformUserStatus } from '@/lib/api';
import { errorText } from '@/components/admin/userBits';
import { generateTemporaryPassword } from '@/lib/passwords';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 25;

export default function PlatformUsersPage() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', temporary_password: generateTemporaryPassword(), reason: '' });
  const [createdPassword, setCreatedPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await listPlatformUsers({ page, page_size: PAGE_SIZE, q: query || undefined, status: status || undefined });
      setData(response.data);
    } catch (e) { setError(errorText(e, 'Could not load platform users')); }
    finally { setLoading(false); }
  }, [page, query, status]);
  useEffect(() => { load(); }, [load]);

  const create = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await createPlatformUser(form);
      setCreatedPassword(form.temporary_password);
      toast.success('Super Admin account created');
      await load();
    } catch (e) { setError(errorText(e, 'Could not create the Super Admin')); }
    finally { setSaving(false); }
  };
  const changeStatus = async (reason) => {
    const next = confirming.status.toLowerCase() === 'active' ? 'inactive' : 'active';
    try {
      await updatePlatformUserStatus(confirming.id, next, reason);
      toast.success(next === 'inactive' ? 'Super Admin disabled' : 'Super Admin enabled');
      setConfirming(null); await load(); return true;
    } catch (e) { toast.error(errorText(e, 'Could not update account')); return false; }
  };
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));

  return <div className="max-w-6xl mx-auto space-y-6" data-testid="platform-users-page">
    <div className="flex items-start justify-between gap-4 flex-wrap"><div><h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Platform Users</h1><p className="text-sm text-muted-foreground mt-1">Manage Super Admin accounts and their access.</p></div>
      <Button onClick={() => { setForm({ name: '', email: '', temporary_password: generateTemporaryPassword(), reason: '' }); setCreatedPassword(''); setError(''); setCreating(true); }}><Plus className="w-4 h-4 mr-1" />Add Super Admin</Button>
    </div>
    <Card className="card-base p-4 space-y-4">
      <div className="flex flex-wrap gap-3"><Input aria-label="Search platform users" placeholder="Search name or email" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="max-w-sm" />
        <select aria-label="Account status" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      {error && !creating && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && !data ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : data?.users?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>MFA</TableHead><TableHead>Last login</TableHead><TableHead>Created</TableHead><TableHead>Failed logins</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{data.users.map((user) => <TableRow key={user.id}><TableCell>{user.name}</TableCell><TableCell>{user.email}</TableCell><TableCell><Badge variant={user.status === 'active' ? 'secondary' : 'outline'}>{user.status}</Badge></TableCell><TableCell>Not supported</TableCell><TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</TableCell><TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell><TableCell>Not tracked</TableCell><TableCell><Button variant="outline" size="sm" disabled={loading} onClick={() => setConfirming(user)}>{user.status === 'active' ? 'Disable' : 'Enable'}</Button></TableCell></TableRow>)}</TableBody>
      </Table></div> : !loading && <p className="py-8 text-center text-sm text-muted-foreground">No platform users found.</p>}
      <div className="flex justify-between items-center text-sm text-muted-foreground"><span>{data ? `${data.total} account${data.total === 1 ? '' : 's'}` : ''}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((v) => v - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages || loading} onClick={() => setPage((v) => v + 1)}>Next</Button></div></div>
      <p className="border-t pt-3 text-xs text-muted-foreground">This authentication system has no per-session records or MFA support. Disabling an account blocks its existing JWTs at the next request. Failed-login counters are not currently stored.</p>
    </Card>

    <Dialog open={creating} onOpenChange={setCreating}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{createdPassword ? 'Super Admin created' : 'Add Super Admin'}</DialogTitle><DialogDescription>{createdPassword ? 'Share the temporary password securely. They must change it at first login.' : 'The new account will be required to change its temporary password at first login.'}</DialogDescription></DialogHeader>
      {createdPassword ? <div className="space-y-3"><p className="text-xs text-muted-foreground">Temporary password (shown only now)</p><code className="block rounded bg-muted p-3 break-all">{createdPassword}</code><DialogFooter><Button onClick={() => setCreating(false)}>Done</Button></DialogFooter></div> : <form onSubmit={create} className="space-y-3">
        <label className="block text-sm">Name<Input required maxLength={255} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="block text-sm">Email<Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm">Temporary password<Input required type="password" value={form.temporary_password} onChange={(e) => setForm({ ...form, temporary_password: e.target.value })} /></label>
        <label className="block text-sm">Reason<Input required minLength={3} maxLength={2000} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account</Button></DialogFooter>
      </form>}</DialogContent></Dialog>
    <ReasonDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}
      title={confirming ? `${confirming.status === 'active' ? 'Disable' : 'Enable'} ${confirming.name}?` : ''}
      description="Disabling blocks the account's existing JWTs immediately when next used. The last active Super Admin cannot be disabled."
      confirmLabel={confirming?.status === 'active' ? 'Disable account' : 'Enable account'} danger={confirming?.status === 'active'}
      reasonPlaceholder="Why is this account changing status?" onConfirm={changeStatus} />
  </div>;
}
