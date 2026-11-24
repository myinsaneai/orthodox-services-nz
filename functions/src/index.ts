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
import { checkEmail, CheckError, WINDOW_MS } from './checkEmailLogic.js';
import type { Deps } from './checkEmailLogic.js';

initializeApp();
const db = getFirestore();

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
  async count(callerKey, now) {
    // rateLimits/* is touched only by this function (the Firestore rules deny everyone else).
    const ref = db.collection('rateLimits').doc(callerKey);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const d = snap.data() as { start?: number; n?: number } | undefined;
      const fresh = !d || typeof d.start !== 'number' || now - d.start > WINDOW_MS;
      const n = fresh ? 1 : (d!.n ?? 0) + 1;
      tx.set(ref, { start: fresh ? now : d!.start, n });
      return n;
    });
  },
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
