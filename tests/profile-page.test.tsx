// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  profile: null as any, applied: [] as any[], updates: [] as any[],
  uploads: 0, removes: 0, resize: null as any, uploadFails: false,
}));
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, profile: h.profile, role: h.profile?.role, loading: false,
    applyProfile: (p: any) => { h.applied.push(p); } }),
}));
vi.mock('../src/lib/firestore', () => ({
  updateOwnProfile: async (uid: string, p: any) => { h.updates.push([uid, p]); },
}));
vi.mock('../src/admin/avatarStorage', () => ({
  uploadAvatar: async () => { if (h.uploadFails) throw Object.assign(new Error('x'), { code: 'storage/unauthorized' }); h.uploads++; return 'https://firebasestorage.googleapis.com/v0/b/x/o/new.jpg'; },
  removeAvatars: async () => { h.removes++; },
}));
vi.mock('../src/lib/image', async () => {
  const real = await vi.importActual<any>('../src/lib/image');
  return { ...real, resizeImage: async () => h.resize() };
});

import ProfilePage from '../src/admin/ProfilePage';

const base = { uid: 'u1', email: 'maria@example.com', displayName: 'Maria', photoURL: '', role: 'user', providers: ['google'], parishIds: [] };
const file = (type = 'image/png', size = 5000) => new File([new Uint8Array(size)], 'p.png', { type });

beforeEach(() => {
  h.profile = { ...base }; h.applied = []; h.updates = []; h.uploads = 0; h.removes = 0; h.uploadFails = false;
  h.resize = () => ({ blob: new Blob([new Uint8Array(2048)]), width: 1024, height: 683 });
  (URL as any).createObjectURL = () => 'blob:preview';
  (URL as any).revokeObjectURL = () => {};
});
afterEach(cleanup);

const drop = (f: File) => fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [f] } });

describe('Profile page', () => {
  it('shows name, email, role and sign-in method; Save starts disabled', () => {
    render(<ProfilePage />);
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Maria');
    expect(screen.getByText('maria@example.com')).toBeTruthy();
    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('saves a changed display name', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '  Maria K  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(h.updates).toEqual([['u1', { displayName: 'Maria K', photoURL: '' }]]);
    expect(h.applied[0]).toMatchObject({ displayName: 'Maria K', profileEdited: true });
    expect(h.uploads).toBe(0);
  });
  it('will not save an empty name', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Please enter a name.');
    expect(h.updates).toEqual([]);
  });
  it('a dropped picture is shrunk, previewed with its size, and uploaded only on Save', async () => {
    render(<ProfilePage />);
    drop(file());
    await screen.findByText(/New photo ready: 1024 × 683 px, 2 KB/);
    expect(h.uploads).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(h.uploads).toBe(1);
    expect(h.updates[0][1]).toEqual({ displayName: 'Maria', photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/new.jpg' });
  });
  it('the file chooser works too', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Choose a photo file'), { target: { files: [file('image/jpeg')] } });
    await screen.findByText(/New photo ready/);
  });
  it('refuses a file that is not a picture', async () => {
    render(<ProfilePage />);
    drop(file('application/pdf'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/JPEG, PNG, WebP or GIF/);
    expect(screen.queryByText(/New photo ready/)).toBeNull();
  });
  it('says so when a picture cannot be read', async () => {
    h.resize = () => { throw new Error('bad'); };
    render(<ProfilePage />);
    drop(file());
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not read that picture/);
  });
  it('Remove photo deletes the stored pictures on Save', async () => {
    h.profile = { ...base, photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/old.jpg' };
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(h.removes).toBe(1);
    expect(h.updates[0][1].photoURL).toBe('');
  });
  it('Cancel changes puts everything back', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Other' } });
    drop(file());
    await screen.findByText(/New photo ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Maria');
    expect(screen.queryByText(/New photo ready/)).toBeNull();
  });
  it('shows a clear message when the upload fails, and saves nothing', async () => {
    h.uploadFails = true;
    render(<ProfilePage />);
    drop(file());
    await screen.findByText(/New photo ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/photo could not be uploaded/);
    expect(h.updates).toEqual([]);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
  });
});
