/**
 * Deterministic, UUID-shaped identifiers for the mock backend.
 *
 * Ids must be UUID-shaped: `pages/Team/Team.tsx` rejects a team id that does not
 * match the UUID pattern, and `pages/SprintReview/SprintReview.tsx` drops
 * non-UUID adjustment ids on update. They are derived from a seed string rather
 * than copied from the backend seed corpus, so the demo cannot leak or imply the
 * real dataset, and so the same entity gets the same id on every reload.
 */

/** FNV-1a, salted, so one seed can produce four independent 32-bit words. */
function hash32(input: string, salt: number): number {
  let hash = 0x811c9dc5 ^ salt;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Builds a stable UUID-shaped id from a kind and a key.
 *
 * @param kind - The entity family, e.g. `'team'` or `'pbi'`. Keeps ids from
 *   colliding across families that happen to share a key.
 * @param key - A human-readable key, e.g. `'cindra'` or `'kade-orvane'`.
 */
export function fixtureId(kind: string, key: string): string {
  const seed = `${kind}:${key}`;
  const hex = [0, 1, 2, 3]
    .map((salt) =>
      hash32(seed, salt * 0x9e3779b9)
        .toString(16)
        .padStart(8, '0')
    )
    .join('');

  // Force the version (4) and variant (10xx) nibbles so the value reads as a
  // random UUID rather than an arbitrary hex string.
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13, 16)}`;
  const variantNibble = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const variant = `${variantNibble}${hex.slice(17)}`;

  return [
    versioned.slice(0, 8),
    versioned.slice(8, 12),
    versioned.slice(12, 16),
    variant.slice(0, 4),
    variant.slice(4, 16),
  ].join('-');
}
