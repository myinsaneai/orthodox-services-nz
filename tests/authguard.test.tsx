// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ auth: {} as any }));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => h.auth }));

import AuthGuard from '../src/components/AuthGuard';
import type { RoleName } from '../src/lib/roles';

const mount = (minRole?: RoleName) => render(
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path="/admin" element={<AuthGuard minRole={minRole}><p>secret</p></AuthGuard>} />
      <Route path="/admin/login" element={<p>login page</p>} />
    </Routes>
  </MemoryRouter>,
);
const as = (role: RoleName | null, loading = false) =>
  { h.auth = { user: role ? { uid: 'u' } : null, role, loading }; };
afterEach(cleanup);

describe('AuthGuard', () => {
  it('waits while the profile is being looked up (no redirect yet)', () => {
    as(null, true);
    mount();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('login page')).toBeNull();
  });
  it('sends a guest to the login page', () => {
    as(null);
    mount();
    expect(screen.getByText('login page')).toBeTruthy();
  });
  it('sends a signed-in person whose profile did not load to the login page', () => {
    h.auth = { user: { uid: 'u' }, role: null, loading: false };
    mount();
    expect(screen.getByText('login page')).toBeTruthy();
  });
  it('lets any signed-in role into a default page, plain users included', () => {
    (['user', 'coordinator', 'admin', 'superadmin'] as RoleName[]).forEach(r => {
      as(r);
      mount();
      expect(screen.getByText('secret')).toBeTruthy();
      cleanup();
    });
  });
  it('keeps a plain user out of pages that need a coordinator', () => {
    as('user');
    mount('coordinator');
    expect(screen.getByText('Access denied')).toBeTruthy();
    expect(screen.queryByText('secret')).toBeNull();
  });
  it('keeps a coordinator out of admin-only pages', () => {
    as('coordinator');
    mount('admin');
    expect(screen.getByText('Access denied')).toBeTruthy();
    expect(screen.getByText(/requires the Admin role/)).toBeTruthy();
    expect(screen.queryByText('secret')).toBeNull();
  });
  it('lets an admin into admin-only pages but keeps them out of superadmin-only pages', () => {
    as('admin');
    mount('admin');
    expect(screen.getByText('secret')).toBeTruthy();
    cleanup();
    mount('superadmin');
    expect(screen.getByText('Access denied')).toBeTruthy();
  });
  it('lets a superadmin into everything', () => {
    as('superadmin');
    mount('superadmin');
    expect(screen.getByText('secret')).toBeTruthy();
  });
});
