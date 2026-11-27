// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ parishes: [] as any[], role: null as string | null, writes: [] as any[], fail: false }));
vi.mock('../src/hooks/useRoleHint', () => ({ useRoleHint: () => h.role }));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => { cb(h.parishes); return () => {}; },
  setParishOrder: async (items: any[]) => { if (h.fail) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); h.writes.push(items); },
}));

import { LangProvider } from '../src/contexts/LangContext';
import ParishesPage from '../src/pages/ParishesPage';

const mount = () => render(<MemoryRouter><LangProvider><ParishesPage /></LangProvider></MemoryRouter>);

beforeEach(() => {
  h.role = null; h.writes = []; h.fail = false;
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
  h.parishes = [
    { id: 'a', slug: 'holy-trinity', nameEn: 'Holy Trinity', nameEl: 'Αγία Τριάδα', city: 'Wellington', address: '5 Hania St', groupIds: [], accentColor: '#4B6B53', order: 1, visible: true },
    { id: 'b', slug: 'hidden', nameEn: 'Hidden', nameEl: 'Κρυφή', city: 'Nowhere', address: '', groupIds: [], accentColor: '', order: 2, visible: false },
    { id: 'c', slug: 'st nect&1', nameEn: 'St Nectarios', nameEl: 'Άγιος Νεκτάριος', city: 'Auckland', address: '', groupIds: [], accentColor: '', order: 3, visible: true },
  ];
});
afterEach(cleanup);

describe('Parishes page', () => {
  it('lists visible parishes only, with city and address (address under the description)', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Parishes' })).toBeTruthy();
    expect(screen.getByText('Holy Trinity')).toBeTruthy();
    expect(screen.getByText('Wellington')).toBeTruthy();
    expect(screen.getByText('5 Hania St')).toBeTruthy();
    expect(screen.getByText('Auckland')).toBeTruthy();       // no address: just the city
    expect(screen.queryByText('Hidden')).toBeNull();
  });
  it('each parish links to its own schedule as a list, with the slug safely encoded', () => {
    mount();
    expect(screen.getByRole('link', { name: /Holy Trinity/ }).getAttribute('href')).toBe('/services?parish=holy-trinity&view=list');
    expect(screen.getByRole('link', { name: /St Nectarios/ }).getAttribute('href')).toBe('/services?parish=st%20nect%261&view=list');
  });
  it('uses the hero and full-width card grid classes', () => {
    const { container } = mount();
    expect(container.querySelector('.hero h1')?.textContent).toBe('Parishes');
    expect(container.querySelector('.page .cards-grid')).toBeTruthy();
  });
  it('shows Greek names in Greek', () => {
    localStorage.setItem('gp_lang', 'el');
    mount();
    expect(screen.getByText('Αγία Τριάδα')).toBeTruthy();
    expect(screen.queryByText('Holy Trinity')).toBeNull();
  });
  it('shows an empty page without crashing when there are no parishes', () => {
    h.parishes = [];
    mount();
    expect(screen.getByRole('heading', { name: 'Parishes' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  describe('new parish fields', () => {
    const full = () => [{
      id: 'n', slug: 'st-john', nameEn: 'St John', nameEl: 'Άγιος Ιωάννης', city: 'Suva', cityEl: 'Σούβα', address: '12 Victoria Pde\nSuva',
      state: 'fj', descriptionEn: 'A small parish.', descriptionEl: 'Μια μικρή ενορία.',
      mapUrl: 'https://maps.app.goo.gl/abc', photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/p.jpg',
      groupIds: [], accentColor: '', order: 1, visible: true,
    }];
    it('shows city, state, description, photo and a map link in English', () => {
      h.parishes = full();
      const { container } = mount();
      expect(screen.getByText('Suva')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Fiji' })).toBeTruthy();
      expect(screen.getByText('A small parish.')).toBeTruthy();
      expect(container.querySelector('.pc-addr')?.textContent).toBe('12 Victoria Pde\nSuva');   // one address in both languages
      expect(container.querySelector('img.pc-photo')?.getAttribute('src')).toContain('firebasestorage.googleapis.com');
      const map = screen.getByRole('link', { name: 'View on map' });
      expect(map.getAttribute('href')).toBe('https://maps.app.goo.gl/abc');
      expect(map.getAttribute('rel')).toContain('noopener');
    });
    it('shows the Greek versions in Greek', () => {
      localStorage.setItem('gp_lang', 'el');
      h.parishes = full();
      mount();
      expect(screen.getByText('Σούβα')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Φίτζι' })).toBeTruthy();
      expect(screen.getByText('Μια μικρή ενορία.')).toBeTruthy();
      expect(screen.getByText(/12 Victoria Pde/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Δείτε στον χάρτη' })).toBeTruthy();
    });
    it('never shows a map link or photo from an address that is not allowed', () => {
      h.parishes = [{ ...full()[0], mapUrl: 'https://evil.example/x', photoURL: 'https://evil.example/p.jpg' }];
      const { container } = mount();
      expect(screen.queryByRole('link', { name: 'View on map' })).toBeNull();
      expect(container.querySelector('img')).toBeNull();
    });
    it('the card has one schedule link (the map link is separate, not nested)', () => {
      h.parishes = full();
      mount();
      expect(screen.getByRole('link', { name: /St John/ }).getAttribute('href')).toBe('/services?parish=st-john&view=list');
      expect(screen.getByRole('link', { name: /St John/ }).querySelector('a')).toBeNull();
    });
  });

  describe('admin buttons', () => {
    it.each(['admin', 'superadmin'])('a %s sees "Add parish" and an Edit link on every parish', role => {
      h.role = role;
      mount();
      expect(screen.getByRole('link', { name: 'Add parish' }).getAttribute('href')).toBe('/admin/parishes/new');
      const edits = screen.getAllByRole('link', { name: 'Edit' });
      expect(edits.map(a => a.getAttribute('href'))).toEqual(['/admin/parishes/a', '/admin/parishes/c']);   // visible parishes only
    });
    it.each([null, 'user', 'coordinator'])('%s sees no admin buttons', role => {
      h.role = role;
      mount();
      expect(screen.queryByRole('link', { name: 'Add parish' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    });
    it('the buttons are in Greek on the Greek site', () => {
      h.role = 'admin';
      localStorage.setItem('gp_lang', 'el');
      mount();
      expect(screen.getByRole('link', { name: 'Προσθήκη ενορίας' })).toBeTruthy();
      expect(screen.getAllByRole('link', { name: 'Επεξεργασία' })).toHaveLength(2);
    });
  });
});

describe('grouped by state', () => {
  const p = (id: string, nameEn: string, state: string | undefined, order: number, over: any = {}) =>
    ({ id, slug: id, nameEn, nameEl: nameEn + '-el', city: 'X', cityEl: 'Χ', address: '', state, groupIds: [], accentColor: '', order, visible: true, ...over });
  const headings = () => screen.getAllByRole('heading', { level: 2 }).map(x => x.textContent);
  const names = (section: string) => {
    const sec = screen.getByRole('heading', { name: section }).closest('section') as HTMLElement;
    return [...sec.querySelectorAll('.cards-grid > div')].map(c => c.querySelector('span[style*="font-weight"]')?.textContent);
  };
  beforeEach(() => {
    h.parishes = [
      p('ws1', 'Apia', 'ws', 1), p('nz2', 'Wellington', 'nz', 5), p('to1', 'Nuku', 'to', 2),
      p('fj1', 'Suva', 'fj', 3), p('nz1', 'Auckland', 'nz', 4), p('nz3', 'Christchurch', 'nz', 6),
      p('old', 'Old record', undefined, 7), p('odd', 'Odd', 'xx', 8), p('hid', 'Hidden NZ', 'nz', 0, { visible: false }),
    ];
  });

  it('lists New Zealand, Fiji, Tonga, Samoa, then Other, each with its own parishes in order', () => {
    mount();
    expect(headings()).toEqual(['New Zealand', 'Fiji', 'Tonga', 'Samoa', 'Other']);
    expect(names('New Zealand')).toEqual(['Auckland', 'Wellington', 'Christchurch']);
    expect(names('Other')).toEqual(['Old record', 'Odd']);
    expect(screen.queryByText('Hidden NZ')).toBeNull();
  });
  it('leaves out a state with no visible parishes, and the Other section when empty', () => {
    h.parishes = [p('nz1', 'Auckland', 'nz', 1), p('to1', 'Nuku', 'to', 2, { visible: false })];
    mount();
    expect(headings()).toEqual(['New Zealand']);
  });
  it('shows the state names in Greek', () => {
    localStorage.setItem('gp_lang', 'el');
    mount();
    expect(headings()).toEqual(['Νέα Ζηλανδία', 'Φίτζι', 'Τόνγκα', 'Σαμόα', 'Άλλες']);
  });
  it('shows no reorder buttons to the public, a user or a coordinator', () => {
    [null, 'user', 'coordinator'].forEach(role => {
      h.role = role; mount();
      expect(screen.queryByLabelText(/Move up/)).toBeNull();
      cleanup();
    });
  });

  describe('admin reordering', () => {
    beforeEach(() => { h.role = 'admin'; });
    const btn = (dir: 'up' | 'down', name: string) =>
      screen.getByLabelText(`Move ${dir}: ${name}`) as HTMLButtonElement;

    it('first parish of a state cannot go up, last cannot go down (also when alone in its state)', () => {
      mount();
      expect(btn('up', 'Auckland').disabled).toBe(true);
      expect(btn('down', 'Christchurch').disabled).toBe(true);
      expect(btn('up', 'Wellington').disabled).toBe(false);
      expect(btn('up', 'Suva').disabled).toBe(true);
      expect(btn('down', 'Suva').disabled).toBe(true);
    });
    it('moving down swaps the two order numbers and writes only those two', async () => {
      mount();
      await act(async () => { fireEvent.click(btn('down', 'Auckland')); });
      expect(h.writes).toEqual([[{ id: 'nz2', order: 4 }, { id: 'nz1', order: 5 }]]);
    });
    it('moving up works the same way, and other states are never touched', async () => {
      mount();
      await act(async () => { fireEvent.click(btn('up', 'Christchurch')); });
      expect(h.writes).toEqual([[{ id: 'nz3', order: 5 }, { id: 'nz2', order: 6 }]]);
    });
    it('the parishes move on screen when the list comes back in the new order', () => {
      h.parishes = h.parishes.map(x => x.id === 'nz1' ? { ...x, order: 5 } : x.id === 'nz2' ? { ...x, order: 4 } : x);
      mount();
      expect(names('New Zealand')).toEqual(['Wellington', 'Auckland', 'Christchurch']);
    });
    it('says so when the change is refused, and the buttons work again', async () => {
      mount();
      h.fail = true;
      await act(async () => { fireEvent.click(btn('down', 'Auckland')); });
      expect(screen.getByRole('alert').textContent).toBe('Could not change the order. (permission-denied)');
      expect(btn('down', 'Auckland').disabled).toBe(false);
      h.fail = false;
      await act(async () => { fireEvent.click(btn('down', 'Auckland')); });
      expect(screen.queryByRole('alert')).toBeNull();
    });
    it('the buttons are labelled in Greek in Greek', () => {
      localStorage.setItem('gp_lang', 'el');
      mount();
      expect(screen.getByLabelText('Μετακίνηση πάνω: Wellington-el')).toBeTruthy();
    });
  });
});

describe('favourites', () => {
  const p = (id: string, nameEn: string, state: string, order: number, over: any = {}) =>
    ({ id, slug: id, nameEn, nameEl: nameEn + '-el', city: nameEn + ' city', cityEl: nameEn + ' πόλη', address: '', state, groupIds: [], accentColor: '', order, visible: true, ...over });
  beforeEach(() => {
    h.parishes = [
      p('n1', 'Auckland', 'nz', 1), p('n2', 'Wellington', 'nz', 2), p('n3', 'Christchurch', 'nz', 3),
      p('f1', 'Suva', 'fj', 4), p('t1', 'Nuku', 'to', 5), p('hid', 'Hidden', 'nz', 6, { visible: false }),
    ];
  });
  const headings = () => screen.getAllByRole('heading', { level: 2 }).map(x => x.textContent);
  const cardNames = (heading: string) => {
    const sec = screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;
    return [...sec.querySelectorAll('.cards-grid > div')].map(c => c.querySelector('span[style*="font-weight"]')?.textContent);
  };
  const star = (name: string) => screen.getByLabelText(new RegExp(`favourites: ${name}$`)) as HTMLButtonElement;

  it('a new visitor sees a hint, every card has an empty star, and no Favourites section', () => {
    mount();
    expect(headings()).toEqual(['New Zealand', 'Fiji', 'Tonga']);
    expect(screen.getByText(/Tap the star on a parish/)).toBeTruthy();
    expect(star('Auckland').getAttribute('aria-pressed')).toBe('false');
    expect(star('Auckland').textContent).toBe('☆');
    expect(screen.queryByLabelText(/favourites: Hidden/)).toBeNull();
  });
  it('starring a parish moves it into a Favourites section at the top, and takes it out of its state', () => {
    mount();
    fireEvent.click(star('Wellington'));
    expect(headings()).toEqual(['★ Favourites', 'New Zealand', 'Fiji', 'Tonga']);
    expect(cardNames('★ Favourites')).toEqual(['Wellington']);
    expect(cardNames('New Zealand')).toEqual(['Auckland', 'Christchurch']);
    expect(screen.queryByText(/Tap the star on a parish/)).toBeNull();
    expect(JSON.parse(localStorage.getItem('gp_fav_parishes')!)).toEqual(['n2']);
    expect(star('Wellington').getAttribute('aria-pressed')).toBe('true');
    expect(star('Wellington').textContent).toBe('★');
  });
  it('favourites from several states are ordered by state, then the usual order, and name their state', () => {
    mount();
    fireEvent.click(star('Nuku')); fireEvent.click(star('Suva')); fireEvent.click(star('Christchurch')); fireEvent.click(star('Auckland'));
    expect(cardNames('★ Favourites')).toEqual(['Auckland', 'Christchurch', 'Suva', 'Nuku']);
    const sec = screen.getByRole('heading', { name: '★ Favourites' }).closest('section') as HTMLElement;
    expect(sec.textContent).toContain('Suva city · Fiji');
    expect(sec.textContent).toContain('Auckland city · New Zealand');
    expect(headings()).toEqual(['★ Favourites', 'New Zealand']);        // Fiji and Tonga are now empty and disappear
    expect(cardNames('New Zealand')).toEqual(['Wellington']);
  });
  it('un-starring puts the parish back in its state, in its usual place', () => {
    mount();
    fireEvent.click(star('Wellington'));
    fireEvent.click(star('Wellington'));
    expect(headings()).toEqual(['New Zealand', 'Fiji', 'Tonga']);
    expect(cardNames('New Zealand')).toEqual(['Auckland', 'Wellington', 'Christchurch']);
    expect(localStorage.getItem('gp_fav_parishes')).toBeNull();
  });
  it('remembers favourites after a reload, and ignores ones that no longer exist or are hidden', () => {
    localStorage.setItem('gp_fav_parishes', JSON.stringify(['f1', 'gone', 'hid']));
    mount();
    expect(headings()).toEqual(['★ Favourites', 'New Zealand', 'Tonga']);
    expect(cardNames('★ Favourites')).toEqual(['Suva']);
  });
  it('a change made in another tab shows up here', () => {
    mount();
    act(() => { localStorage.setItem('gp_fav_parishes', JSON.stringify(['t1'])); window.dispatchEvent(new StorageEvent('storage', { key: 'gp_fav_parishes' })); });
    expect(cardNames('★ Favourites')).toEqual(['Nuku']);
  });
  it('the star does not open the parish, and the card link still goes to its schedule', () => {
    mount();
    expect(star('Auckland').closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: /Auckland/ }).getAttribute('href')).toBe('/services?parish=n1&view=list');
  });
  it('is the same for signed-in people: it needs no role', () => {
    h.role = 'user';
    mount();
    fireEvent.click(star('Suva'));
    expect(cardNames('★ Favourites')).toEqual(['Suva']);
  });
  it('is in Greek in Greek', () => {
    localStorage.setItem('gp_lang', 'el');
    localStorage.setItem('gp_fav_parishes', JSON.stringify(['n1']));
    mount();
    expect(headings()[0]).toBe('★ Αγαπημένες');
    expect(screen.getByLabelText('Αφαίρεση από τα αγαπημένα: Auckland-el')).toBeTruthy();
    expect(screen.getByLabelText('Προσθήκη στα αγαπημένα: Wellington-el')).toBeTruthy();
  });
  it('admins: no move buttons on favourites (that list mixes states), still on the rest, and Edit stays', async () => {
    h.role = 'admin';
    localStorage.setItem('gp_fav_parishes', JSON.stringify(['n2']));
    mount();
    expect(screen.queryByLabelText('Move up: Wellington')).toBeNull();
    expect(screen.getByLabelText('Move down: Auckland')).toBeTruthy();
    expect(screen.getByLabelText('Move up: Christchurch')).toBeTruthy();
    const fav = screen.getByRole('heading', { name: '★ Favourites' }).closest('section') as HTMLElement;
    expect(fav.querySelector('a.pc-edit')).toBeTruthy();
    // moving works among the parishes shown in the state: Auckland and Christchurch swap places
    await act(async () => { fireEvent.click(screen.getByLabelText('Move down: Auckland')); });
    expect(h.writes).toEqual([[{ id: 'n3', order: 1 }, { id: 'n1', order: 3 }]]);
  });
  it('shows no hint when there are no parishes at all', () => {
    h.parishes = [];
    mount();
    expect(screen.queryByText(/Tap the star/)).toBeNull();
  });
});

