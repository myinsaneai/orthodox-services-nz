// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({
  parishes: [] as any[], created: [] as any[], updated: [] as any[], deleted: [] as string[], tidied: [] as any[],
  uploads: [] as any[], removed: [] as string[], deleteFails: false,
  createFails: '' as string, uploadFails: false, resize: null as any,
}));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => { cb(h.parishes); return () => {}; },
  createParish: async (p: any) => { if (h.createFails) throw Object.assign(new Error('x'), { code: h.createFails }); h.created.push(p); },
  updateParish: async (p: any) => { if (h.createFails) throw Object.assign(new Error('x'), { code: h.createFails }); h.updated.push(p); },
  deleteParishAndServices: async (id: string) => { if (h.deleteFails) throw Object.assign(new Error('x'), { code: 'permission-denied' }); h.deleted.push(id); },
}));
vi.mock('../src/admin/parishStorage', () => ({
  uploadParishPhoto: async (id: string, blob: Blob) => {
    if (h.uploadFails) throw Object.assign(new Error('x'), { code: 'storage/unauthorized' });
    h.uploads.push([id, blob.size]); return 'https://firebasestorage.googleapis.com/v0/b/x/o/parishes%2F1.jpg';
  },
  removeParishPhoto: async (u: string) => { h.removed.push(u); },
  removeParishPhotos: async (id: string, keep = '') => { h.tidied.push([id, keep]); },
}));
vi.mock('../src/lib/image', async () => {
  const real = await vi.importActual<any>('../src/lib/image');
  return { ...real, resizeImage: async () => h.resize() };
});

import ParishesAdminPage from '../src/admin/ParishesAdminPage';

// The page at /admin/parishes/new or /admin/parishes/<id>; "/parishes" stands for the public page.
const render = (_ui?: unknown, path = '/admin/parishes/new') => rtlRender(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/parishes/new" element={<ParishesAdminPage />} />
      <Route path="/admin/parishes/:id" element={<ParishesAdminPage />} />
      <Route path="/parishes" element={<p>public parishes page</p>} />
    </Routes>
  </MemoryRouter>,
);
const Page = null;

const file = (type = 'image/png') => new File([new Uint8Array(5000)], 'p.png', { type });
const fill = (label: string | RegExp, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const fillRequired = () => {
  fill('City (English)', 'Wellington'); fill('City (Ελληνικά)', 'Ουέλλινγκτον');
  fill('Parish name (English)', 'Holy Trinity'); fill('Parish name (Ελληνικά)', 'Αγία Τριάδα');
  fill('Address (the same for English and Greek)', '5 Hania St\nNewtown');
};
const add = () => fireEvent.click(screen.getByRole('button', { name: 'Add parish' }));

beforeEach(() => {
  h.parishes = []; h.created = []; h.updated = []; h.deleted = []; h.tidied = []; h.deleteFails = false; h.uploads = []; h.removed = []; h.createFails = ''; h.uploadFails = false;
  h.resize = () => ({ blob: new Blob([new Uint8Array(2048)]), width: 1024, height: 683 });
  (URL as any).createObjectURL = () => 'blob:preview';
  (URL as any).revokeObjectURL = () => {};
});
afterEach(cleanup);

describe('Add a parish', () => {
  it('has all the fields; the state list is New Zealand, Fiji, Tonga, Samoa', () => {
    render(Page);
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
    render(Page);
    fillRequired();
    add();
    await screen.findByText('public parishes page');          // back on the Parishes page
    expect(h.created).toHaveLength(1);
    expect(h.created[0]).toMatchObject({
      id: 'holy-trinity-wellington', state: 'nz', city: 'Wellington', cityEl: 'Ουέλλινγκτον',
      nameEn: 'Holy Trinity', nameEl: 'Αγία Τριάδα', address: '5 Hania St\nNewtown', descriptionEn: '', descriptionEl: '', mapUrl: '', photoURL: '', order: 1, visible: true,
    });
    expect(h.uploads).toEqual([]);
  });
  it('adds a parish with state, descriptions and a map link', async () => {
    render(Page);
    fillRequired();
    fill('State', 'to');
    fill('Description (English), optional', 'Our church'); fill('Description (Ελληνικά), optional', 'Η εκκλησία μας');
    fill('Location: Google Maps link, optional', 'https://maps.app.goo.gl/abc');
    add();
    await screen.findByText('public parishes page');
    expect(h.created[0]).toMatchObject({ state: 'to', descriptionEn: 'Our church', descriptionEl: 'Η εκκλησία μας', mapUrl: 'https://maps.app.goo.gl/abc' });
  });
  it('needs the address', () => {
    render(Page);
    fillRequired(); fill('Address (the same for English and Greek)', '   ');
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/enter the address/);
    expect(h.created).toEqual([]);
  });
  it('needs every required field, and says which one is missing', () => {
    render(Page);
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/city in English/);
    fill('City (English)', 'W'); add();
    expect(screen.getByRole('alert').textContent).toMatch(/city in Greek/);
    expect(h.created).toEqual([]);
  });
  it('refuses a location that is not a Google Maps link', () => {
    render(Page);
    fillRequired(); fill('Location: Google Maps link, optional', 'https://example.com/x');
    add();
    expect(screen.getByRole('alert').textContent).toMatch(/Google Maps link/);
    expect(h.created).toEqual([]);
  });
  it('a dropped photo is shrunk, previewed, uploaded and saved with the parish', async () => {
    render(Page);
    fillRequired();
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready: 1024 × 683 px, 2 KB/);
    expect(h.uploads).toEqual([]);                     // nothing is uploaded before Add parish
    add();
    await screen.findByText('public parishes page');
    expect(h.uploads).toEqual([['holy-trinity-wellington', 2048]]);
    expect(h.created[0].photoURL).toContain('firebasestorage.googleapis.com');
  });
  it('a photo can be removed again before saving', async () => {
    render(Page);
    fillRequired();
    fireEvent.change(screen.getByLabelText('Choose a photo file'), { target: { files: [file('image/jpeg')] } });
    await screen.findByText(/Photo ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByText(/Photo ready/)).toBeNull();
    add();
    await screen.findByText('public parishes page');
    expect(h.uploads).toEqual([]);
    expect(h.created[0].photoURL).toBe('');
  });
  it('refuses a file that is not a picture', async () => {
    render(Page);
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file('application/pdf')] } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/JPEG, PNG, WebP or GIF/);
  });
  it('if saving the parish fails after the upload, the uploaded photo is removed again', async () => {
    h.createFails = 'permission-denied';
    render(Page);
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
    render(Page);
    fillRequired();
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready/);
    add();
    expect((await screen.findByRole('alert')).textContent).toMatch(/photo could not be uploaded/);
    expect(h.created).toEqual([]);
  });
  it('a second parish with the same name and city gets its own id and the next order', async () => {
    h.parishes = [{ id: 'holy-trinity-wellington', slug: 'holy-trinity-wellington', nameEn: 'Holy Trinity', nameEl: 'Α', city: 'Wellington', state: 'nz', order: 5 }];
    render(Page);
    fillRequired(); add();
    await screen.findByText('public parishes page');
    expect(h.created[0]).toMatchObject({ id: 'holy-trinity-wellington-2', order: 6 });
  });
});

describe('Edit and delete a parish', () => {
  const existing = () => ({
    id: 'st-john-suva', slug: 'st-john-suva', state: 'fj', nameEn: 'St John', nameEl: 'Άγιος Ιωάννης', city: 'Suva', cityEl: 'Σούβα',
    address: '12 Victoria Pde', descriptionEn: 'Small.', descriptionEl: 'Μικρή.', mapUrl: 'https://maps.app.goo.gl/x',
    photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/parishes%2Fst-john-suva%2F1.jpg',
    groupIds: ['g1'], accentColor: '#123456', order: 7, visible: true,
  });
  const open = () => { h.parishes = [existing()]; return render(Page, '/admin/parishes/st-john-suva'); };
  const val = (l: string) => (screen.getByLabelText(l) as HTMLInputElement).value;

  it('opens with the parish filled in', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    expect(val('State')).toBe('fj');
    expect(val('City (Ελληνικά)')).toBe('Σούβα');
    expect(val('Address (the same for English and Greek)')).toBe('12 Victoria Pde');
    expect(val('Description (Ελληνικά), optional')).toBe('Μικρή.');
    expect(val('Location: Google Maps link, optional')).toBe('https://maps.app.goo.gl/x');
    expect(screen.getByRole('heading', { name: 'Edit parish' })).toBeTruthy();
    expect(screen.getByAltText('Parish photo').getAttribute('src')).toContain('parishes%2Fst-john-suva');
  });
  it('saves changes, keeping id, slug, order, groups, colour and visibility', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fill('Parish name (English)', 'St John the Baptist'); fill('State', 'ws');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('public parishes page');
    expect(h.created).toEqual([]);
    expect(h.updated).toEqual([{ ...existing(), nameEn: 'St John the Baptist', state: 'ws' }]);
    expect(h.tidied).toEqual([]);                      // the photo was not touched
  });
  it('checks the form on save, like when adding', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fill('Address (the same for English and Greek)', ' ');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert').textContent).toMatch(/enter the address/);
    expect(h.updated).toEqual([]);
  });
  it('a new photo replaces the old one, and the old files are tidied up', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fireEvent.drop(screen.getByRole('button', { name: /Photo: drop a picture here/ }), { dataTransfer: { files: [file()] } });
    await screen.findByText(/Photo ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('public parishes page');
    expect(h.uploads).toEqual([['st-john-suva', 2048]]);
    expect(h.updated[0].photoURL).toContain('parishes%2F1.jpg');
    expect(h.tidied).toEqual([['st-john-suva', h.updated[0].photoURL]]);
  });
  it('Remove photo clears the photo on save and deletes its files', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.getByText(/will be removed when you press Save/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('public parishes page');
    expect(h.updated[0].photoURL).toBe('');
    expect(h.tidied).toEqual([['st-john-suva', '']]);
  });
  it('Delete asks first, and "Keep it" cancels', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete parish' }));
    expect(screen.getByRole('alertdialog').textContent).toMatch(/all of its services/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.deleted).toEqual([]);
  });
  it('confirmed Delete removes the parish with its services and photo files, then returns to Parishes', async () => {
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete parish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete this parish' }));
    await screen.findByText('public parishes page');
    expect(h.deleted).toEqual(['st-john-suva']);
    expect(h.tidied).toEqual([['st-john-suva', '']]);
  });
  it('a refused delete shows a message and stays on the page', async () => {
    h.deleteFails = true;
    open();
    await waitFor(() => expect(val('Parish name (English)')).toBe('St John'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete parish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete this parish' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not allowed/);
    expect(h.tidied).toEqual([]);
  });
  it('an unknown parish says so, with a way back', async () => {
    h.parishes = [];
    render(Page, '/admin/parishes/nope');
    expect(await screen.findByRole('heading', { name: 'Parish not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Parishes' }).getAttribute('href')).toBe('/parishes');
  });
  it('there is no Delete button when adding', () => {
    render(Page);
    expect(screen.queryByRole('button', { name: 'Delete parish' })).toBeNull();
  });
});
