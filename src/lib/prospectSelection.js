// Prospects picked from AI Filtering results for a campaign. The selection is a Map of
// prospect_id -> { id, name, phone }, so it survives paging, sorting and filter changes
// and the summary can still name prospects that are no longer on screen.
// The backend re-checks every id when the campaign is created; this only guides the user.

// The campaign API's limit (MAX_CONTACTS in the backend's campaign request schema).
export const MAX_CAMPAIGN_CONTACTS = 5000;

const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15; // E.164

/** True when the prospect has a phone number that could be dialled (the backend validates it fully). */
export function hasCallablePhone(prospect) {
  const digits = String(prospect?.phone ?? '').replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/** Why a prospect cannot be selected for calling, or null when it can. */
export function unselectableReason(prospect) {
  return hasCallablePhone(prospect) ? null : 'No phone number to call';
}

const summary = (prospect) => ({
  id: prospect.prospect_id,
  name: prospect.full_name || [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || 'Unnamed prospect',
  phone: prospect.phone,
});

/**
 * Add `prospects` that can be called, up to the campaign limit.
 * Returns { selection, added, skipped, capped }: a new Map, and how many were added,
 * left out for having no phone, and left out because the limit was reached.
 */
export function addProspects(selection, prospects) {
  const next = new Map(selection);
  let added = 0;
  let skipped = 0;
  let capped = 0;
  for (const prospect of prospects) {
    if (next.has(prospect.prospect_id)) continue;
    if (unselectableReason(prospect)) { skipped += 1; continue; }
    if (next.size >= MAX_CAMPAIGN_CONTACTS) { capped += 1; continue; }
    next.set(prospect.prospect_id, summary(prospect));
    added += 1;
  }
  return { selection: next, added, skipped, capped };
}

/** A new Map without these prospect ids. */
export function removeIds(selection, ids) {
  const next = new Map(selection);
  ids.forEach((id) => next.delete(id));
  return next;
}

/** Select or unselect one prospect. Returns { selection, capped }. */
export function toggleProspect(selection, prospect) {
  if (selection.has(prospect.prospect_id)) return { selection: removeIds(selection, [prospect.prospect_id]), capped: false };
  const result = addProspects(selection, [prospect]);
  return { selection: result.selection, capped: result.capped > 0 };
}

/** The selected prospect ids, in the order they were picked. */
export const selectedIds = (selection) => Array.from(selection.keys());
