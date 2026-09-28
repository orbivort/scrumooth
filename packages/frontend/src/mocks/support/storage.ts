/**
 * A tiny key/value store for mock state that has to survive a reload.
 *
 * Prefers `localStorage`, so the mock session behaves like the real httpOnly
 * cookie it stands in for — a reload keeps you signed in. Falls back to memory
 * when there is no DOM, so importing the mock layer in a non-browser context
 * cannot throw.
 *
 * Every key written here is prefixed with `scrumooth.mock.` so mock state is
 * obvious in devtools and can be cleared in one sweep.
 */

const PREFIX = 'scrumooth.mock.';

const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access can throw when storage is disabled by policy.
    return null;
  }
}

export function readKey(key: string): string | null {
  const prefixed = `${PREFIX}${key}`;
  const store = storage();
  return store ? store.getItem(prefixed) : (memory.get(prefixed) ?? null);
}

export function writeKey(key: string, value: string): void {
  const prefixed = `${PREFIX}${key}`;
  const store = storage();
  if (store) {
    store.setItem(prefixed, value);
    return;
  }
  memory.set(prefixed, value);
}

export function deleteKey(key: string): void {
  const prefixed = `${PREFIX}${key}`;
  const store = storage();
  if (store) {
    store.removeItem(prefixed);
    return;
  }
  memory.delete(prefixed);
}

/** Removes every key this module owns, which is what a full mock reset does. */
export function clearAllKeys(): void {
  const store = storage();
  if (store) {
    const owned: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX)) {
        owned.push(key);
      }
    }
    owned.forEach((key) => store.removeItem(key));
  }
  memory.clear();
}
