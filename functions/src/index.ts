// functions/src/index.ts
// checkEmail: tells the login form whether an email already has an account, so a new person
// goes to registration and an existing one gets a proper "wrong password" message. It answers
// yes/no and the sign-in methods for ONE exact email, never a list, and each caller (by network
// address) is limited to a few checks per 10 minutes. The user list itself stays private.

import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { checkEmail, CheckError, WINDOW_MS } from './checkEmailLogic.js';
import type { Deps } from './checkEmailLogic.js';
import { translate, TranslateError, WINDOW_MS as TRANSLATE_WINDOW_MS } from './translateLogic.js';
import type { Deps as TranslateDeps } from './translateLogic.js';

initializeApp();
const db = getFirestore();

// One counter per caller key in rateLimits/*: { start, n } inside a window.
async function countHit(key: string, now: number, windowMs: number): Promise<number> {
  const ref = db.collection('rateLimits').doc(key);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.data() as { start?: number; n?: number } | undefined;
    const fresh = !d || typeof d.start !== 'number' || now - d.start > windowMs;
    const n = fresh ? 1 : (d!.n ?? 0) + 1;
    tx.set(ref, { start: fresh ? now : d!.start, n });
    return n;
  });
}

const deps: Deps = {
  async lookup(email) {
    try {
      const u = await getAuth().getUserByEmail(email);
      return { providers: u.providerData.map(p => p.providerId) };
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/user-not-found') return null;
      throw err;
    }
  },
  count: (callerKey, now) => countHit(callerKey, now, WINDOW_MS),
};

export const checkEmailExists = onCall({ region: 'australia-southeast1', maxInstances: 5 }, async request => {
  const ip = request.rawRequest.ip || 'unknown';
  const callerKey = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  try {
    return await checkEmail((request.data as { email?: unknown } | undefined)?.email, callerKey, deps);
  } catch (err) {
    if (err instanceof CheckError) throw new HttpsError(err.code, err.message);
    throw new HttpsError('internal', 'Could not check the email. Please try again.');
  }
});

// ── translateServiceText ─────────────────────────────────────────────────────────────────────────
// English <-> Greek for the schedule editor, by Gemini. Coordinators, admins and superadmins only; each
// person is limited to a few dozen translations per 10 minutes. The key lives in Secret Manager
// (firebase functions:secrets:set GEMINI_API_KEY), never in the app.

const geminiApiKey = defineSecret('GEMINI_API_KEY');
// If Google retires this model, change the name here and deploy the functions again.
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_TIMEOUT_MS = 40_000;

async function callGemini(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiApiKey.value(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw new HttpsError('deadline-exceeded', 'The translation service took too long to answer.');
    console.error('Gemini network error:', err);
    throw new HttpsError('unavailable', 'Could not reach the translation service.');
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    console.error('Gemini API error:', resp.status, await resp.text());
    throw new HttpsError('internal', 'The translation service returned an error.');
  }
  const data = (await resp.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
}

const translateDeps: TranslateDeps = {
  async getRole(uid) {
    const profile = await db.doc(`users/${uid}`).get();
    if (profile.exists) { const r = (profile.data() as { role?: unknown }).role; return typeof r === 'string' ? r : null; }
    // Until the first superadmin has a profile, the old admins/{uid} record still counts (as in the rules).
    const legacy = await db.doc(`admins/${uid}`).get();
    return legacy.exists && (legacy.data() as { role?: unknown }).role === 'superadmin' ? 'superadmin' : null;
  },
  count: (key, now) => countHit(key, now, TRANSLATE_WINDOW_MS),
  callModel: callGemini,
};

export const translateServiceText = onCall(
  { region: 'australia-southeast1', secrets: [geminiApiKey], timeoutSeconds: 120, maxInstances: 5 },
  async request => {
    try {
      return await translate(request.data, request.auth?.uid, translateDeps);
    } catch (err) {
      if (err instanceof TranslateError) throw new HttpsError(err.code, err.message);
      if (err instanceof HttpsError) throw err;
      console.error('translateServiceText failed:', err);
      throw new HttpsError('internal', 'The translation failed. Please try again.');
    }
  },
);
