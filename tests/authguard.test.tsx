// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ auth: {} as any }));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => h.auth }));

import AuthGuard from '../src/components/AuthGuard';

const mount = (superOnly = false) => render(
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path="/admin" element={<AuthGuard requireSuperAdmin={superOnly}><p>secret</p></AuthGuard>} />
      <Route path="/admin/login" element={<p>login page</p>} />
    </Routes>
  </MemoryRouter>,
);
afterEach(cleanup);

describe('AuthGuard', () => {
  it('waits while the role is being looked up (no redirect yet)', () => {
    h.auth = { user: null, role: null, loading: true };
    mount();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('login page')).toBeNull();
  });
  it('sends a guest to the login page', () => {
    h.auth = { user: null, role: null, loading: false };
    mount();
    expect(screen.getByText('login page')).toBeTruthy();
  });
  it('sends a signed-in person who is not an admin to the login page', () => {
    h.auth = { user: { uid: 'u' }, role: null, loading: false };
    mount();
    expect(screen.getByText('login page')).toBeTruthy();
  });
  it('lets a parish-admin into a normal admin page', () => {
    h.auth = { user: { uid: 'u' }, role: 'parish-admin', loading: false };
    mount();
    expect(screen.getByText('secret')).toBeTruthy();
  });
  it('keeps a parish-admin out of superadmin-only pages', () => {
    h.auth = { user: { uid: 'u' }, role: 'parish-admin', loading: false };
    mount(true);
    expect(screen.getByText('Access denied')).toBeTruthy();
    expect(screen.queryByText('secret')).toBeNull();
  });
  it('lets a superadmin into superadmin-only pages', () => {
    h.auth = { user: { uid: 'u' }, role: 'superadmin', loading: false };
    mount(true);
    expect(screen.getByText('secret')).toBeTruthy();
  });
});
