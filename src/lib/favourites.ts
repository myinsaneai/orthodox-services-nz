// src/lib/favourites.ts
// The parishes a visitor has starred, kept in this browser (localStorage) for everyone, signed in or not.
// Nothing is sent to the server, so favourites follow the device, not the account.

const KEY = 'gp_fav_parishes';
const EVENT = 'gp-favourites';
const MAX = 200;                       // far more than there will be parishes; stops a bad value growing

let rawSeen: string | null | undefined;
let idsSeen: readonly string[] = [];

/** The starred parish ids. The same array is returned while nothing changed (useSyncExternalStore needs that). */
export function getFavouriteIds(): readonly string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked: no favourites */ }
  if (raw === rawSeen) return idsSeen;
  rawSeen = raw;
  let ids: string[] = [];
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))].slice(0, MAX);
  } catch { /* damaged value: start again */ }
  idsSeen = ids;
  return idsSeen;
}

/** Stars (on = true) or un-stars a parish. Returns false when the browser would not store it. */
export function setFavourite(id: string, on: boolean): boolean {
  const now = getFavouriteIds();
  const next = on ? (now.includes(id) ? now : [...now, id]) : now.filter(x => x !== id);
  let stored = true;
  try {
    if (next.length === 0) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(next));
  } catch { stored = false; }
  window.dispatchEvent(new Event(EVENT));
  return stored;
}

export function subscribeFavourites(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) cb(); };   // another tab
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage); };
}
