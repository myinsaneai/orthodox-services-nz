// @vitest-environment jsdom
// Log in / Log out in the public header, and the hint that drives it.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ out: vi.fn(), fail: false }));
vi.mock('../src/admin/signOut', () => ({
  adminSignOut: async () => {
    h.out();
    if (h.fail) throw new Error('offline');
    const { setAdminHint } = await import('../src/lib/authHint');
    setAdminHint(false);
  },
}));

import { LangProvider } from '../src/contexts/LangContext';
import SiteLayout from '../src/components/SiteLayout';
import { getAdminHint, setAdminHint } from '../src/lib/authHint';

const mount = () => render(
  <MemoryRouter initialEntries={['/services']}>
    <LangProvider><SiteLayout><p>body</p></SiteLayout></LangProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear(); h.out.mockClear(); h.fail = false;
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
});
afterEach(cleanup);

describe('header account control', () => {
  it('shows "Log in", linking to the admin sign-in, when nobody is signed in', () => {
    mount();
    const link = screen.getByRole('link', { name: 'Log in' });
    expect(link.getAttribute('href')).toBe('/admin/login');
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });
  it('is outside the menu: the menu is still exactly Services, Parishes, About and the language switch', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
    expect(within(nav).getAllByRole('button')).toHaveLength(1);
    expect(within(nav).queryByText('Log in')).toBeNull();
  });
  it('shows "Admin" and "Log out" when an admin is signed in', () => {
    setAdminHint(true);
    mount();
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
  it('"Log out" signs out and the header goes back to "Log in"', async () => {
    setAdminHint(true);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(h.out).toHaveBeenCalledTimes(1);
    expect(getAdminHint()).toBe(false);
  });
  it('if sign-out cannot reach Firebase, the header still stops saying "Log out"', async () => {
    h.fail = true;
    setAdminHint(true);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy());
  });
  it('is translated', () => {
    Object.defineProperty(navigator, 'language', { value: 'el-GR', configurable: true });
    mount();
    expect(screen.getByRole('link', { name: 'Σύνδεση' })).toBeTruthy();
    cleanup();
    setAdminHint(true);
    mount();
    expect(screen.getByRole('button', { name: 'Αποσύνδεση' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Διαχείριση' })).toBeTruthy();
  });
  it('reacts when the hint changes in another tab', async () => {
    mount();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    localStorage.setItem('gp_admin', '1');
    window.dispatchEvent(new StorageEvent('storage', { key: 'gp_admin', newValue: '1' }));
    expect(await screen.findByRole('button', { name: 'Log out' })).toBeTruthy();
  });
});
