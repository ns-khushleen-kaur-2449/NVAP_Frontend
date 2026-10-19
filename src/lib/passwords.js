/**
 * A temporary password that meets the backend policy (8+ characters with lowercase, uppercase,
 * digit and symbol).  The user must replace it at first login.
 */
const SETS = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_'];

const pick = (chars, random) => chars[random % chars.length];

export function generateTemporaryPassword(length = 14) {
  const values = new Uint32Array(length + SETS.length);
  window.crypto.getRandomValues(values);
  const all = SETS.join('');
  const chars = SETS.map((set, i) => pick(set, values[i]));
  for (let i = SETS.length; i < length; i += 1) chars.push(pick(all, values[i]));
  // Shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = values[length + (i % SETS.length)] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
