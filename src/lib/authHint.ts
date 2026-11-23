// src/lib/authHint.ts
// A one-bit hint that an admin is signed in, so the public header can show
// "Log out" without loading firebase/auth for every visitor. The admin area
// (AuthContext) writes it; it is only a display hint, never a permission:
// the real checks are Firebase Auth and the Firestore rules.

const KEY = 'gp_admin';
const EVENT = 'gp-admin-hint';

export function getAdminHint(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setAdminHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the header simply shows "Log in" */ }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeAdminHint(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
