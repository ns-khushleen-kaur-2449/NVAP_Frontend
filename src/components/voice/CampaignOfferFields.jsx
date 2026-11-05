import { AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import useOfferPreview from '@/hooks/useOfferPreview';
import {
  OFFER_HELPER, OFFER_SCOPE_NOTE, OFFER_TOGGLE_LABEL, formatOfferDate, previewBody,
} from '@/lib/campaignOffer';

/**
 * The campaign's offer: "Tell leads about this campaign", the offer name, the offer details and the last valid
 * day, with a live preview of what the agent will tell leads. One component for the launch dialog and the pitch
 * editor, over one value ({ announce, offering_name, offer_text, valid_until }; lib/campaignOffer.js).
 *
 * Turning the toggle off hides the preview and keeps the values. ``readOnly`` shows the values without inputs.
 */
export default function CampaignOfferFields({
  value, onChange, assistantId, campaignId, name, timeZone, readOnly = false, idPrefix = 'offer',
}) {
  const set = (key) => (next) => onChange({ ...value, [key]: next });
  const enabled = Boolean(value.announce) && !readOnly;
  const { preview, loading, error } = useOfferPreview(
    previewBody({ offer: value, assistantId, campaignId, name, timeZone }), enabled && Boolean(assistantId || campaignId));
  const id = (key) => `${idPrefix}-${key}`;

  if (readOnly) {
    return (
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm" aria-label="Campaign offer">
        <dt className="text-muted-foreground">{OFFER_TOGGLE_LABEL}</dt><dd>{value.announce ? 'On' : 'Off'}</dd>
        <dt className="text-muted-foreground">Offer name</dt><dd dir="auto">{value.offering_name || '—'}</dd>
        <dt className="text-muted-foreground">Offer details</dt><dd dir="auto">{value.offer_text || '—'}</dd>
        <dt className="text-muted-foreground">Offer valid until</dt><dd>{formatOfferDate(value.valid_until) || 'No end date'}</dd>
      </dl>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Switch id={id('announce')} checked={Boolean(value.announce)} onCheckedChange={set('announce')}
          aria-describedby={`${id('announce')}-help`} />
        <div className="min-w-0">
          <label htmlFor={id('announce')} className="text-sm font-medium">{OFFER_TOGGLE_LABEL}</label>
          <p id={`${id('announce')}-help`} className="text-xs text-muted-foreground">{OFFER_HELPER}</p>
          <p className="text-xs text-muted-foreground mt-1">{OFFER_SCOPE_NOTE}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={id('name')} className="text-xs font-medium text-muted-foreground">Offer name</label>
          <Input id={id('name')} dir="auto" maxLength={200} value={value.offering_name}
            onChange={(e) => set('offering_name')(e.target.value)} placeholder="What the agent names, e.g. the product" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id('until')} className="text-xs font-medium text-muted-foreground">Offer valid until</label>
          <Input id={id('until')} type="date" value={value.valid_until} onChange={(e) => set('valid_until')(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('details')} className="text-xs font-medium text-muted-foreground">Offer details</label>
        <Input id={id('details')} dir="auto" maxLength={300} value={value.offer_text}
          onChange={(e) => set('offer_text')(e.target.value)} placeholder="The terms, exactly as leads should hear them" />
        <p className="text-[11px] text-muted-foreground">The only pitch field that may include amounts. Product prices still come from the catalog.</p>
      </div>

      {enabled && (
        <section aria-labelledby={id('preview')} aria-live="polite" aria-busy={loading}
          className="rounded-lg border border-border p-3 space-y-2">
          <h5 id={id('preview')} className="text-sm font-semibold flex items-center gap-2">
            What the agent will tell leads
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
          </h5>
          {!assistantId && !campaignId ? (
            <p className="text-sm text-muted-foreground">Choose an assistant to see the preview.</p>
          ) : error ? (
            <p role="alert" className="text-sm text-[#b42318]">{error}</p>
          ) : preview ? (
            <OfferPreview preview={preview} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading the preview…</p>
          )}
        </section>
      )}
    </div>
  );
}

function OfferPreview({ preview }) {
  const missing = preview.missing || [];
  return (
    <div className="space-y-2 text-sm" dir={preview.direction || 'ltr'} aria-label="Offer preview" role="group">
      {preview.assistant_warning && (
        <p role="alert" className="ops-tone ops-tone-warn flex items-start gap-2 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{preview.assistant_warning}</span>
        </p>
      )}
      {preview.expired && (
        <p role="alert" className="ops-tone ops-tone-warn rounded-lg px-3 py-2">
          This offer's last valid day has passed, so the agent won't mention it.
        </p>
      )}
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Offer name</dt><dd dir="auto">{preview.offer_name || '—'}</dd>
        <dt className="text-muted-foreground">Offer details</dt><dd dir="auto">{preview.offer || '—'}</dd>
        <dt className="text-muted-foreground">Last valid day</dt><dd dir="auto">{preview.valid_until_spoken || 'No end date'}</dd>
      </dl>
      {preview.sample_line && (
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample wording</p>
          <p dir="auto" className="italic">“{preview.sample_line}”</p>
          <p className="text-[11px] text-muted-foreground">The agent says it in its own words, in the language of the call.</p>
        </div>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-label="Missing">
          Still needed: {missing.map((m) => m.label).join(', ')}.
        </p>
      )}
    </div>
  );
}

/** A pre-flight refusal with every problem listed (lib/campaignOffer.preflightProblems). */
export function PreflightProblems({ problems }) {
  if (!problems) return null;
  return (
    <div role="alert" className="ops-tone ops-tone-warn space-y-1 rounded-lg px-3 py-2 text-sm">
      <p className="font-medium">{problems.title}</p>
      <ul className="list-disc ps-5">
        {problems.problems.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </div>
  );
}
