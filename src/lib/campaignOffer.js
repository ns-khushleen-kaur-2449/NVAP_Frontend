// "Tell leads about this campaign" (backend voice_campaigns/offer.py). The offer's facts are the pitch's
// offering_name and offer_text, plus the campaign's announce_to_leads and offer_valid_until: one source of truth,
// edited by the same <CampaignOfferFields> in the launch dialog and the pitch editor.

export const OFFER_TOGGLE_LABEL = 'Tell leads about this campaign';
export const OFFER_HELPER = 'The agent mentions it after the lead agrees to talk.';
export const OFFER_SCOPE_NOTE = "This controls the offer only. Other pitch fields, including the call reason, are still "
  + "used on calls, so don't put offer details there.";

/** The offer part of a campaign, for the form. */
export function offerFormFrom(campaign) {
  const pitch = campaign?.pitch || {};
  return {
    announce: Boolean(campaign?.announce_to_leads),
    offering_name: pitch.offering_name || '',
    offer_text: pitch.offer_text || '',
    valid_until: campaign?.offer_valid_until || '',
  };
}

const text = (value) => (value || '').trim() || null;

/** The pitch fields this offer form owns (merged into the rest of the pitch by the caller). */
export const offerPitchFields = (offer) => ({ offering_name: text(offer.offering_name), offer_text: text(offer.offer_text) });

/** The campaign fields this offer form owns. */
export const offerCampaignFields = (offer) => ({
  announce_to_leads: Boolean(offer.announce),
  offer_valid_until: offer.valid_until || null,
});

/** The preview request for the form's current values. */
export const previewBody = ({ offer, assistantId, campaignId, name, timeZone }) => ({
  ...(assistantId ? { assistant_id: assistantId } : {}),
  ...(campaignId ? { campaign_id: campaignId } : {}),
  ...(name ? { name } : {}),
  ...(timeZone ? { timezone: timeZone } : {}),
  announce_to_leads: true,
  offering_name: text(offer.offering_name),
  offer_text: text(offer.offer_text),
  offer_valid_until: offer.valid_until || null,
});

// Pitch fields as the API names them, for its errors (pitch.<field>).
const PITCH_FIELD_LABELS = {
  offering_name: 'Offer name', offering_one_liner: 'In one line', call_reason: 'Why we are calling', audience: 'Who it is for',
  objective_text: 'Objective', success_definition: 'Success', cta: 'Next step to offer', benefits: 'Benefits',
  proof_points: 'Proof points', discovery_questions: 'Questions to ask',
};

/**
 * A readable message for a refused save. A price in any pitch field except the offer details gets its own
 * explanation; a pre-flight 409 keeps every problem (one per line, see ``preflightProblems``).
 */
export function offerSaveError(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const loc = (first.loc || []).filter((part) => part !== 'body');
    const field = loc[loc.length - 1] === undefined ? '' : String(loc[loc.length - 1]);
    const key = /^\d+$/.test(field) ? String(loc[loc.length - 2]) : field;
    if (/price/i.test(first.msg || '')) {
      const label = PITCH_FIELD_LABELS[key] || key || 'That field';
      return `${label} can't include a price or amount. Put amounts only in Offer details.`;
    }
    return key ? `${PITCH_FIELD_LABELS[key] || key}: ${first.msg}` : first.msg;
  }
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

/** A pre-flight refusal (409 "Can't start this campaign:\n<problem>\n<problem>") as { title, problems }, or null. */
export function preflightProblems(error) {
  const detail = error?.response?.data?.detail;
  if (error?.response?.status !== 409 || typeof detail !== 'string' || !/^Can't \w+ this campaign:/.test(detail)) return null;
  const [title, ...rest] = detail.split('\n');
  const problems = rest.map((line) => line.trim()).filter(Boolean);
  return { title: title.replace(/:$/, '.'), problems: problems.length ? problems : [detail.replace(/^[^:]*:\s*/, '')] };
}

/** "31 Jan 2030" for an ISO date, in the viewer's locale; '' when unset or unreadable. */
export function formatOfferDate(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined,
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
