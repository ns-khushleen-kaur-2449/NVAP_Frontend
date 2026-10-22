import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Send, ArrowLeft, Check, X, RotateCw, PhoneCall, Mail, Briefcase, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getSdrCampaign, generateCampaignMessages, approveCampaignMessage,
  rejectCampaignMessage, regenerateCampaignMessage, sendApprovedCampaignMessages,
  launchCampaignCalls, getAssistants,
} from '@/lib/api';

const CHANNEL_META = {
  email: { icon: Mail, emoji: '📧', label: 'Email' },
  linkedin: { icon: Briefcase, emoji: '💼', label: 'LinkedIn' },
  phone: { icon: Phone, emoji: '📞', label: 'Phone call' },
  sms: { icon: MessageSquare, emoji: '💬', label: 'SMS' },
};
const channelMeta = (channel) => CHANNEL_META[channel] || { icon: MessageSquare, emoji: '✉️', label: channel || 'Touchpoint' };

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [callResult, setCallResult] = useState(null);

  const load = useCallback(() => {
    getSdrCampaign(id).then((r) => setData(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getAssistants().then((r) => {
      const live = (r.data || []).filter((a) => a.is_live && a.vapi_assistant_id);
      setAssistants(live);
      setSelectedAssistant((prev) => prev || live[0]?.vapi_assistant_id || '');
    }).catch(() => {});
  }, []);

  const generate = async () => {
    setBusy('generate');
    try {
      const r = await generateCampaignMessages(id, 5);
      toast.success(`Drafted ${r.data.created} messages across the full sequence for ${r.data.prospects_drafted} prospects`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to generate messages'); }
    setBusy('');
  };

  const approve = async (msg) => {
    setBusy(msg.id);
    try {
      await approveCampaignMessage(msg.id, editingId === msg.id ? { body: editBody } : {});
      setEditingId(null);
      load();
    } catch (e) { toast.error('Approve failed'); }
    setBusy('');
  };

  const reject = async (msg) => {
    setBusy(msg.id);
    try { await rejectCampaignMessage(msg.id); load(); } catch (e) { toast.error('Reject failed'); }
    setBusy('');
  };

  const regenerate = async (msg) => {
    const instructions = window.prompt('How should this message change?', '');
    if (instructions === null) return;
    setBusy(msg.id);
    try { await regenerateCampaignMessage(msg.id, instructions); load(); } catch (e) { toast.error('Regenerate failed'); }
    setBusy('');
  };

  const sendApproved = async () => {
    setBusy('send');
    try {
      const r = await sendApprovedCampaignMessages(id);
      toast.success(`${r.data.sent_count} messages marked sent (${r.data.note})`);
      load();
    } catch (e) { toast.error('Send failed'); }
    setBusy('');
  };

  const callAudience = async () => {
    if (!selectedAssistant) { toast.error('Choose an assistant first'); return; }
    setBusy('call');
    try {
      const r = await launchCampaignCalls(id, selectedAssistant);
      setCallResult(r.data);
      toast.success(`Calling ${r.data.initiated_count} of ${r.data.initiated_count + r.data.skipped_count} in this campaign`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to launch calls'); }
    setBusy('');
  };

  if (!data) return <div className="text-muted-foreground">Loading…</div>;
  const { campaign, messages, prospects } = data;
  const byProspectThenDay = (a, b) => (a.prospect_name || '').localeCompare(b.prospect_name || '') || (a.sequence_day ?? 0) - (b.sequence_day ?? 0);
  const pending = messages.filter((m) => m.status === 'drafted').sort(byProspectThenDay);
  const approvedMsgs = messages.filter((m) => m.status === 'approved').sort(byProspectThenDay);
  const sentMsgs = messages.filter((m) => m.status === 'sent').sort(byProspectThenDay);

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="text-xs text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Campaigns</Link>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{campaign.metadata?.messaging_angle}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={busy === 'generate'}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> {busy === 'generate' ? 'Drafting…' : 'Generate AI messages'}
          </Button>
          <Button size="sm" onClick={sendApproved} disabled={busy === 'send' || approvedMsgs.length === 0} className="bg-primary text-primary-foreground">
            <Send className="w-3.5 h-3.5 mr-1" /> {busy === 'send' ? 'Sending…' : `Mark ${approvedMsgs.length} sent`}
          </Button>
        </div>
      </div>
      <p className="text-xs text-amber-600 -mt-4">Sending marks messages as sent for tracking — live email delivery isn't wired up yet.</p>

      <div>
        <h2 className="text-sm font-semibold mb-3">Approval queue ({pending.length})</h2>
        <div className="space-y-3">
          {pending.map((m) => {
            const cm = channelMeta(m.channel);
            const CIcon = cm.icon;
            return (
            <Card key={m.id} className="card-base p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{m.prospect_name}</div>
                  {m.sequence_day != null && <Badge variant="outline" className="font-mono">Day {m.sequence_day}</Badge>}
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CIcon className="w-3.5 h-3.5" /> {cm.emoji} {cm.label}
                  </span>
                </div>
                <Badge variant="secondary">drafted</Badge>
              </div>
              {m.subject && <div className="text-xs text-muted-foreground mb-1">{m.subject}</div>}
              {editingId === m.id ? (
                <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="text-sm mb-2" rows={4} />
              ) : (
                <p className="text-sm mb-2 whitespace-pre-wrap">{m.body}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(m)} disabled={busy === m.id} className="bg-emerald-600 text-white hover:bg-emerald-500"><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingId(m.id); setEditBody(m.body); }}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => regenerate(m)} disabled={busy === m.id}><RotateCw className="w-3.5 h-3.5 mr-1" /> Regenerate</Button>
                <Button size="sm" variant="ghost" onClick={() => reject(m)} disabled={busy === m.id}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
              </div>
            </Card>
            );
          })}
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No drafts pending — generate AI messages to get started.</p>}
        </div>
      </div>

      {(approvedMsgs.length > 0 || sentMsgs.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Approved / Sent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...approvedMsgs, ...sentMsgs].map((m) => {
              const cm = channelMeta(m.channel);
              return (
              <Card key={m.id} className="card-base p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{m.prospect_name}</div>
                  <Badge variant={m.status === 'sent' ? 'default' : 'secondary'}>{m.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  {m.sequence_day != null && <span className="font-mono">Day {m.sequence_day}</span>}
                  <span>{cm.emoji} {cm.label}</span>
                </div>
                {m.subject && <div className="text-xs text-muted-foreground truncate mt-0.5">{m.subject}</div>}
              </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold">Audience ({prospects.length} real prospects)</h2>
          <div className="flex items-center gap-2">
            <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Choose an assistant" />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((a) => (
                  <SelectItem key={a.vapi_assistant_id} value={a.vapi_assistant_id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={callAudience} disabled={busy === 'call' || prospects.length === 0}>
              <PhoneCall className="w-3.5 h-3.5 mr-1" /> {busy === 'call' ? 'Calling…' : 'Call this audience'}
            </Button>
          </div>
        </div>
        {callResult && (
          <p className="text-xs text-muted-foreground mb-3">
            Calling {callResult.initiated_count} of {callResult.initiated_count + callResult.skipped_count}
            {callResult.skipped_count > 0 && ` — ${callResult.skipped_count} skipped (no phone number or Vapi error)`}.
            Calls will show up in Calls and Prospecting once they end.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {prospects.map((p) => (
            <div key={p.id} className="text-xs border border-border rounded-md px-3 py-2 bg-[hsl(var(--surface-2))]">
              <div className="font-medium">{p.name}</div>
              <div className="text-muted-foreground">{p.title}{p.company ? ` · ${p.company}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
