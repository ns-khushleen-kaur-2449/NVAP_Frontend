import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { getVoiceCampaigns, deleteVoiceCampaign } from '@/lib/api';
import { toast } from 'sonner';
import {
  Megaphone, Loader2, RefreshCw, Trash2, Calendar, Users, PhoneCall,
  CheckCircle2, AlertCircle, ChevronRight, Copy, Check, Clock, User, FileEdit, Ban,
} from 'lucide-react';

// campaigns.status is written by the backend: "processing" while the CSV batch
// is dialling, "completed" when it finishes, "created" for a campaign row that
// exists but has not started. Anything still running is grouped as Ongoing.
const ONGOING_STATUSES = ['processing', 'created', 'scheduled', 'running'];

const isOngoing = (status) => ONGOING_STATUSES.includes(String(status || '').toLowerCase());
// Drafts are listed with ongoing work but nothing about them changes on its own, so they are not polled for.
const isActiveOrDraft = (status) => isOngoing(status) || String(status || '').toLowerCase() === 'draft';

// Poll only while something is actually running; a page of finished campaigns
// should not keep hitting the API.
const POLL_INTERVAL_MS = 15000;

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  const map = {
    completed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
    processing: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: Loader2 },
    created: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: AlertCircle },
    scheduled: { color: 'bg-violet-500/15 text-violet-400 border-violet-500/25', icon: Clock },
    draft: { color: 'bg-muted text-muted-foreground border-border', icon: FileEdit },
    cancelled: { color: 'bg-muted text-muted-foreground border-border', icon: Ban },
    failed: { color: 'bg-red-500/15 text-red-400 border-red-500/25', icon: AlertCircle },
  };
  const cfg = map[s] || map.created;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1 text-[10px] font-medium`}>
      <Icon className={`w-2.5 h-2.5 ${s === 'processing' ? 'animate-spin' : ''}`} />
      {status || 'unknown'}
    </Badge>
  );
}

/**
 * An id, click-to-copy, prefixed with what kind of id it is.
 *
 * Campaign ids are 36-char UUIDs, so the list view shows a shortened form with
 * the full value in the title attribute; the detail view passes full so the
 * whole id is readable. CSV process ids are short integers and are never
 * shortened. Copying is what this is actually for — a campaign id is what you
 * paste into a call-log filter, a CSV process id is what the CSV Call Campaign
 * tab's "Fetch Call History" box takes.
 *
 * Exported because VoiceCampaignDetail renders the same chip.
 */
export function IdChip({ id, label = 'id', full = false, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (id === null || id === undefined || id === '') return null;

  const text = String(id);
  const shown = full || text.length <= 12 ? text : `${text.slice(0, 8)}…`;

  const copy = async (e) => {
    // Cards and rows are themselves clickable — copying must not also navigate.
    e.stopPropagation();
    e.preventDefault();
    try {
      // Undefined on an insecure origin (plain http on a LAN address), so this
      // is guarded rather than assumed.
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the id and copy manually.');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${text} (click to copy)`}
      className={`inline-flex items-center gap-1 rounded border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors ${className}`}
    >
      <span className="opacity-60">{label}</span>
      {shown}
      {copied
        ? <Check className="w-2.5 h-2.5 text-emerald-400" />
        : <Copy className="w-2.5 h-2.5 opacity-60" />}
    </button>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function CampaignCard({ campaign, onOpen, onDelete, deleting }) {
  const ongoing = isOngoing(campaign.status);

  // total_leads is the CSV batch size, written once the upload is parsed.
  // calls_logged is how many of those have produced a call log so far — it is
  // what moves during a run, so it is the numerator for progress.
  const total = campaign.total_leads || 0;
  const logged = campaign.calls_logged || 0;
  const pct = total > 0 ? Math.min(100, Math.round((logged / total) * 100)) : 0;

  return (
    <Card className="bg-card border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={() => onOpen(campaign.id)}
            className="flex-1 min-w-0 text-left group"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {campaign.name || 'Untitled campaign'}
              </span>
              <StatusBadge status={campaign.status} />
              <IdChip id={campaign.id} label="campaign" />
              <IdChip id={campaign.csv_process_id} label="csv" full />
            </div>

            {campaign.description && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDate(campaign.created_at)}
              </span>
              {campaign.created_by_user && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {campaign.created_by_user.name || campaign.created_by_user.email}
                </span>
              )}
              {campaign.status === 'scheduled' && campaign.scheduled_at && (
                <span className="flex items-center gap-1 text-violet-400">
                  <Clock className="w-3 h-3" /> starts {new Date(campaign.scheduled_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span className="flex items-center gap-1 tabular-nums">
                <Users className="w-3 h-3" /> {total || '—'} contacts
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <PhoneCall className="w-3 h-3" /> {logged} dialled
              </span>
            </div>

            {/* Progress only where there is a denominator to divide by. */}
            {ongoing && total > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={pct} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {logged} of {total} dialled ({pct}%)
                </p>
              </div>
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={() => onDelete(campaign)}
              disabled={deleting}
              aria-label={`Delete campaign ${campaign.name || campaign.id}`}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VoiceCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setError(null);
      const res = await getVoiceCampaigns();
      const data = res.data || res;
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const { ongoing, completed } = useMemo(() => {
    const on = [];
    const done = [];
    for (const c of campaigns) (isActiveOrDraft(c.status) ? on : done).push(c);
    return { ongoing: on, completed: done };
  }, [campaigns]);

  // Poll while at least one campaign is still running, and stop once none are.
  // The effect keys on the count, not the array, so a refetch that changes
  // nothing does not tear down and rebuild the interval.
  const ongoingCount = ongoing.filter((c) => isOngoing(c.status)).length;
  useEffect(() => {
    if (ongoingCount === 0) return undefined;
    const id = setInterval(fetchCampaigns, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ongoingCount, fetchCampaigns]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    setDeletingId(id);
    try {
      await deleteVoiceCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Campaign "${name || id}" deleted. Its call logs were kept.`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
  };

  const renderGroup = (title, rows, emptyText) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <Badge variant="outline" className="text-[10px] tabular-nums">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-3">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onOpen={(id) => navigate(`/voice-campaigns/${id}`)}
              onDelete={setPendingDelete}
              deleting={deletingId === c.id}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="va-tab-content">
      <div className="va-tab-header">
        <div className="va-tab-icon-wrap"><Megaphone className="w-5 h-5" /></div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Voice Campaigns</h2>
          <p className="text-sm text-muted-foreground">Calling campaigns and how far each one got</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCampaigns}
          disabled={loading}
          className="border-border bg-card hover:bg-[hsl(var(--surface-2))]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading campaigns…
        </div>
      ) : error ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCampaigns}>Try again</Button>
          </CardContent>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center space-y-2">
            <Megaphone className="w-7 h-7 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">No campaigns yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Select leads in the Lead-to-Campaign Builder (or upload a contact file) and click
              Launch Campaign to start one now or schedule it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {renderGroup('Ongoing', ongoing, 'Nothing running right now.')}
          {renderGroup('Finished', completed, 'No finished campaigns yet.')}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.name || pendingDelete?.id}"{' '}
              (<span className="font-mono text-xs">{pendingDelete?.id}</span>) will be removed
              from this list. Its call logs are kept and stay visible in Call Logs — they just
              stop being grouped under this campaign. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
