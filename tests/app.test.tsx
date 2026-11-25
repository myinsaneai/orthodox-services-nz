// @vitest-environment jsdom
// Whole-app routing, plus the admin area with a faked Firebase sign-in.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  profile: null as any,          // what the profile lookup returns for the signed-in person
  fail: false,                   // true: the profile lookup throws
  users: [] as any[],
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
  subscribeServiceDaysForMonth: (_ym: any, cb: any) => { cb([]); return () => {}; },
  subscribeServiceTemplates: (cb: any) => { cb([]); return () => {}; },
  subscribeServiceEntryTypes: (cb: any) => { cb([]); return () => {}; },
  saveServiceDay: async () => {}, deleteServiceDay: async () => {},
  saveServiceTemplate: async () => {}, saveServiceEntryType: async () => {},
  deleteServiceTemplate: async () => {}, deleteServiceEntryType: async () => {},
  setLibraryOrder: async () => {}, newLibraryId: () => 'new-id',
  ensureUserProfile: async () => { if (h.fail) throw new Error('offline'); return h.profile; },
  listUserProfiles: async () => h.users,
  updateOwnProfile: async () => {},
  setUserRole: async () => {}, deleteUserProfile: async () => {}, toMillis: () => 0,
}));

vi.mock('../src/admin/avatarStorage', () => ({ uploadAvatar: async () => 'https://firebasestorage.googleapis.com/x', removeAvatars: async () => {} }));

import App from '../src/App';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

const fbUser = { uid: 'u1', email: 'admin@example.com' };
const signIn = (u: any) => act(async () => { await h.cb!(u); });
const profile = (role: string, parishIds: string[] = []) =>
  ({ uid: 'u1', email: 'admin@example.com', displayName: '', photoURL: '', role, parishIds, providers: ['google'] });
const open = async (path: string, role: string | null, parishIds: string[] = []) => {
  h.profile = role ? profile(role, parishIds) : null;
  mountApp(path);
  await waitFor(() => expect(h.cb).not.toBeNull());
  await signIn(fbUser);
};

// BrowserRouter reads the real URL, so drive the app through the history API.
function mountApp(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
  h.profile = null; h.fail = false; h.users = []; h.cb = null; h.signedOut = 0;
});
afterEach(cleanup);

describe('public routes', () => {
  it('/ goes to Services', async () => {
    mountApp('/');
    expect(await screen.findByRole('heading', { name: 'Services', level: 1 })).toBeTruthy();
    expect(window.location.pathname).toBe('/services');
  });
  it('an unknown address goes to Services too', async () => {
    mountApp('/no/such/page');
    expect(await screen.findByRole('heading', { name: 'Services', level: 1 })).toBeTruthy();
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
    await screen.findByRole('heading', { name: 'Services', level: 1 });
    expect(h.cb).toBeNull();            // the auth listener only starts inside /admin
  });
});

describe('admin area (My page)', () => {
  it('a guest on /admin lands on the sign-in form', async () => {
    mountApp('/admin');
    await waitFor(() => expect(h.cb).not.toBeNull());
    await signIn(null);
    expect(await screen.findByRole('heading', { name: 'User login' })).toBeTruthy();
    expect(window.location.pathname).toBe('/admin/login');
  });
  it('a plain user who opens /admin lands on their Profile', async () => {
    await open('/admin', 'user');
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeTruthy();
    expect(window.location.pathname).toBe('/admin/profile');
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  });
  it('after signing in on the sign-in page, everybody goes to the first page, not to My page', async () => {
    for (const role of ['user', 'coordinator', 'admin', 'superadmin']) {
      cleanup(); h.cb = null;
      await open('/admin/login', role);
      expect(await screen.findByRole('heading', { name: 'Services', level: 1 })).toBeTruthy();
      expect(window.location.pathname).toBe('/services');
      expect(screen.queryByRole('heading', { name: 'My page' })).toBeNull();
    }
  });
  it('a coordinator reaches Profile, with no Users section', async () => {
    await open('/admin', 'coordinator', ['a', 'b']);
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeTruthy();
    expect(screen.getByText('Coordinator')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  });
  it('a coordinator reaches the schedule editor but not the templates', async () => {
    await open('/admin/schedule', 'coordinator', ['a']);
    expect(await screen.findByRole('heading', { name: 'Schedule', level: 1 })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Templates' })).toBeNull();
    cleanup();
    h.cb = null;
    await open('/admin/templates', 'coordinator', ['a']);
    expect(await screen.findByText('Access denied')).toBeTruthy();
  });
  it('a plain user is kept out of the schedule editor', async () => {
    await open('/admin/schedule', 'user');
    expect(await screen.findByText('Access denied')).toBeTruthy();
  });
  it('an admin reaches the templates page', async () => {
    await open('/admin/templates', 'admin');
    expect(await screen.findByRole('heading', { name: 'Templates', level: 1 })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Quick entries' })).toBeTruthy();
  });
  it('a coordinator is kept out of the Users page', async () => {
    await open('/admin/users', 'coordinator', ['a']);
    expect(await screen.findByText('Access denied')).toBeTruthy();
  });
  it('an admin sees "My page" in the menu, with Profile first and Users in a second line', async () => {
    await open('/admin', 'admin');
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeTruthy();
    const main = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(main).getByRole('link', { name: 'My page' }).getAttribute('href')).toBe('/admin');
    const sub = screen.getByRole('navigation', { name: 'My page sections' });
    expect(within(sub).getAllByRole('link').map(a => a.textContent)).toEqual(['Profile', 'Schedule', 'Templates', 'Users']);
    expect(within(sub).getByRole('link', { name: 'Users' }).getAttribute('href')).toBe('/admin/users');
  });
  it('the Users line opens the Users page for an admin', async () => {
    h.users = [{ ...profile('user'), uid: 'u2', email: 'maria@example.com', displayName: 'Maria' }];
    await open('/admin', 'admin');
    await screen.findByRole('heading', { name: 'Profile', level: 1 });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'My page sections' })).getByRole('link', { name: 'Users' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeTruthy();
    expect(await screen.findByText('Maria')).toBeTruthy();
    expect(window.location.pathname).toBe('/admin/users');
  });
  it('a superadmin reaches Profile', async () => {
    await open('/admin', 'superadmin');
    expect(await screen.findByText('SuperAdmin')).toBeTruthy();
  });
  it('a failed profile lookup is treated as "could not load", not as an admin', async () => {
    h.fail = true;
    await open('/admin', 'superadmin');
    expect(await screen.findByText(/could not load your account/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'My page' })).toBeNull();
  });
  it('"Log out" in the header returns to the sign-in form', async () => {
    await open('/admin', 'superadmin');
    await screen.findByRole('heading', { name: 'Profile', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(h.signedOut).toBe(1));
    await signIn(null);                  // Firebase reports the sign-out
    expect(await screen.findByRole('heading', { name: 'User login' })).toBeTruthy();
  });
});

describe('header hint written by the admin area', () => {
  it('holds the role, and is cleared after sign-out', async () => {
    await open('/admin', 'superadmin');
    expect(localStorage.getItem('gp_role')).toBe('superadmin');
    await signIn(null);
    expect(localStorage.getItem('gp_role')).toBeNull();
    h.profile = profile('user');
    await signIn(fbUser);
    expect(localStorage.getItem('gp_role')).toBe('user');
  });
  it('is not left behind when the profile cannot be loaded', async () => {
    h.fail = true;
    await open('/admin', 'user');
    expect(localStorage.getItem('gp_role')).toBeNull();
  });
  it('public pages show "Log in" for a visitor', async () => {
    mountApp('/services');
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy();
  });
});

describe('who may edit which parish (AuthContext.canEditParish)', () => {
  function Probe() {
    const { canEditParish, role } = useAuth();
    return <p>{String(role)}: a={String(canEditParish('a'))} b={String(canEditParish('b'))} c={String(canEditParish('c'))}</p>;
  }
  const mountProbe = (role: string | null, parishIds: string[] = []) => {
    h.profile = role ? profile(role, parishIds) : null;
    return render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  };

  it('superadmins and admins may edit every parish', async () => {
    mountProbe('superadmin'); await signIn(fbUser);
    expect(screen.getByText('superadmin: a=true b=true c=true')).toBeTruthy();
    cleanup();
    mountProbe('admin'); await signIn(fbUser);
    expect(screen.getByText('admin: a=true b=true c=true')).toBeTruthy();
  });
  it('a coordinator may edit only the listed parishes', async () => {
    mountProbe('coordinator', ['a', 'b']); await signIn(fbUser);
    expect(screen.getByText('coordinator: a=true b=true c=false')).toBeTruthy();
  });
  it('a coordinator with no parishes, and a plain user, may edit nothing', async () => {
    mountProbe('coordinator', []); await signIn(fbUser);
    expect(screen.getByText('coordinator: a=false b=false c=false')).toBeTruthy();
    cleanup();
    mountProbe('user', ['a']); await signIn(fbUser);
    expect(screen.getByText('user: a=false b=false c=false')).toBeTruthy();
  });
  it('nobody signed in may edit anything', async () => {
    mountProbe(null); await signIn(null);
    expect(screen.getByText('null: a=false b=false c=false')).toBeTruthy();
  });
});
