// @vitest-environment jsdom
// Whole-app routing, plus the admin area with a faked Firebase sign-in.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  admin: null as any,
  cb: null as null | ((u: any) => Promise<void>),
  signedOut: 0,
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: any, cb: any) => { h.cb = cb; return () => {}; },
  signInWithEmailAndPassword: vi.fn(),
  signOut: () => { h.signedOut++; return Promise.resolve(); },
}));
vi.mock('../src/lib/firebaseAdmin', () => ({ auth: {}, storage: {} }));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: any) => { cb([]); return () => {}; },
  subscribeGroups: (cb: any) => { cb([]); return () => {}; },
  subscribeUpcomingServices: (_s: any, _f: any, cb: any) => { cb([]); return () => {}; },
  getAdminRecord: async () => h.admin,
}));

import App from '../src/App';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

const fbUser = { uid: 'u1', email: 'admin@example.com' };
const signIn = (u: any) => act(async () => { await h.cb!(u); });

// BrowserRouter reads the real URL, so drive the app through the history API.
function mountApp(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
  h.admin = null; h.cb = null; h.signedOut = 0;
});
afterEach(cleanup);

describe('public routes', () => {
  it('/ goes to Services', async () => {
    mountApp('/');
    expect(await screen.findByRole('heading', { name: 'Services & Sacred Mysteries' })).toBeTruthy();
    expect(window.location.pathname).toBe('/services');
  });
  it('an unknown address goes to Services too', async () => {
    mountApp('/no/such/page');
    expect(await screen.findByRole('heading', { name: 'Services & Sacred Mysteries' })).toBeTruthy();
  });
  it('Parishes and About open from the menu', async () => {
    mountApp('/services');
    fireEvent.click(screen.getByRole('link', { name: 'Parishes' }));
    expect(await screen.findByRole('heading', { name: 'Parishes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeTruthy();
    expect(window.location.pathname).toBe('/about');
  });
  it('public pages never load the admin area', async () => {
    mountApp('/services');
    await screen.findByRole('heading', { name: 'Services & Sacred Mysteries' });
    expect(h.cb).toBeNull();            // the auth listener only starts inside /admin
  });
});

describe('admin area', () => {
  it('a guest on /admin lands on the sign-in form', async () => {
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(null);
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(window.location.pathname).toBe('/admin/login');
  });
  it('a signed-in person without an admin record cannot get in', async () => {
    h.admin = null;
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(fbUser);
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(screen.queryByText('Admin dashboard')).toBeNull();
  });
  it('a parish-admin reaches the dashboard and sees how many parishes they manage', async () => {
    h.admin = { uid: 'u1', email: 'admin@example.com', role: 'parish-admin', parishIds: ['a', 'b'] };
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(fbUser);
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeTruthy();
    expect(screen.getByText(/admin@example\.com \(parish-admin, 2 parish\(es\)\)/)).toBeTruthy();
  });
  it('a superadmin reaches the dashboard', async () => {
    h.admin = { uid: 'u1', email: 'admin@example.com', role: 'superadmin', parishIds: 'all' };
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(fbUser);
    expect(await screen.findByText(/\(superadmin\)/)).toBeTruthy();
  });
  it('a failed role lookup is treated as "not an admin"', async () => {
    h.admin = undefined;                 // getAdminRecord resolves undefined → falsy
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(fbUser);
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
  });
  it('signing out of the dashboard returns to the sign-in form', async () => {
    h.admin = { uid: 'u1', email: 'admin@example.com', role: 'superadmin', parishIds: 'all' };
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(fbUser);
    await screen.findByRole('heading', { name: 'Admin dashboard' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(h.signedOut).toBe(1);
    await signIn(null);                  // Firebase reports the sign-out
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
  });
});

describe('who may edit which parish (AuthContext.canEditParish)', () => {
  function Probe() {
    const { canEditParish, role } = useAuth();
    return <p>{String(role)}: a={String(canEditParish('a'))} b={String(canEditParish('b'))} c={String(canEditParish('c'))}</p>;
  }
  const mountProbe = () => render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);

  it('a superadmin may edit every parish', async () => {
    h.admin = { role: 'superadmin', parishIds: 'all' };
    mountProbe(); await signIn(fbUser);
    expect(screen.getByText('superadmin: a=true b=true c=true')).toBeTruthy();
  });
  it('a parish-admin may edit only the listed parishes', async () => {
    h.admin = { role: 'parish-admin', parishIds: ['a', 'b'] };
    mountProbe(); await signIn(fbUser);
    expect(screen.getByText('parish-admin: a=true b=true c=false')).toBeTruthy();
  });
  it('a parish-admin with no parishes, or with "all" by mistake, may edit nothing', async () => {
    h.admin = { role: 'parish-admin', parishIds: [] };
    mountProbe(); await signIn(fbUser);
    expect(screen.getByText('parish-admin: a=false b=false c=false')).toBeTruthy();
    cleanup();
    h.admin = { role: 'parish-admin', parishIds: 'all' };
    mountProbe(); await signIn(fbUser);
    expect(screen.getByText('parish-admin: a=false b=false c=false')).toBeTruthy();
  });
  it('nobody signed in may edit anything', async () => {
    mountProbe(); await signIn(null);
    expect(screen.getByText('null: a=false b=false c=false')).toBeTruthy();
  });
});
