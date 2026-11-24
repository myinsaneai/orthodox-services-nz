// @vitest-environment jsdom
// Login with email + password: an unknown email goes on to the registration screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({
  auth: { user: null as any, role: null as any, loading: false },
  signIn: vi.fn(), create: vi.fn(), update: vi.fn(), check: vi.fn(),
}));
vi.mock('../src/admin/emailCheck', () => ({
  checkEmailExists: (...a: any[]) => h.check(...a),
  isRateLimited: (e: any) => e?.code === 'functions/resource-exhausted',
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(), signInWithCredential: vi.fn(), signOut: vi.fn(),
  signInWithEmailAndPassword: (...a: any[]) => h.signIn(...a),
  createUserWithEmailAndPassword: (...a: any[]) => h.create(...a),
  updateProfile: (...a: any[]) => h.update(...a),
}));
vi.mock('../src/lib/firebaseAdmin', () => ({ auth: { fake: true }, storage: {} }));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => h.auth }));

import LoginPage from '../src/admin/LoginPage';
import RegisterPage, { registerErrorMessage } from '../src/admin/RegisterPage';
import { takePendingName } from '../src/admin/pendingName';

const mount = (path = '/admin/login') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/register" element={<RegisterPage />} />
      <Route path="/" element={<p>first page</p>} />
    </Routes>
  </MemoryRouter>,
);
const fill = (label: string | RegExp, v: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const fail = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  h.auth = { user: null, role: null, loading: false };
  h.signIn.mockReset(); h.check.mockReset(); h.check.mockResolvedValue({ exists: true, providers: ['password'] }); h.create.mockReset(); h.update.mockReset();
  h.create.mockResolvedValue({ user: { uid: 'n1' } }); h.update.mockResolvedValue(undefined);
  takePendingName();
});
afterEach(cleanup);

const typeCredentials = () => {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('login page', () => {
  it('is called "User login"', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'User login' })).toBeTruthy();
    expect(screen.queryByText(/Admin sign in/)).toBeNull();
  });
  it('an email that is not in the user list goes to registration, email and masked password filled in', async () => {
    h.check.mockResolvedValue({ exists: false, providers: [] });
    mount();
    typeCredentials();
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(h.check).toHaveBeenCalledWith('new@example.com');
    expect(h.signIn).not.toHaveBeenCalled();             // no login attempt for an unknown email
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('new@example.com');
    const pw = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pw.value).toBe('secret1');
    expect(pw.type).toBe('password');
    expect((screen.getByLabelText('Confirm password') as HTMLInputElement).value).toBe('');
  });
  it('a known email with the wrong password stays on the login page: "Incorrect password"', async () => {
    h.signIn.mockRejectedValue(fail('auth/invalid-credential'));
    mount();
    typeCredentials();
    expect((await screen.findByRole('alert')).textContent).toBe('Incorrect password. Please try again.');
    expect(screen.queryByRole('heading', { name: 'Create your account' })).toBeNull();
  });
  it('a known email with the right password signs in', async () => {
    h.signIn.mockResolvedValue({});
    mount();
    typeCredentials();
    await waitFor(() => expect(h.signIn).toHaveBeenCalledTimes(1));
    expect(h.signIn.mock.calls[0].slice(1)).toEqual(['new@example.com', 'secret1']);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('a Google-only email is pointed to the Google button, without a password attempt', async () => {
    h.check.mockResolvedValue({ exists: true, providers: ['google'] });
    mount();
    typeCredentials();
    expect((await screen.findByRole('alert')).textContent).toMatch(/signs in with Google/);
    expect(h.signIn).not.toHaveBeenCalled();
  });
  it('an email with Google and password sign-in is allowed to use the password', async () => {
    h.check.mockResolvedValue({ exists: true, providers: ['google', 'password'] });
    h.signIn.mockResolvedValue({});
    mount();
    typeCredentials();
    await waitFor(() => expect(h.signIn).toHaveBeenCalled());
  });
  it('too many checks: shows the limit message and does nothing else', async () => {
    h.check.mockRejectedValue(fail('functions/resource-exhausted'));
    mount();
    typeCredentials();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many attempts/);
    expect(h.signIn).not.toHaveBeenCalled();
  });
  it.each(['auth/invalid-credential', 'auth/user-not-found'])(
    'if the check is unavailable, a failed sign-in (%s) falls back to registration', async code => {
      h.check.mockRejectedValue(fail('functions/unavailable'));
      h.signIn.mockRejectedValue(fail(code));
      mount();
      typeCredentials();
      await screen.findByRole('heading', { name: 'Create your account' });
    });
  it('other sign-in failures stay on the login page with a message', async () => {
    h.signIn.mockRejectedValue(fail('auth/too-many-requests'));
    mount();
    typeCredentials();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many attempts/);
    expect(screen.queryByRole('heading', { name: 'Create your account' })).toBeNull();
  });
  it('has a "Create an account" link for people who start there', () => {
    mount();
    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
  });
});

describe('registration page', () => {
  const open = () => { mount('/admin/register'); fill('Email', 'new@example.com'); fill('Password', 'secret1'); };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

  it('creates the account, attaches the name, and remembers it for the profile', async () => {
    open(); fill('Confirm password', 'secret1'); fill('Your name', '  Maria K ');
    submit();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.create.mock.calls[0].slice(1)).toEqual(['new@example.com', 'secret1']);
    expect(h.update.mock.calls[0][1]).toEqual({ displayName: 'Maria K' });
    expect(takePendingName()).toBe('Maria K');
  });
  it('refuses when the passwords differ', () => {
    open(); fill('Confirm password', 'other'); fill('Your name', 'Maria');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/not the same/);
    expect(h.create).not.toHaveBeenCalled();
  });
  it('refuses a short password and an empty name', () => {
    open(); fill('Password', '123'); fill('Confirm password', '123'); fill('Your name', 'Maria');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/at least 6/);
    fill('Password', 'secret1'); fill('Confirm password', 'secret1'); fill('Your name', '   ');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/enter your name/);
    expect(h.create).not.toHaveBeenCalled();
  });
  it('an email that already has an account says so, and forgets the name', async () => {
    h.create.mockRejectedValue(fail('auth/email-already-in-use'));
    open(); fill('Confirm password', 'secret1'); fill('Your name', 'Maria');
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/already has an account/);
    expect(takePendingName()).toBe('');
    expect(screen.getByRole('link', { name: 'go back to the login' })).toBeTruthy();
  });
  it('a failed name update does not undo the account', async () => {
    h.update.mockRejectedValue(new Error('x'));
    open(); fill('Confirm password', 'secret1'); fill('Your name', 'Maria');
    submit();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('leaves for the first page once the account is signed in with a profile', () => {
    h.auth = { user: { uid: 'n1' }, role: 'user', loading: false };
    mount('/admin/register');
    expect(screen.getByText('first page')).toBeTruthy();
  });
  it('shows "Setting up" while the profile loads', () => {
    h.auth = { user: { uid: 'n1' }, role: null, loading: false };
    mount('/admin/register');
    expect(screen.getByText(/Setting up your account/)).toBeTruthy();
  });
  it('maps every error to plain words', () => {
    for (const c of ['auth/invalid-email', 'auth/weak-password', 'auth/operation-not-allowed', 'auth/network-request-failed', 'x'])
      expect(registerErrorMessage(c).length).toBeGreaterThan(10);
  });
});
