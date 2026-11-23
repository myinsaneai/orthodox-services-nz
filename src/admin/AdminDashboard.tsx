// src/admin/AdminDashboard.tsx
// "My page" start page. Parish / schedule editors and requests arrive later;
// each new section also gets a line in the second menu row (SiteLayout).

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABEL, isAtLeast } from '../lib/roles';

export default function AdminDashboard() {
  const { user, role, allowedParishes } = useAuth();

  return (
    <>
      <div className="hero">
        <h1>My page</h1>
        <div className="hero-sub">
          Signed in as {user?.email} ({role ? ROLE_LABEL[role] : ''}
          {role === 'coordinator' && Array.isArray(allowedParishes) ? `, ${allowedParishes.length} parish(es)` : ''})
        </div>
      </div>
      <div className="page page--text">
        {isAtLeast(role, 'admin') && (
          <p><Link to="/admin/users">Users</Link> — give people their roles.</p>
        )}
        <p className="um-muted">Schedule editing, requests and favourite parishes are coming soon.</p>
      </div>
    </>
  );
}
