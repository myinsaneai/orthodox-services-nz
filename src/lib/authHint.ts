// src/lib/authHint.ts
// The signed-in person's role, kept as a hint so the public header can show
// "Log out" and (for admins) "My page" without loading firebase/auth for every
// visitor. The admin area (AuthContext) writes it; it is only for display,
// never a permission: the real checks are Firebase Auth and the Firestore rules.

import { isRole } from './roles';
import type { RoleName } from './roles';

const KEY = 'gp_role';
const OLD_KEY = 'gp_admin';          // the first version stored just "1"
const EVENT = 'gp-role-hint';

export function getRoleHint(): RoleName | null {
  try {
    const v = localStorage.getItem(KEY);
    return isRole(v) ? v : null;
  } catch { return null; }
}

export function setRoleHint(role: RoleName | null): void {
  try {
    if (role) localStorage.setItem(KEY, role); else localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch { /* storage blocked: the header simply shows "Log in" */ }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeRoleHint(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
