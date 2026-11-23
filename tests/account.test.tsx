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
    const { setRoleHint } = await import('../src/lib/authHint');
    setRoleHint(null);
  },
}));

import { LangProvider } from '../src/contexts/LangContext';
import SiteLayout from '../src/components/SiteLayout';
import { getRoleHint, setRoleHint } from '../src/lib/authHint';

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
  it('shows "Log out" instead of "Log in" for any signed-in role', () => {
    (['user', 'coordinator', 'admin', 'superadmin'] as const).forEach(r => {
      localStorage.clear(); setRoleHint(r);
      mount();
      expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
      cleanup();
    });
  });
  it('"My page" is in the menu for every signed-in role, and for nobody else', () => {
    mount();
    expect(screen.queryByRole('link', { name: 'My page' })).toBeNull();
    cleanup();
    (['user', 'coordinator', 'admin', 'superadmin'] as const).forEach(r => {
      localStorage.clear(); setRoleHint(r);
      mount();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByRole('link', { name: 'My page' }).getAttribute('href')).toBe('/admin');
      expect(within(nav).getAllByRole('link')).toHaveLength(4);
      cleanup();
    });
  });
  it('the second line shows only inside My page: Profile first, Users only for admins', () => {
    const sections = (role: 'user' | 'coordinator' | 'admin' | 'superadmin') => {
      localStorage.clear(); setRoleHint(role);
      render(
        <MemoryRouter initialEntries={['/admin/profile']}>
          <LangProvider><SiteLayout><p>body</p></SiteLayout></LangProvider>
        </MemoryRouter>,
      );
      const sub = screen.getByRole('navigation', { name: 'My page sections' });
      const names = within(sub).getAllByRole('link').map(a => a.textContent);
      cleanup();
      return names;
    };
    expect(sections('user')).toEqual(['Profile']);
    expect(sections('coordinator')).toEqual(['Profile']);
    expect(sections('admin')).toEqual(['Profile', 'Users']);
    expect(sections('superadmin')).toEqual(['Profile', 'Users']);

    localStorage.clear(); setRoleHint('admin');
    mount();                                         // on /services: no second line
    expect(screen.queryByRole('navigation', { name: 'My page sections' })).toBeNull();
  });
  it('a stale hint, or one a person made up, shows nothing special', () => {
    localStorage.setItem('gp_admin', '1');           // the first version of the hint
    localStorage.setItem('gp_role', 'god');
    mount();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'My page' })).toBeNull();
  });
  it('"Log out" signs out and the header goes back to "Log in"', async () => {
    setRoleHint('superadmin');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(h.out).toHaveBeenCalledTimes(1);
    expect(getRoleHint()).toBeNull();
  });
  it('if sign-out cannot reach Firebase, the header still stops saying "Log out"', async () => {
    h.fail = true;
    setRoleHint('superadmin');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy());
  });
  it('is translated', () => {
    Object.defineProperty(navigator, 'language', { value: 'el-GR', configurable: true });
    mount();
    expect(screen.getByRole('link', { name: 'Σύνδεση' })).toBeTruthy();
    cleanup();
    setRoleHint('admin');
    mount();
    expect(screen.getByRole('button', { name: 'Αποσύνδεση' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Η σελίδα μου' })).toBeTruthy();
  });
  it('reacts when the hint changes in another tab', async () => {
    mount();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    localStorage.setItem('gp_role', 'user');
    window.dispatchEvent(new StorageEvent('storage', { key: 'gp_role', newValue: 'user' }));
    expect(await screen.findByRole('button', { name: 'Log out' })).toBeTruthy();
  });
});
