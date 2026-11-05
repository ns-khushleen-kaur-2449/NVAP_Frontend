// Prospects sent from Prospecting to the Lead-to-Campaign Builder. Most of them are not leads
// yet, so the builder's lead list does not include them; this keeps them until they are
// launched or removed, across reloads and page changes in this browser tab.
//
// sessionStorage (this tab only, gone when it closes) because the rows hold names and phone
// numbers. Kept per signed-in user. Every read and write may fail (private mode, blocked
// storage); then the picks just last for this visit.

const KEY = 'smartsdr.builder.fromProspecting';

/** The picks saved for this user, or []. */
export function loadPicks(userId) {
  if (userId == null) return [];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) || 'null');
    return stored && stored.userId === userId && Array.isArray(stored.picks) ? stored.picks : [];
  } catch {
    return [];
  }
}

/** Save this user's picks; an empty list removes them. */
export function savePicks(userId, picks) {
  if (userId == null) return;
  try {
    if (picks?.length) window.sessionStorage.setItem(KEY, JSON.stringify({ userId, picks }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the picks last only for this visit.
  }
}

/** `current` plus the `incoming` prospects not already in it (incoming rows replace older copies). */
export function mergePicks(current = [], incoming = []) {
  const byId = new Map((current || []).map((pick) => [pick.id, pick]));
  (incoming || []).forEach((pick) => byId.set(pick.id, pick));
  return Array.from(byId.values());
}

/** `picks` without these ids. */
export const dropPicks = (picks = [], ids = []) => {
  const gone = new Set(ids);
  return (picks || []).filter((pick) => !gone.has(pick.id));
};
