// src/App.tsx

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LangProvider } from './contexts/LangContext';
import SiteLayout from './components/SiteLayout';
import SchedulePage from './pages/SchedulePage';
import ParishesPage from './pages/ParishesPage';
import AboutPage from './pages/AboutPage';

// Whole admin area is one lazy chunk — public visitors never download
// firebase/auth or any admin screen.
const AdminApp = lazy(() => import('./admin/AdminApp'));

const adminLoadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>Loading…</div>
);

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public site ── */}
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<SiteLayout><SchedulePage /></SiteLayout>} />
          <Route path="/parishes" element={<SiteLayout><ParishesPage /></SiteLayout>} />
          <Route path="/about"    element={<SiteLayout><AboutPage /></SiteLayout>} />

          {/* ── Admin ── */}
          <Route path="/admin/*" element={
            <Suspense fallback={adminLoadingFallback}><AdminApp /></Suspense>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}
