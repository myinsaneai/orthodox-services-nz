// functions/src/checkEmailLogic.ts
// The decision part of checkEmail, with no Firebase imports so it can be tested
// (tests/check-email.test.ts). index.ts supplies the real Firebase pieces.

export const WINDOW_MS = 10 * 60 * 1000;     // how long a caller's count lasts
export const MAX_CHECKS = 20;                // checks allowed per caller per window

export interface EmailAnswer { exists: boolean; providers: string[] }

export interface Deps {
  /** The Firebase Auth account for this email, or null when there is none. */
  lookup(email: string): Promise<{ providers: string[] } | null>;
  /** Count one more check for this caller; returns the new count within the window. */
  count(callerKey: string, now: number): Promise<number>;
}

export class CheckError extends Error {
  constructor(public code: 'invalid-argument' | 'resource-exhausted', message: string) { super(message); }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

export function cleanEmail(raw: unknown): string {
  const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!e || e.length > 320 || !EMAIL.test(e)) throw new CheckError('invalid-argument', 'Enter a valid email address.');
  return e;
}

/** Only these provider names ever leave the server. */
export function publicProviders(ids: string[]): string[] {
  const out: string[] = [];
  if (ids.includes('google.com')) out.push('google');
  if (ids.includes('password')) out.push('password');
  return out;
}

export async function checkEmail(raw: unknown, callerKey: string, deps: Deps, now = Date.now()): Promise<EmailAnswer> {
  const email = cleanEmail(raw);
  if ((await deps.count(callerKey, now)) > MAX_CHECKS)
    throw new CheckError('resource-exhausted', 'Too many attempts. Please wait a few minutes and try again.');
  const found = await deps.lookup(email);
  return found ? { exists: true, providers: publicProviders(found.providers) } : { exists: false, providers: [] };
}
