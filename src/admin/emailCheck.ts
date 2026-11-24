// src/admin/emailCheck.ts
// Asks the checkEmailExists Cloud Function whether an email already has an account.
// The user list stays private on the server; only yes/no and the sign-in methods for the
// one email come back.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebaseAdmin';

export interface EmailAnswer { exists: boolean; providers: string[] }

export async function checkEmailExists(email: string): Promise<EmailAnswer> {
  const call = httpsCallable<{ email: string }, EmailAnswer>(functions, 'checkEmailExists');
  const res = await call({ email });
  return { exists: res.data.exists === true, providers: Array.isArray(res.data.providers) ? res.data.providers : [] };
}

/** True when the server said "too many checks": show its message, do not guess. */
export const isRateLimited = (err: unknown): boolean =>
  (err as { code?: string } | null)?.code === 'functions/resource-exhausted';
