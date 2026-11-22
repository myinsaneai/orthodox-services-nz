// src/admin/AdminApp.tsx
// The entire admin area behind one lazy-loaded component (see App.tsx), so
// firebase/auth and firebase/storage never ship to public visitors.
// Mounted at "/admin/*"; paths below are relative to that prefix.

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import AuthGuard from '../components/AuthGuard';

const LoginPage      = lazy(() => import('./LoginPage'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

const loadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>Loading…</div>
);

export default function AdminApp() {
  return (
    <AuthProvider>
      <Suspense fallback={loadingFallback}>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route index element={<AuthGuard><AdminDashboard /></AuthGuard>} />
          {/* Future: parishes, services, groups (parish-scoped);
              users, settings (<AuthGuard requireSuperAdmin>) */}
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
