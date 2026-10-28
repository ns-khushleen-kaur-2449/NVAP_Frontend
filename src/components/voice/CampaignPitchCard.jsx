import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OpsButton from '@/components/ops/OpsButton';
import { updateVoiceCampaign } from '@/lib/api';
import { canManageCampaigns, canOperate } from '@/lib/rbac';
import { toast } from 'sonner';
import { apiErrorMessage } from './CampaignSettingsFields';

// campaigns.pitch (app/schemas/requests/campaign_pitch.py): what this call list is about. It reaches
// each call as the call reason and campaign brief; no field may name a price.
export const OBJECTIVES = [
  { value: 'demo', label: 'Book a demo' },
  { value: 'sell', label: 'Sell' },
  { value: 'site_visit', label: 'Site visit' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'event_invite', label: 'Event invite' },
  { value: 're_engagement', label: 'Re-engage' },
  { value: 'custom', label: 'Something else' },
];
const LIVE = ['processing', 'paused'];
const FINAL = ['completed', 'cancelled', 'failed'];
const LIMITS = { benefits: 5, proof_points: 5, discovery_questions: 3, highlights: 5, objections: 10 };

/**
 * Who may change the pitch now. Like the calling rules: anyone who edits campaigns until it starts;
 * while it runs (or is paused), only a Tenant Admin or Manager, with a reason; never once it is final.
 */
export function pitchEditState(campaign, user) {
  if (!campaign || !canManageCampaigns(user)) return { canEdit: false, needsReason: false, note: null };
  if (FINAL.includes(campaign.status)) {
    return { canEdit: false, needsReason: false, note: 'This campaign has finished; its pitch can no longer change.' };
  }
  if (LIVE.includes(campaign.status)) {
    return canOperate(user)
      ? { canEdit: true, needsReason: true, note: null }
      : { canEdit: false, needsReason: false, note: 'Only a Tenant Admin or Manager can change the pitch while the campaign runs.' };
  }
  return { canEdit: true, needsReason: false, note: null };
}

const lines = (text, limit) => text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, limit);
const text = (value) => (value || '').trim() || null;
const objectiveLabel = (pitch) => (pitch?.objective === 'custom' ? pitch.objective_text || 'Something else'
  : OBJECTIVES.find((o) => o.value === pitch?.objective)?.label);

function formFrom(pitch) {
  const p = pitch || {};
  return {
    objective: p.objective || '', objective_text: p.objective_text || '', success_definition: p.success_definition || '',
    call_reason: p.call_reason || '', offering_name: p.offering_name || '', offering_one_liner: p.offering_one_liner || '',
    audience: p.audience || '', offer_text: p.offer_text || '', cta: p.cta || '',
    benefits: (p.benefits || []).join('\n'), proof_points: (p.proof_points || []).join('\n'),
    discovery_questions: (p.discovery_questions || []).join('\n'),
    project_name: p.project?.name || '', project_location: p.project?.location || '',
    project_one_liner: p.project?.one_liner || '', project_highlights: (p.project?.highlights || []).join('\n'),
    project_possession: p.project?.possession || '',
    objections: (p.objections || []).map((o) => ({ ...o })),
  };
}

/** The pitch to send; settings this form doesn't edit (attempt limit, what to confirm) are kept. */
export function pitchFrom(form, previous) {
  const project = {
    name: text(form.project_name), location: text(form.project_location), one_liner: text(form.project_one_liner),
    highlights: lines(form.project_highlights, LIMITS.highlights), possession: text(form.project_possession),
  };
  const hasProject = Object.values(project).some((v) => (Array.isArray(v) ? v.length : v));
  return {
    objective: form.objective || null,
    objective_text: form.objective === 'custom' ? text(form.objective_text) : null,
    success_definition: text(form.success_definition),
    call_reason: text(form.call_reason),
    offering_name: text(form.offering_name),
    offering_one_liner: text(form.offering_one_liner),
    audience: text(form.audience),
    benefits: lines(form.benefits, LIMITS.benefits),
    proof_points: lines(form.proof_points, LIMITS.proof_points),
    offer_text: text(form.offer_text),
    project: hasProject ? project : null,
    discovery_questions: lines(form.discovery_questions, LIMITS.discovery_questions),
    objections: form.objections.filter((o) => o.objection.trim() && o.response.trim())
      .map((o) => ({ objection: o.objection.trim(), response: o.response.trim() })).slice(0, LIMITS.objections),
    max_objection_attempts: previous?.max_objection_attempts ?? 2,
    cta: text(form.cta),
    cta_confirm: previous?.cta_confirm || [],
  };
}

function PitchDialog({ campaign, open, onOpenChange, needsReason, onSaved }) {
  const [form, setForm] = useState(formFrom(campaign?.pitch));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setForm(formFrom(campaign?.pitch));
    setReason('');
    setError('');
  }, [open, campaign]);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e?.target ? e.target.value : e }));
  const setObjection = (i, key, value) => setForm((prev) => ({
    ...prev, objections: prev.objections.map((o, n) => (n === i ? { ...o, [key]: value } : o)),
  }));

  const submit = async (pitch) => {
    if (needsReason && !reason.trim()) { setError('Say why the pitch changes while the campaign runs.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await updateVoiceCampaign(campaign.id, { pitch, ...(needsReason ? { reason: reason.trim() } : {}) });
      toast.success(pitch ? 'Pitch saved' : 'Pitch cleared');
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to save the pitch'));
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={`pitch-${key}`} className="text-xs font-medium text-muted-foreground">{label}</label>
      {props.rows
        ? <Textarea id={`pitch-${key}`} dir="auto" value={form[key]} onChange={set(key)} className="min-h-[64px]" {...props} />
        : <Input id={`pitch-${key}`} dir="auto" value={form[key]} onChange={set(key)} {...props} />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="ops max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campaign pitch</DialogTitle>
          <DialogDescription>
            What this campaign's calls are about. The agent says the reason after the lead agrees to talk and uses the
            rest one point at a time. No prices: they still come only from tools.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Objective</label>
            <Select value={form.objective || 'none'} onValueChange={(v) => set('objective')(v === 'none' ? '' : v)}>
              <SelectTrigger aria-label="Objective"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.objective === 'custom' && field('Describe the objective', 'objective_text', { maxLength: 200 })}
          {field('Why we are calling (one spoken sentence)', 'call_reason', { maxLength: 300,
            placeholder: "e.g. I'm calling about your enquiry for 3BHK flats in Solan." })}
          <div className="grid grid-cols-2 gap-3">
            {field('What we offer', 'offering_name', { maxLength: 200, placeholder: 'e.g. Nexon EV' })}
            {field('In one line', 'offering_one_liner', { maxLength: 300 })}
          </div>
          {field('Who it is for', 'audience', { maxLength: 300 })}
          {field('Benefits (one per line, up to 5)', 'benefits', { rows: 3 })}
          {field('Proof points (one per line, up to 5)', 'proof_points', { rows: 2 })}
          {field('Current offer', 'offer_text', { maxLength: 300, placeholder: 'e.g. Free first service this month' })}
          {field('Questions to ask before pitching (one per line, up to 3)', 'discovery_questions', { rows: 2 })}
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Project (optional, for property launches)</summary>
            <div className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                {field('Project name', 'project_name', { maxLength: 200 })}
                {field('Location', 'project_location', { maxLength: 200 })}
              </div>
              {field('In one line', 'project_one_liner', { maxLength: 300 })}
              {field('Facts the agent may share (one per line, up to 5)', 'project_highlights', { rows: 2 })}
              {field('Possession', 'project_possession', { maxLength: 200 })}
            </div>
          </details>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Objections and approved answers</label>
            {form.objections.map((o, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="grid grid-cols-[1fr,2fr,auto] gap-2">
                <Input dir="auto" value={o.objection} maxLength={200} aria-label={`Objection ${i + 1}`}
                  onChange={(e) => setObjection(i, 'objection', e.target.value)} placeholder="e.g. Too expensive" />
                <Input dir="auto" value={o.response} maxLength={500} aria-label={`Answer ${i + 1}`}
                  onChange={(e) => setObjection(i, 'response', e.target.value)} placeholder="The approved answer" />
                <Button variant="ghost" size="icon" aria-label={`Remove objection ${i + 1}`}
                  onClick={() => setForm((prev) => ({ ...prev, objections: prev.objections.filter((_, n) => n !== i) }))}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {form.objections.length < LIMITS.objections && (
              <Button variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, objections: [...prev.objections, { objection: '', response: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add objection
              </Button>
            )}
          </div>
          {field('Next step to offer', 'cta', { maxLength: 200, placeholder: 'e.g. book a 30-minute test drive' })}
          {needsReason && (
            <div className="space-y-1.5">
              <label htmlFor="pitch-reason" className="text-xs font-medium text-muted-foreground">Why change the pitch now? *</label>
              <Textarea id="pitch-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)}
                aria-required="true" className="min-h-[56px]" placeholder="Kept in the campaign's history" />
              <p className="text-[11px] text-muted-foreground">Applies to calls placed from now on.</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          {campaign?.pitch && (
            <Button variant="ghost" onClick={() => submit(null)} disabled={saving}>Clear pitch</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => submit(pitchFrom(form, campaign?.pitch))} disabled={saving}>Save pitch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The campaign's pitch on its Overview tab, with the objective/goal note and the editor. */
export default function CampaignPitchCard({ campaign, user, onSaved }) {
  const [open, setOpen] = useState(false);
  const { canEdit, needsReason, note } = pitchEditState(campaign, user);
  const pitch = campaign?.pitch;
  const rows = pitch ? [
    ['Objective', objectiveLabel(pitch)],
    ['Why we call', pitch.call_reason],
    ['Offering', [pitch.offering_name, pitch.offering_one_liner].filter(Boolean).join(': ')],
    ['Project', pitch.project && [pitch.project.name, pitch.project.location].filter(Boolean).join(', ')],
    ['Next step', pitch.cta],
    ['Also covers', [pitch.benefits?.length && `${pitch.benefits.length} benefit${pitch.benefits.length === 1 ? '' : 's'}`,
      pitch.objections?.length && `${pitch.objections.length} objection${pitch.objections.length === 1 ? '' : 's'}`,
      pitch.discovery_questions?.length && `${pitch.discovery_questions.length} question${pitch.discovery_questions.length === 1 ? '' : 's'}`]
      .filter(Boolean).join(', ')],
  ].filter(([, value]) => value) : [];

  return (
    <section className="ops-card space-y-3 p-4 lg:col-span-3" aria-labelledby="campaign-pitch">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="campaign-pitch" className="text-sm font-semibold">Pitch</h2>
        {canEdit && <OpsButton size="sm" variant="outline" onClick={() => setOpen(true)}>{pitch ? 'Edit pitch' : 'Add pitch'}</OpsButton>}
      </div>
      {(campaign?.pitch_warnings || []).map((w) => (
        <p key={w} role="status" className="ops-tone ops-tone-warn rounded-lg px-3 py-2 text-sm">{w}</p>
      ))}
      {rows.length ? (
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No pitch: calls use the assistant's own default reason for calling.</p>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {canEdit && needsReason && <p className="text-xs text-muted-foreground">Changing it while the campaign runs needs a reason.</p>}
      {canEdit && <PitchDialog campaign={campaign} open={open} onOpenChange={setOpen} needsReason={needsReason} onSaved={onSaved} />}
    </section>
  );
}
