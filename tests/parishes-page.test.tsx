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
  it('lists visible parishes only, with city and address', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Parishes' })).toBeTruthy();
    expect(screen.getByText('Holy Trinity')).toBeTruthy();
    expect(screen.getByText('Wellington · 5 Hania St')).toBeTruthy();
    expect(screen.getByText('Auckland')).toBeTruthy();       // no address: just the city
    expect(screen.queryByText('Hidden')).toBeNull();
  });
  it('each parish links to its own schedule, with the slug safely encoded', () => {
    mount();
    expect(screen.getByRole('link', { name: /Holy Trinity/ }).getAttribute('href')).toBe('/services?parish=holy-trinity');
    expect(screen.getByRole('link', { name: /St Nectarios/ }).getAttribute('href')).toBe('/services?parish=st%20nect%261');
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
});
