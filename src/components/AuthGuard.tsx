// src/components/AuthGuard.tsx
// My page gate. A guest, or a person whose profile did not load, is sent to the sign-in
// page. Everybody else needs at least `minRole` (default: any signed-in role).

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAtLeast, ROLE_LABEL } from '../lib/roles';
import type { RoleName } from '../lib/roles';

interface AuthGuardProps {
  children: React.ReactNode;
  minRole?: RoleName;          // default: user, i.e. any signed-in person
}

const box: React.CSSProperties = { padding: 40, textAlign: 'center', fontFamily: 'sans-serif' };

export default function AuthGuard({ children, minRole = 'user' }: AuthGuardProps) {
  const { user, role, loading } = useAuth();

  if (loading) return <div style={box}>Loading…</div>;
  if (!user || !role) return <Navigate to="/admin/login" replace />;

  if (!isAtLeast(role, minRole)) {
    return (
      <div style={box}>
        <h2>Access denied</h2>
        <p>This page requires the {ROLE_LABEL[minRole]} role.</p>
      </div>
    );
  }
  return <>{children}</>;
}
