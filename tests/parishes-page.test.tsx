// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ parishes: [] as any[] }));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => { cb(h.parishes); return () => {}; },
}));

import { LangProvider } from '../src/contexts/LangContext';
import ParishesPage from '../src/pages/ParishesPage';

const mount = () => render(<MemoryRouter><LangProvider><ParishesPage /></LangProvider></MemoryRouter>);

beforeEach(() => {
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
  it('each parish links to its own schedule, with the slug safely encoded', () => {
    mount();
    expect(screen.getByRole('link', { name: /Holy Trinity/ }).getAttribute('href')).toBe('/services?parish=holy-trinity');
    expect(screen.getByRole('link', { name: /St Nectarios/ }).getAttribute('href')).toBe('/services?parish=st%20nect%261');
  });
  it('uses the hero and full-width card grid classes', () => {
    const { container } = mount();
    expect(container.querySelector('.hero h1')?.textContent).toBe('Parishes');
    expect(container.querySelector('.page.cards-grid')).toBeTruthy();
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
      expect(screen.getByText('Suva · Fiji')).toBeTruthy();
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
      expect(screen.getByText('Σούβα · Φίτζι')).toBeTruthy();
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
      expect(screen.getByRole('link', { name: /St John/ }).getAttribute('href')).toBe('/services?parish=st-john');
      expect(screen.getByRole('link', { name: /St John/ }).querySelector('a')).toBeNull();
    });
  });
});
