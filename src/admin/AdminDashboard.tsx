// src/admin/AdminDashboard.tsx
// Placeholder dashboard. Parish / schedule / user editors arrive in the
// admin back-end phase.

import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseAdmin';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
  const { user, role, allowedParishes } = useAuth();

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', marginTop: 0 }}>
        Admin dashboard
      </h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Signed in as {user?.email} ({role}
        {role === 'parish-admin' && Array.isArray(allowedParishes) ? `, ${allowedParishes.length} parish(es)` : ''}).
      </p>
      <p style={{ color: 'var(--color-muted)' }}>Parish, schedule and user management coming soon.</p>
      <p>
        <Link to="/">← Public site</Link>{' · '}
        <button type="button" onClick={() => signOut(auth)} style={{
          background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0,
        }}>Sign out</button>
      </p>
    </div>
  );
}
