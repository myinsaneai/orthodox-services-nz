// src/admin/AdminApp.tsx
// The entire "My page" area behind one lazy-loaded component (see App.tsx),
// so firebase/auth and firebase/firestore writes never ship to public visitors.
// Mounted at "/admin/*"; paths below are relative to that prefix.

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import AuthGuard from '../components/AuthGuard';
import SiteLayout from '../components/SiteLayout';

const LoginPage      = lazy(() => import('./LoginPage'));
const RegisterPage   = lazy(() => import('./RegisterPage'));
const ProfilePage    = lazy(() => import('./ProfilePage'));
const ParishesAdminPage = lazy(() => import('./ParishesAdminPage'));
const UsersPage      = lazy(() => import('./UsersPage'));
const ScheduleEditorPage = lazy(() => import('./ScheduleEditorPage'));
const TemplatesPage  = lazy(() => import('./TemplatesPage'));

const loadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>Loading…</div>
);

export default function AdminApp() {
  return (
    <AuthProvider>
      <Suspense fallback={loadingFallback}>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={
            <AuthGuard><SiteLayout><ProfilePage /></SiteLayout></AuthGuard>
          } />
          {/* Parishes are added and edited from the public Parishes page (admins see the buttons there). */}
          <Route path="parishes" element={<Navigate to="/parishes" replace />} />
          <Route path="parishes/new" element={
            <AuthGuard minRole="admin"><SiteLayout><ParishesAdminPage /></SiteLayout></AuthGuard>
          } />
          <Route path="parishes/:id" element={
            <AuthGuard minRole="admin"><SiteLayout><ParishesAdminPage /></SiteLayout></AuthGuard>
          } />
          <Route path="users" element={
            <AuthGuard minRole="admin"><SiteLayout><UsersPage /></SiteLayout></AuthGuard>
          } />
          {/* Schedule: coordinators (own parishes) and up; templates and quick entries: admins. */}
          <Route path="schedule" element={
            <AuthGuard minRole="coordinator"><SiteLayout><ScheduleEditorPage /></SiteLayout></AuthGuard>
          } />
          <Route path="templates" element={
            <AuthGuard minRole="admin"><SiteLayout><TemplatesPage /></SiteLayout></AuthGuard>
          } />
          {/* Future My page sections: groups, requests */}
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
