import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Inbox, Loader2, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ReasonDialog from '@/components/ops/ReasonDialog';
import { decideBrochureRequest, listBrochureRequests } from '@/lib/api';
import { errorList } from './brochureControls';

// brochure_requests.status (backend BrochureRequestStatus).
export const STATUS_LABELS = {
  queued: 'Sending', awaiting_approval: 'Waiting for approval', sent: 'Sent', duplicate: 'Already sent',
  email_not_confirmed: 'Email not confirmed', invalid_email: 'Invalid email', product_unclear: 'Asked which product',
  no_brochure: 'No brochure', no_sender: 'No mailbox', rejected: 'Not sent', failed: 'Failed', error: 'Error',
};
const MATCH_LABELS = { exact: 'exact', alias: 'alias', fuzzy: 'close spelling', fallback: 'company brochure', none: '—' };
const ACTIONS = {
  'confirm-send': { label: 'Confirm and send', title: 'Confirm the email and send the brochure',
    confirm: 'Confirm and send', flag: 'can_confirm_send' },
  approve: { label: 'Approve', title: 'Send this brochure', confirm: 'Approve and send', flag: 'can_approve' },
  reject: { label: 'Reject', title: "Don't send this brochure", confirm: 'Reject', flag: 'can_approve', danger: true },
  cancel: { label: 'Cancel', title: 'Stop this email before it goes', confirm: 'Cancel email', flag: 'can_cancel', danger: true },
  resend: { label: 'Resend', title: 'Send this brochure again now', confirm: 'Resend', flag: 'can_resend' },
};

/**
 * Brochures leads asked for on calls, newest first. Tenant Admins and Managers approve held ones,
 * reject, cancel or resend, each with a reason (kept in the audit log).
 */
export default function BrochureRequests({ canOperate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [newEmail, setNewEmail] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await listBrochureRequests();
      setRows(res?.data || []);
    } catch (e) {
      toast.error(errorList(e, 'Failed to load brochure requests')[0]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (reason) => {
    try {
      const extra = acting.action === 'confirm-send' && newEmail.trim() ? { email: newEmail.trim() } : {};
      await decideBrochureRequest(acting.row.id, acting.action, reason, extra);
      toast.success(`${ACTIONS[acting.action].label}: done`);
      await load();
      return true;
    } catch (e) {
      toast.error(errorList(e, 'That did not work')[0]);
      await load();
      return false;
    }
  };

  return (
    <section className="space-y-2" aria-labelledby="brochure-requests">
      <div className="flex items-center justify-between">
        <h3 id="brochure-requests" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Inbox className="w-3.5 h-3.5" /> Brochure requests
        </h3>
        <Button size="sm" variant="ghost" onClick={load} aria-label="Refresh brochure requests"><RotateCw className="w-4 h-4" /></Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg py-5 text-center">No brochure requests yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <div key={r.id} data-testid={`brochure-request-${r.id}`} className="p-3 flex items-start gap-3 text-xs">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" dir="auto">{r.lead_name || 'A lead'}</span>
                  <Badge variant="outline" className="text-[11px]">{STATUS_LABELS[r.status] || r.status}</Badge>
                  {r.needs_follow_up && (
                    <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/25">Needs follow-up</Badge>
                  )}
                  <span className="text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                </div>
                <p dir="auto">
                  Asked for “{r.product_name_spoken}” · {MATCH_LABELS[r.match_type] || r.match_type}
                  {r.matched_product ? ` (${r.matched_product})` : ''}{r.brochure ? ` · ${r.brochure}` : ''}
                </p>
                {r.email && <p className="text-muted-foreground">To {r.email}</p>}
                {r.detail && <p className="text-muted-foreground">{r.detail}</p>}
                {r.decision_reason && <p className="text-muted-foreground">Reason: {r.decision_reason}</p>}
              </div>
              {canOperate && (
                <div className="flex items-center gap-1 shrink-0">
                  {Object.entries(ACTIONS).filter(([, a]) => r[a.flag]).map(([action, a]) => (
                    <Button key={action} size="sm" variant={action === 'approve' || action === 'confirm-send' ? 'default' : 'ghost'}
                      className={`h-7 px-2 ${a.danger ? 'text-red-600' : ''}`}
                      onClick={() => { setNewEmail(''); setActing({ action, row: r }); }}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {acting && (
        <ReasonDialog open onOpenChange={(open) => !open && setActing(null)} title={ACTIONS[acting.action].title}
          changes={[`${acting.row.lead_name || 'The lead'}: ${acting.row.brochure || 'the brochure'}${acting.row.email ? ` to ${acting.row.email}` : ''}`]}
          confirmLabel={ACTIONS[acting.action].confirm} danger={ACTIONS[acting.action].danger}
          onConfirm={async (reason) => { const ok = await act(reason); if (ok) setActing(null); return ok; }}>
          {acting.action === 'confirm-send' && (
            <label className="block text-xs font-medium text-muted-foreground">
              Corrected email (leave empty to use {acting.row.email || 'the one on file'})
              <Input dir="auto" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} maxLength={320}
                aria-label="Corrected email" className="mt-1" />
            </label>
          )}
        </ReasonDialog>
      )}
    </section>
  );
}
