// src/components/AuthGuard.tsx
// Admin-area gate. A guest, or a plain "user" (who has no admin area), is sent to
// the sign-in page, which explains. Everybody else needs at least `minRole`.

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAtLeast, ROLE_LABEL } from '../lib/roles';
import type { RoleName } from '../lib/roles';

interface AuthGuardProps {
  children: React.ReactNode;
  minRole?: RoleName;          // default: coordinator, the lowest role with an admin area
}

const box: React.CSSProperties = { padding: 40, textAlign: 'center', fontFamily: 'sans-serif' };

export default function AuthGuard({ children, minRole = 'coordinator' }: AuthGuardProps) {
  const { user, role, loading } = useAuth();

  if (loading) return <div style={box}>Loading…</div>;
  if (!user || !isAtLeast(role, 'coordinator')) return <Navigate to="/admin/login" replace />;

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
