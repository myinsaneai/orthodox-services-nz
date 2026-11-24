// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  parishes: [] as any[], created: [] as any[], uploads: [] as any[], removed: [] as string[],
  createFails: '' as string, uploadFails: false, resize: null as any,
}));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => { cb(h.parishes); return () => {}; },
  createParish: async (p: any) => { if (h.createFails) throw Object.assign(new Error('x'), { code: h.createFails }); h.created.push(p); },
}));
vi.mock('../src/admin/parishStorage', () => ({
  uploadParishPhoto: async (id: string, blob: Blob) => {
    if (h.uploadFails) throw Object.assign(new Error('x'), { code: 'storage/unauthorized' });
    h.uploads.push([id, blob.size]); return 'https://firebasestorage.googleapis.com/v0/b/x/o/parishes%2F1.jpg';
  },
  removeParishPhoto: async (u: string) => { h.removed.push(u); },
}));
vi.mock('../src/lib/image', async () => {
  const real = await vi.importActual<any>('../src/lib/image');
  return { ...real, resizeImage: async () => h.resize() };
});

import ParishesAdminPage from '../src/admin/ParishesAdminPage';

const file = (type = 'image/png') => new File([new Uint8Array(5000)], 'p.png', { type });
const fill = (label: string | RegExp, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const fillRequired = () => {
  fill('City (English)', 'Wellington'); fill('City (Ελληνικά)', 'Ουέλλινγκτον');
  fill('Parish name (English)', 'Holy Trinity'); fill('Parish name (Ελληνικά)', 'Αγία Τριάδα');
  fill('Address (the same for English and Greek)', '5 Hania St\nNewtown');
};
const add = () => fireEvent.click(screen.getByRole('button', { name: 'Add parish' }));

beforeEach(() => {
  h.parishes = []; h.created = []; h.uploads = []; h.removed = []; h.createFails = ''; h.uploadFails = false;
  h.resize = () => ({ blob: new Blob([new Uint8Array(2048)]), width: 1024, height: 683 });
  (URL as any).createObjectURL = () => 'blob:preview';
  (URL as any).revokeObjectURL = () => {};
});
afterEach(cleanup);

describe('My page → Parishes', () => {
  it('has all the fields; the state list is New Zealand, Fiji, Tonga, Samoa', () => {
    render(<ParishesAdminPage />);
    const options = Array.from((screen.getByLabelText('State') as HTMLSelectElement).options).map(o => o.textContent);
    expect(options).toEqual(['New Zealand', 'Fiji', 'Tonga', 'Samoa']);
    for (const l of ['City (English)', 'City (Ελληνικά)', 'Parish name (English)', 'Parish name (Ελληνικά)',
      'Description (English), optional', 'Description (Ελληνικά), optional', 'Address (the same for English and Greek)', 'Location: Google Maps link, optional'])
      expect(screen.getByLabelText(l)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Photo: drop a picture here/ })).toBeTruthy();
    expect(screen.getByLabelText('Description (English), optional').tagName).toBe('TEXTAREA');
    const address = screen.getByLabelText('Address (the same for English and Greek)');
    expect(address.tagName).toBe('TEXTAREA');
    expect(screen.getAllByLabelText(/^Address/)).toHaveLength(1);      // one field, not one per language
    const order = Array.from(document.querySelectorAll('textarea, input[type=url]')).map(e => e.id);
    expect(order).toEqual(['pa-desc-en', 'pa-desc-el', 'pa-address', 'pa-map']);       // after the description
    expect(screen.getByLabelText('Parish name (Ελληνικά)').getAttribute('lang')).toBe('el');
  });
  it('adds a parish with only the required fields (no photo, no description, no map)', async () => {
    render(<ParishesAdminPage />);
    fillRequired();
    add();
    await screen.findByText('Parish "Holy Trinity" added.');
    expect(h.created).toHaveLength(1);
    expect(h.created[0]).toMatchObject({
      id: 'holy-trinity-wellington', state: 'nz', city: 'Wellington', cityEl: 'Ουέλλινγκτον',
      nameEn: 'Holy Trinity', nameEl: 'Αγία Τριάδα', address: '5 Hania St\nNewtown', descriptionEn: '', descriptionEl: '', mapUrl: '', photoURL: '', order: 1, visible: true,
    });
    expect(h.uploads).toEqual([]);
    expect((screen.getByLabelText('Parish name (English)') as HTMLInputElement).value).toBe('');   // form cleared
  });
  it('adds a parish with state, descriptions and a map link', async () => {
    render(<ParishesAdminPage />);
    fillRequired();
    fill('State', 'to');
    fill('Description (English), optional', 'Our church'); fill('Description (Ελληνικά), optional', 'Η εκκλησία μας');
    fill('Location: Google Maps link, optional', 'https://maps.app.goo.gl/abc');
    add();
    await screen.findByText(/added/);
    expect(h.created[0]).toMatchObject({ state: 'to', descriptionEn: 'Our church', descriptionEl: 'Η εκκλησία μας', mapUrl: 'https://maps.app.goo.gl/abc' });
  });
  it('needs the address', () => {
    render(<ParishesAdminPage />);
    fillRequired(); fill('Address (the same for English and Greek)', '   ');
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/enter the address/);
    expect(h.created).toEqual([]);
  });
  it('needs every required field, and says which one is missing', () => {
    render(<ParishesAdminPage />);
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/city in English/);
    fill('City (English)', 'W'); add();
    expect(screen.getByRole('alert').textContent).toMatch(/city in Greek/);
    expect(h.created).toEqual([]);
  });
  it('refuses a location that is not a Google Maps link', () => {
    render(<ParishesAdminPage />);
    fillRequired(); fill('Location: Google Maps link, optional', 'https://example.com/x');
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/Google Maps link/);
    expect(h.created).toEqual([]);
  });
  it('a dropped photo is shrunk, previewed, uploaded and saved with the parish', async () => {
    render(<ParishesAdminPage />);
    fillRequired();
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready: 1024 × 683 px, 2 KB/);
    expect(h.uploads).toEqual([]);                     // nothing is uploaded before Add parish
    add();
    await screen.findByText(/added/);
    expect(h.uploads).toEqual([['holy-trinity-wellington', 2048]]);
    expect(h.created[0].photoURL).toContain('firebasestorage.googleapis.com');
  });
  it('a photo can be removed again before saving', async () => {
    render(<ParishesAdminPage />);
    fillRequired();
    fireEvent.change(screen.getByLabelText('Choose a photo file'), { target: { files: [file('image/jpeg')] } });
    await screen.findByText(/Photo ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByText(/Photo ready/)).toBeNull();
    add();
    await screen.findByText(/added/);
    expect(h.uploads).toEqual([]);
    expect(h.created[0].photoURL).toBe('');
  });
  it('refuses a file that is not a picture', async () => {
    render(<ParishesAdminPage />);
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file('application/pdf')] } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/JPEG, PNG, WebP or GIF/);
  });
  it('if saving the parish fails after the upload, the uploaded photo is removed again', async () => {
    h.createFails = 'permission-denied';
    render(<ParishesAdminPage />);
    fillRequired();
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready/);
    add();
    expect((await screen.findByRole('alert')).textContent).toMatch(/not allowed/);
    expect(h.removed).toHaveLength(1);
    expect((screen.getByLabelText('Parish name (English)') as HTMLInputElement).value).toBe('Holy Trinity');   // form kept
  });
  it('a failed upload saves nothing', async () => {
    h.uploadFails = true;
    render(<ParishesAdminPage />);
    fillRequired();
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready/);
    add();
    expect((await screen.findByRole('alert')).textContent).toMatch(/photo could not be uploaded/);
    expect(h.created).toEqual([]);
  });
  it('a second parish with the same name and city gets its own id and the next order', async () => {
    h.parishes = [{ id: 'holy-trinity-wellington', slug: 'holy-trinity-wellington', nameEn: 'Holy Trinity', nameEl: 'Α', city: 'Wellington', state: 'nz', order: 5 }];
    render(<ParishesAdminPage />);
    fillRequired(); add();
    await screen.findByText(/added/);
    expect(h.created[0]).toMatchObject({ id: 'holy-trinity-wellington-2', order: 6 });
  });
  it('lists the parishes that exist, with city and state', () => {
    h.parishes = [{ id: 'a', slug: 'a', nameEn: 'St John', nameEl: 'Άγιος Ιωάννης', city: 'Suva', address: '12 Victoria Pde', state: 'fj', order: 1 }];
    render(<ParishesAdminPage />);
    expect(screen.getByText('St John')).toBeTruthy();
    expect(screen.getByText('Suva, Fiji')).toBeTruthy();
    expect(screen.getByText('12 Victoria Pde')).toBeTruthy();
    expect(screen.getByText('Parishes (1)')).toBeTruthy();
  });
  it('says when there are none yet', () => {
    render(<ParishesAdminPage />);
    expect(screen.getByText('No parishes yet.')).toBeTruthy();
  });
});
