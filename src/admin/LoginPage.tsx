// src/admin/LoginPage.tsx

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user && role) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Sign-in failed. Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '9px 10px', marginBottom: 12, fontSize: 14,
    border: '1px solid var(--color-card-border)', borderRadius: 4,
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', marginTop: 0 }}>
        Admin sign in
      </h1>
      <form onSubmit={submit}>
        <input style={input} type="email" placeholder="Email" value={email}
               onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        <input style={input} type="password" placeholder="Password" value={password}
               onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p style={{ color: '#a00', fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: 10, border: 'none', borderRadius: 4, cursor: 'pointer',
          background: 'var(--color-primary)', color: 'var(--color-cream)', fontSize: 14,
        }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
