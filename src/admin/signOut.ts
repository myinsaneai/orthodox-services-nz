// src/admin/signOut.ts
// Sign-out for the public header. The header loads this file only when
// "Log out" is clicked (dynamic import), so firebase/auth stays out of the
// public bundle.

import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';
import { setRoleHint } from '../lib/authHint';

export async function adminSignOut(): Promise<void> {
  await signOut(auth);
  setRoleHint(null);
}
