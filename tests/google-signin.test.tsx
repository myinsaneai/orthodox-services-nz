// @vitest-environment jsdom
// Google sign-in on the admin login page, and the "signed in but not an admin" notice.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  auth: { user: null as any, role: null as any, loading: false },
  popup: vi.fn(),
  cred: vi.fn(),
  signInCred: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    static credential = (...a: any[]) => { h.cred(...a); return { token: a[1] }; };
  }
  return {
    GoogleAuthProvider,
    signInWithPopup: (...a: any[]) => h.popup(...a),
    signInWithCredential: (...a: any[]) => h.signInCred(...a),
    signInWithEmailAndPassword: vi.fn(),
    signOut: (...a: any[]) => h.signOut(...a),
  };
});
vi.mock('../src/lib/firebaseAdmin', () => ({ auth: { fake: true }, storage: {} }));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => h.auth }));

import LoginPage from '../src/admin/LoginPage';
import { embeddedBrowser } from '../src/admin/embeddedBrowser';

const mount = () => render(<MemoryRouter><LoginPage /></MemoryRouter>);
const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const NORMAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36';

beforeEach(() => {
  h.auth = { user: null, role: null, loading: false };
  h.popup.mockReset(); h.cred.mockReset(); h.signInCred.mockReset(); h.signOut.mockReset();
  h.popup.mockResolvedValue({}); h.signInCred.mockResolvedValue({});
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  setUA(NORMAL_UA);
  delete (window as any).google;
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); delete (window as any).google; });

describe('Google button', () => {
  it('is on the sign-in page next to the email form', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'User login' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
  });
  it('uses Firebase\'s own popup when there is no Google client ID', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(h.popup).toHaveBeenCalledTimes(1));
    expect(h.signInCred).not.toHaveBeenCalled();
  });
  it('uses Google Identity Services plus signInWithCredential when the client ID is set and the script is ready', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123.apps.googleusercontent.com');
    const cfgs: any[] = [];
    (window as any).google = { accounts: { oauth2: { initTokenClient: (cfg: any) => {
      cfgs.push(cfg);
      return { requestAccessToken: () => cfg.callback({ access_token: 'tok-abc' }) };
    } } } };
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(h.signInCred).toHaveBeenCalledTimes(1));
    expect(cfgs[0].client_id).toBe('client-123.apps.googleusercontent.com');
    expect(h.cred).toHaveBeenCalledWith(null, 'tok-abc');
    expect(h.popup).not.toHaveBeenCalled();
  });
  it('falls back to the popup when the client ID is set but Google\'s script has not loaded', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123.apps.googleusercontent.com');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(h.popup).toHaveBeenCalledTimes(1));
  });
  it('shows nothing when the person simply closes the Google window', async () => {
    h.popup.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(h.popup).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('explains an unauthorized web address (a missing Authorized domain)', async () => {
    h.popup.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/unauthorized-domain' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not enabled for this web address/);
  });
  it('shows a general message for any other failure', async () => {
    h.popup.mockRejectedValue(new Error('boom'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Google sign-in failed/);
  });
  it('is disabled inside Messenger / Facebook, with an explanation', () => {
    setUA('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/Orca-Android;FBAV/450.0]');
    mount();
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/does not work inside Messenger or Facebook/)).toBeTruthy();
  });
  it('only hints in other in-app browsers', () => {
    setUA('Mozilla/5.0 (Linux; Android 14) Telegram-Android/10.0');
    mount();
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/built-in browser of another app/)).toBeTruthy();
  });
});

describe('after signing in', () => {
  it('says so, with a way out, when the profile could not be loaded', () => {
    h.auth = { user: { email: 'stranger@example.com' }, role: null, loading: false };
    mount();
    expect(screen.getByRole('heading', { name: 'User login' })).toBeTruthy();
    expect(screen.getByText('stranger@example.com')).toBeTruthy();
    expect(screen.getByText(/could not load your account/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to the site' })).toBeTruthy();
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });
  it('every role leaves the sign-in page (the app sends them to the first page)', () => {
    ['user', 'coordinator', 'admin', 'superadmin'].forEach(role => {
      h.auth = { user: { email: 'a@b.c' }, role, loading: false };
      const { container } = mount();
      expect(container.textContent).not.toMatch(/User login/);
      cleanup();
    });
  });
  it('shows the normal form while the profile is still loading', () => {
    h.auth = { user: { email: 'a@b.c' }, role: null, loading: true };
    mount();
    expect(screen.queryByText(/could not load your account/)).toBeNull();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
  });
});

describe('embeddedBrowser', () => {
  it('recognises normal and in-app browsers', () => {
    expect(embeddedBrowser(NORMAL_UA)).toBe('ok');
    expect(embeddedBrowser('Mozilla/5.0 iPhone Safari')).toBe('ok');
    expect(embeddedBrowser('... Instagram 300.0 ...')).toBe('blocked');
    expect(embeddedBrowser('... FBAN/FBIOS ...')).toBe('blocked');
    expect(embeddedBrowser('... Viber/20 ...')).toBe('maybe');
    expect(embeddedBrowser('Mozilla/5.0 (Linux; Android 14; wv) Chrome/130')).toBe('maybe');
  });
});
