// src/admin/RegisterPage.tsx
// New person with an email + password: reached from the login form when no account
// matched. The email and password typed there arrive pre-filled (kept in memory in the
// router state, never in the address). The person confirms the password, enters their
// name, and is signed in as soon as the account exists. Everyone starts as a plain "user".

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';
import { useAuth } from '../contexts/AuthContext';
import { setPendingName } from './pendingName';

const NAME_MAX = 60;
const PASSWORD_MIN = 6;                       // Firebase's own minimum

const input: React.CSSProperties = {
  width: '100%', padding: '9px 10px', marginBottom: 12, fontSize: 14,
  border: '1px solid var(--color-card-border)', borderRadius: 4,
};
const label: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 4 };
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 10, border: 'none', borderRadius: 4, cursor: 'pointer',
  background: 'var(--color-primary)', color: 'var(--color-cream)', fontSize: 14,
};
const note: React.CSSProperties = { fontSize: 13, color: 'var(--color-muted)' };

export function registerErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email already has an account, so the password you typed on the login page was probably wrong. Please go back and try again.';
    case 'auth/invalid-email': return 'That email address does not look right.';
    case 'auth/weak-password': return `Please choose a password of at least ${PASSWORD_MIN} characters.`;
    case 'auth/operation-not-allowed': return 'Registration with email is not turned on for this site yet.';
    case 'auth/network-request-failed': return 'No connection. Check your internet and try again.';
    default: return 'We could not create the account. Please try again.';
  }
}

export default function RegisterPage() {
  const { user, role, loading } = useAuth();
  const start = (useLocation().state ?? {}) as { email?: string; password?: string };
  const [email, setEmail] = useState(start.email ?? '');
  const [password, setPassword] = useState(start.password ?? '');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Account made and profile loaded: on to the first page.
  if (!loading && user && role) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) { setError('Please enter your name.'); return; }
    if (password.length < PASSWORD_MIN) { setError(registerErrorMessage('auth/weak-password')); return; }
    if (password !== confirm) { setError('The two passwords are not the same.'); return; }
    setBusy(true); setError('');
    setPendingName(clean);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try { await updateProfile(cred.user, { displayName: clean }); } catch { /* the profile already has the name */ }
    } catch (err) {
      setPendingName('');
      setError(registerErrorMessage((err as { code?: string })?.code ?? ''));
      setBusy(false);
    }
    // On success the page leaves by itself once the profile is loaded (see above).
  };

  const signedInNoProfile = !loading && !!user;

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', marginTop: 0 }}>
        Create your account
      </h1>
      <p style={note}>
        We did not find an account for this email, so let us set one up. If you already have an account,
        your password was probably mistyped: <Link to="/admin/login">go back to the login</Link>.
      </p>
      {signedInNoProfile ? (
        <p role="status">Setting up your account…</p>
      ) : (
        <form onSubmit={submit}>
          <label style={label} htmlFor="reg-email">Email</label>
          <input id="reg-email" style={input} type="email" value={email} autoComplete="username"
                 onChange={e => setEmail(e.target.value)} required />
          <label style={label} htmlFor="reg-pass">Password</label>
          <input id="reg-pass" style={input} type="password" value={password} autoComplete="new-password"
                 onChange={e => setPassword(e.target.value)} required />
          <label style={label} htmlFor="reg-confirm">Confirm password</label>
          <input id="reg-confirm" style={input} type="password" value={confirm} autoComplete="new-password"
                 onChange={e => setConfirm(e.target.value)} required />
          <label style={label} htmlFor="reg-name">Your name</label>
          <input id="reg-name" style={input} type="text" value={name} maxLength={NAME_MAX} autoComplete="name"
                 onChange={e => setName(e.target.value)} required />
          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}
      {error && <p role="alert" style={{ color: '#a00', fontSize: 13 }}>{error}</p>}
    </div>
  );
}
