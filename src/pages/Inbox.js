import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, FileText, Inbox as InboxIcon, Loader2, Mail, Phone, RotateCw, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BrochureRequests from '@/components/admin/BrochureRequests';
import { useAuth } from '@/lib/AuthContext';
import { featureEnabled } from '@/lib/rbac';
import { listLeadEmails } from '@/lib/api';

// GET /api/v1/lead-emails: every email sent (or queued) to a lead, newest first.
export const FILTERS = [
  { value: '', label: 'All' },
  { value: 'brochure', label: 'Brochures' },
  { value: 'meeting', label: 'Meeting emails' },
];
// The brochure requests from calls (approve, reject, confirm and send, resend): Tenant Admins and Managers.
export const REQUESTS = 'requests';
const REQUEST_ROLES = ['tenant_admin', 'manager'];
const STATUS_TONES = {
  sent: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
  pending: 'bg-blue-500/10 text-blue-700 border-blue-500/25',
  sending: 'bg-blue-500/10 text-blue-700 border-blue-500/25',
  awaiting_approval: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
  needs_follow_up: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
  failed: 'bg-red-500/10 text-red-700 border-red-500/25',
  skipped: 'bg-muted text-muted-foreground border-border',
};
const callLink = (row) => `/voice_agent?tab=logs&call=${encodeURIComponent(row.vapi_call_id || row.call_log_id)}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');

function EmailRow({ row, onOpenRequests }) {
  const Icon = row.kind === 'brochure' ? FileText : CalendarCheck;
  return (
    <Card className="card-base p-4 space-y-1.5" data-testid={`lead-email-${row.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <span dir="auto" className="truncate">{row.subject || row.kind_label}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5" dir="auto">
            To {row.to_name || 'the lead'}{row.to_email ? ` <${row.to_email}>` : ''}
            {row.from_name ? ` · from ${row.from_name}'s mailbox` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <Badge variant="outline" className={STATUS_TONES[row.status] || ''}>{row.status_label}</Badge>
          <p className="text-[11px] text-muted-foreground mt-1">{when(row.sent_at || row.send_at || row.created_at)}</p>
        </div>
      </div>
      <p className="text-sm" dir="auto"><span className="text-muted-foreground">Why: </span>{row.reason}</p>
      {row.attachment && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Attached: {row.attachment}</p>
      )}
      {row.problem && row.status !== 'sent' && <p className="text-xs text-red-600">{row.problem}</p>}
      <div className="flex flex-wrap gap-3 pt-1 text-xs">
        {(row.vapi_call_id || row.call_log_id) && (
          <Link to={callLink(row)} className="text-primary underline inline-flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" /> Open call log
          </Link>
        )}
        {row.status === 'needs_follow_up' && onOpenRequests && (
          <button type="button" onClick={onOpenRequests} className="text-primary underline inline-flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Confirm and send in Brochure requests
          </button>
        )}
        {row.prospect_id && (
          <Link to={`/leads?prospect=${row.prospect_id}`} className="text-primary underline inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Open {row.prospect_name || 'lead'}
          </Link>
        )}
      </div>
    </Card>
  );
}

/** Every email sent to your leads: what went, why, from which call, and whether it arrived. */
export default function InboxPage() {
  const { hasRole, user } = useAuth();
  const canRequests = hasRole(...REQUEST_ROLES) && featureEnabled(user, 'send_brochure');
  const [params, setParams] = useSearchParams();
  const kind = params.get('view') === REQUESTS && !canRequests ? '' : (params.get('view') || '');
  const setKind = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('view', value); else next.delete('view');
    setParams(next, { replace: true });
  };
  const showRequests = kind === REQUESTS;
  const tabs = canRequests ? [...FILTERS, { value: REQUESTS, label: 'Brochure requests' }] : FILTERS;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (kind === REQUESTS) return;
    setLoading(true);
    try {
      const res = await listLeadEmails(kind ? { kind } : {});
      setRows(res?.data || []);
      setError(null);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.detail || 'Could not load emails. Try again.');
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-primary" /> Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every email sent to your leads: brochures they asked for on calls, and meeting confirmations and overviews.
          </p>
        </div>
        {!showRequests && <Button variant="ghost" size="sm" onClick={load} aria-label="Refresh"><RotateCw className="w-4 h-4" /></Button>}
      </div>

      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted" role="tablist" aria-label="Email type">
        {tabs.map((f) => (
          <button key={f.value || 'all'} type="button" role="tab" aria-selected={kind === f.value} onClick={() => setKind(f.value)}
            className={`px-3 py-1.5 text-sm rounded-md ${kind === f.value ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {showRequests ? (
        <Card className="card-base p-4"><BrochureRequests canOperate={canRequests} /></Card>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          No emails to leads yet. They appear here when an agent sends a brochure or a meeting is booked.
        </div>
      ) : (
        <div className="space-y-2">{rows.map((row) => <EmailRow key={row.id} row={row} onOpenRequests={canRequests ? () => setKind(REQUESTS) : null} />)}</div>
      )}
    </div>
  );
}
