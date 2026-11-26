// src/admin/translate.ts
// Asks the translateServiceText Cloud Function (Gemini) to translate schedule text between English and
// Greek. The key stays on the server; coordinators and administrators only.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebaseAdmin';

export type TranslateFrom = 'en' | 'el';

export async function translateText(text: string, from: TranslateFrom): Promise<string> {
  const call = httpsCallable<{ text: string; from: TranslateFrom }, { text: string }>(
    functions, 'translateServiceText', { timeout: 130_000 },
  );
  const res = await call({ text, from });
  const out = res.data?.text;
  if (typeof out !== 'string' || !out.trim()) throw new Error('empty translation');
  return out;
}

/** What to tell the person when a translation fails. */
export function translateFailure(err: unknown): string {
  switch ((err as { code?: string } | null)?.code) {
    case 'functions/resource-exhausted': return 'Too many translations just now. Wait a few minutes and try again.';
    case 'functions/permission-denied': return 'Your role is not allowed to translate. Reload the page and try again.';
    case 'functions/unauthenticated': return 'Please sign in again to translate.';
    case 'functions/not-found': return 'Translation is not set up on the server yet (the function has not been deployed).';
    case 'functions/deadline-exceeded':
    case 'functions/unavailable': return 'The translation service is busy or unreachable. Try again in a moment.';
    case 'functions/invalid-argument': return (err as Error).message || 'This text cannot be translated.';
    default: return 'The translation failed. Please try again.';
  }
}
