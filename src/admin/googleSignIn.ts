// src/admin/googleSignIn.ts
// Google sign-in through Google Identity Services (GIS), handed to Firebase
// with signInWithCredential. Same approach as the fishing-league project.
//
// Why not Firebase's own popup: it finishes on https://<authDomain>/__/auth/handler
// and needs a Firebase helper iframe. On Android an installed copy of the site
// can capture that address (white page / "missing initial state"), and Chrome's
// ad filter can block the helper iframe on a flagged domain. With GIS the popup
// lives on accounts.google.com and answers the page with a message, so nothing
// has to come back to our own address.
//
// VITE_GOOGLE_CLIENT_ID is public (not a secret): the project's "Web client
// (auto created by Google Service)" in Google Cloud → APIs & Services →
// Credentials. Its "Authorized JavaScript origins" must list every address the
// site is opened from. Without it, Firebase's popup is used instead.

import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';

const clientId = (): string => import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface GisWindow {
  google?: { accounts?: { oauth2?: { initTokenClient?: (cfg: {
    client_id: string; scope: string;
    callback: (r: TokenResponse) => void;
    error_callback: (e: { type?: string; message?: string }) => void;
  }) => { requestAccessToken: (o: { prompt: string }) => void } } } };
}
const gw = () => window as unknown as GisWindow;

export const gisReady = (): boolean =>
  typeof window !== 'undefined' && !!gw().google?.accounts?.oauth2?.initTokenClient;

/** Load Google's script ahead of time: the popup must open straight from the tap. */
export function preloadGis(): void {
  if (!clientId() || typeof document === 'undefined' || gisReady()) return;
  if (document.querySelector(`script[src="${SRC}"]`)) return;
  const s = document.createElement('script');
  s.src = SRC; s.async = true; s.defer = true;
  document.head.appendChild(s);
}

function requestGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const fail = (code: string, message: string) =>
      reject(Object.assign(new Error(message), { code }));
    const client = gw().google!.accounts!.oauth2!.initTokenClient!({
      client_id: clientId(),
      scope: 'openid email profile',
      callback: r => r?.access_token
        ? resolve(r.access_token)
        : fail('gis/' + (r?.error || 'no_token'), r?.error_description || 'Google did not return a sign-in token.'),
      error_callback: e => fail('gis/' + (e?.type || 'error'), e?.message || 'Google sign-in failed.'),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

/** Call directly from a click handler. GIS when ready, otherwise Firebase's popup. */
export function signInWithGoogle() {
  return clientId() && gisReady()
    ? requestGoogleAccessToken().then(t => signInWithCredential(auth, GoogleAuthProvider.credential(null, t)))
    : signInWithPopup(auth, new GoogleAuthProvider());
}

/** True when the person closed the window themselves: not an error worth showing. */
export function isGoogleCancel(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || '';
  return ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'gis/popup_closed', 'gis/popup_failed_to_open']
    .includes(code);
}

export function googleErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || '';
  if (code === 'auth/unauthorized-domain')
    return 'Google sign-in is not enabled for this web address yet. Please use email and password.';
  if (code === 'auth/operation-not-allowed')
    return 'Google sign-in is not turned on for this site yet. Please use email and password.';
  return 'Google sign-in failed. Try again, or use email and password.';
}
