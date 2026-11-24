// src/admin/LoginPage.tsx
// User login: Google or email + password. An email with no matching account goes on to
// the registration screen (RegisterPage).
// Anyone can complete a Google sign-in; they
// get a plain "user" profile (so an admin can then find them on the Users page and
// give them a role). After signing in everybody goes to the first page; the notice
// below appears only when the profile could not be loaded. The Firestore rules
// enforce the real limits.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, preloadGis, isGoogleCancel, googleErrorMessage } from './googleSignIn';
import { embeddedBrowser } from './embeddedBrowser';
import { checkEmailExists, isRateLimited } from './emailCheck';
import type { EmailAnswer } from './emailCheck';

const input: React.CSSProperties = {
  width: '100%', padding: '9px 10px', marginBottom: 12, fontSize: 14,
  border: '1px solid var(--color-card-border)', borderRadius: 4,
};
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 10, border: 'none', borderRadius: 4, cursor: 'pointer',
  background: 'var(--color-primary)', color: 'var(--color-cream)', fontSize: 14,
};
const googleBtn: React.CSSProperties = {
  width: '100%', padding: 10, borderRadius: 4, cursor: 'pointer', fontSize: 14,
  background: '#fff', color: 'var(--color-text)', border: '1px solid var(--color-card-border)',
};
const note: React.CSSProperties = { fontSize: 13, color: 'var(--color-muted)' };

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const kind = embeddedBrowser(typeof navigator === 'undefined' ? '' : navigator.userAgent);

  // Fetch Google's script now, so the Google window can open straight from the tap.
  useEffect(() => { preloadGis(); }, []);

  // Signed in: go to the first page (not to My page; the header's "My page" is one click away).
  if (!loading && user && role) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    // 1. Is this email known? (the server answers yes/no for this one email only)
    let known: EmailAnswer | null = null;
    try {
      known = await checkEmailExists(email);
    } catch (err) {
      if (isRateLimited(err)) {
        setError('Too many attempts. Please wait a few minutes and try again.');
        setBusy(false);
        return;
      }
      // Check unavailable: carry on without it (handled below).
    }
    if (known && !known.exists) {                    // new person: registration
      setBusy(false);
      navigate('/admin/register', { state: { email, password } });
      return;
    }
    if (known && known.providers.length > 0 && !known.providers.includes('password')) {
      setError('This email signs in with Google. Please use the "Continue with Google" button.');
      setBusy(false);
      return;
    }
    // 2. Known person: sign in, and say plainly when the password is wrong.
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password'].includes(code)) {
        if (known) { setError('Incorrect password. Please try again.'); }
        else {
          // The check was unavailable, so "no account" and "wrong password" look the same:
          // offer registration (which links back here if the account exists).
          navigate('/admin/register', { state: { email, password } });
          return;
        }
      } else {
        setError(code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Sign-in failed. Check your email and password.');
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!isGoogleCancel(err)) setError(googleErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', marginTop: 0 }}>
        User login
      </h1>
      {children}
    </div>
  );

  // Signed in, but the profile could not be loaded: explain instead of showing the form again.
  if (!loading && user) {
    return shell(
      <>
        <p>
          You are signed in as <strong>{user.email}</strong>, but we could not load your
          account. Please try again in a moment.
        </p>
        <p><Link to="/">Go to the site</Link></p>
        <button type="button" style={googleBtn} onClick={() => signOut(auth)}>Sign out</button>
      </>,
    );
  }

  return shell(
    <>
      <button type="button" style={googleBtn} disabled={busy || kind === 'blocked'} onClick={google}>
        Continue with Google
      </button>
      {kind === 'blocked' && (
        <p style={note}>
          Google sign-in does not work inside Messenger or Facebook. Use email and password, or open
          this page in Safari or Chrome (menu → Open in browser).
        </p>
      )}
      {kind === 'maybe' && (
        <p style={note}>
          This looks like the built-in browser of another app. If Google sign-in does not work here,
          open this page in Chrome or Safari (menu → Open in browser), or use email and password.
        </p>
      )}
      <p style={{ ...note, textAlign: 'center', margin: '14px 0' }}>or</p>
      <form onSubmit={submit}>
        <input style={input} type="email" placeholder="Email" value={email}
               onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        <input style={input} type="password" placeholder="Password" value={password}
               onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        <button type="submit" disabled={busy} style={primaryBtn}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error && <p role="alert" style={{ color: '#a00', fontSize: 13 }}>{error}</p>}
      <p style={{ ...note, textAlign: 'center' }}>
        New here? <Link to="/admin/register" state={{ email, password }}>Create an account</Link>
      </p>
    </>,
  );
}
