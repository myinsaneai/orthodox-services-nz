// @vitest-environment jsdom
// My page → Users: listing, search, filter, changing roles, deleting.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  auth: {} as any,
  users: [] as any[],
  list: vi.fn(), setRole: vi.fn(), del: vi.fn(),
}));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../src/lib/firestore', () => ({
  listUserProfiles: (...a: any[]) => h.list(...a),
  setUserRole: (...a: any[]) => h.setRole(...a),
  deleteUserProfile: (...a: any[]) => h.del(...a),
  toMillis: (v: any) => (typeof v === 'number' ? v : 0),
}));

import UsersPage from '../src/admin/UsersPage';

const p = (uid: string, name: string, role: string, extra: any = {}) =>
  ({ uid, email: `${uid}@example.com`, displayName: name, photoURL: '', role, parishIds: [], providers: ['google'], createdAt: 0, lastSignInAt: 0, ...extra });
const as = (role: string, uid = 'me') => { h.auth = { user: { uid }, role }; };

const rowOf = (name: string) => screen.getByText(name).closest('.um-row') as HTMLElement;
const mount = async () => { render(<UsersPage />); await screen.findByText(/ of \d+ users/); };

beforeEach(() => {
  h.users = [
    p('me', 'Me Myself', 'superadmin'),
    p('ad', 'Alice Admin', 'admin'),
    p('co', 'Carl Coordinator', 'coordinator', { parishIds: ['a', 'b'] }),
    p('u1', 'Ulla User', 'user', { providers: ['password'] }),
    p('u2', 'Bob Builder', 'user', { providers: ['google', 'password'] }),
    p('u3', 'Old Profile', 'user', { providers: [] }),
  ];
  h.list.mockReset(); h.setRole.mockReset(); h.del.mockReset();
  h.list.mockImplementation(async () => h.users);
  h.setRole.mockResolvedValue(undefined); h.del.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Users page: list', () => {
  it('lists everyone, highest role first then by name', async () => {
    as('superadmin');
    await mount();
    const names = [...document.querySelectorAll('.um-name')].map(n => n.textContent);
    expect(names).toEqual(['Me Myself', 'Alice Admin', 'Carl Coordinator', 'Bob Builder', 'Old Profile', 'Ulla User']);
    expect(screen.getByText('6 of 6 users')).toBeTruthy();
  });
  it('searches by name or email and filters by role', async () => {
    as('superadmin');
    await mount();
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'bob' } });
    expect(screen.getByText('1 of 6 users')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'u1@example' } });
    expect(screen.getByText('Ulla User')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'user' } });
    expect(screen.getByText('3 of 6 users')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'zzz' } });
    expect(screen.getByText('No users match.')).toBeTruthy();
  });
  it('shows an error when the list cannot be loaded, and Refresh tries again', async () => {
    as('admin');
    h.list.mockRejectedValueOnce(new Error('offline'));
    render(<UsersPage />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not load the users/);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Alice Admin')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('explains the four roles', async () => {
    as('admin');
    await mount();
    const d = screen.getByText('What do the roles mean?').closest('details')!;
    ['User', 'Coordinator', 'Admin', 'SuperAdmin'].forEach(r =>
      expect(within(d).getByText(r, { selector: 'b' })).toBeTruthy());
  });
});

describe('Users page: how each person signs in', () => {
  it('shows Google, Email, both, or Unknown for every user', async () => {
    as('admin', 'ad');
    await mount();
    const method = (n: string) => rowOf(n).textContent!;
    expect(method('Me Myself')).toMatch(/Signs in with: Google/);
    expect(method('Ulla User')).toMatch(/Signs in with: Email(?! \+)/);
    expect(method('Bob Builder')).toMatch(/Signs in with: Email \+ Google/);
    expect(method('Old Profile')).toMatch(/Signs in with: Unknown/);
    expect(screen.getByText('Signs in with', { selector: '.um-head div' })).toBeTruthy();
  });
});

describe('Users page: an admin', () => {
  beforeEach(() => as('admin', 'ad'));

  it('changes a user to coordinator; SuperAdmin is not offered', async () => {
    await mount();
    const row = rowOf('Ulla User');
    fireEvent.click(within(row).getByRole('button', { name: 'Change role for Ulla User' }));
    const sel = within(row).getByLabelText('Role for Ulla User') as HTMLSelectElement;
    const offered = [...sel.options].filter(o => !o.disabled).map(o => o.value);
    expect(offered).toEqual(['user', 'coordinator', 'admin']);
    expect([...sel.options].find(o => o.value === 'superadmin')!.disabled).toBe(true);
    fireEvent.change(sel, { target: { value: 'coordinator' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.setRole).toHaveBeenCalledWith('u1', 'coordinator', []));
    expect(await within(rowOf('Ulla User')).findByText('Coordinator')).toBeTruthy();
  });
  it('keeps a coordinator\'s parishes when only the page is saved unchanged, and clears nothing else', async () => {
    await mount();
    const row = rowOf('Carl Coordinator');
    fireEvent.click(within(row).getByRole('button', { name: 'Change role for Carl Coordinator' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));    // no change picked
    await waitFor(() => expect(within(rowOf('Carl Coordinator')).getByText('Coordinator')).toBeTruthy());
    expect(h.setRole).not.toHaveBeenCalled();
  });
  it('cannot change an admin or a superadmin, and cannot delete anybody', async () => {
    await mount();
    expect(within(rowOf('Me Myself')).getByText('SuperAdmin only')).toBeTruthy();
    expect(within(rowOf('Me Myself')).queryByRole('button')).toBeNull();
    expect(within(rowOf('Alice Admin')).getByText('You')).toBeTruthy();    // Alice is the signed-in admin here
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });
  it('shows a message when the server refuses the change, and keeps the old role', async () => {
    h.setRole.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await mount();
    const row = rowOf('Bob Builder');
    fireEvent.click(within(row).getByRole('button', { name: 'Change role for Bob Builder' }));
    fireEvent.change(within(row).getByLabelText('Role for Bob Builder'), { target: { value: 'admin' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
    expect((await within(row).findByRole('alert')).textContent).toMatch(/Not allowed/);
    fireEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
    expect(within(row).getByText('User')).toBeTruthy();
  });
});

describe('Users page: a superadmin', () => {
  beforeEach(() => as('superadmin', 'me'));

  it('may give any role, including SuperAdmin, to an admin', async () => {
    await mount();
    const row = rowOf('Alice Admin');
    fireEvent.click(within(row).getByRole('button', { name: 'Change role for Alice Admin' }));
    const sel = within(row).getByLabelText('Role for Alice Admin') as HTMLSelectElement;
    expect([...sel.options].every(o => !o.disabled)).toBe(true);
    fireEvent.change(sel, { target: { value: 'superadmin' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.setRole).toHaveBeenCalledWith('ad', 'superadmin', []));
  });
  it('passes a coordinator\'s parishes along, so they are not lost by a no-op save', async () => {
    await mount();
    const row = rowOf('Carl Coordinator');
    fireEvent.click(within(row).getByRole('button', { name: 'Change role for Carl Coordinator' }));
    fireEvent.change(within(row).getByLabelText('Role for Carl Coordinator'), { target: { value: 'admin' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.setRole).toHaveBeenCalledWith('co', 'admin', ['a', 'b']));
  });
  it('has no buttons on its own row, only "You"', async () => {
    await mount();
    const row = rowOf('Me Myself');
    expect(within(row).getByText('You')).toBeTruthy();
    expect(within(row).queryByRole('button')).toBeNull();
  });
  it('deletes only after a confirmation, and says what that does', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ulla User' }));
    expect(h.del).not.toHaveBeenCalled();
    const dlg = screen.getByRole('alertdialog', { name: 'Delete Ulla User' });
    expect(dlg.textContent).toMatch(/removes their profile and role/);
    expect(dlg.textContent).toMatch(/start again as a User/);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Ulla User' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.queryByText('Ulla User')).toBeNull());
    expect(screen.getByText('5 of 5 users')).toBeTruthy();
  });
  it('keeps the person in the list and shows a message if the delete fails', async () => {
    h.del.mockRejectedValue(new Error('offline'));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bob Builder' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not save/);
    expect(screen.getByText('Bob Builder')).toBeTruthy();
  });
});
