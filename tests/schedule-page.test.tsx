// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  parishes: [] as any[],
  groups: [] as any[],
  services: [] as any[],
  calls: [] as { scope: any; from: string }[],
  deferParishes: false,
  parishCb: null as null | ((p: any[]) => void),
}));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => {
    if (h.deferParishes) h.parishCb = cb; else cb(h.parishes);
    return () => {};
  },
  subscribeGroups: (cb: (g: any[]) => void) => { cb(h.groups); return () => {}; },
  subscribeUpcomingServices: (scope: any, from: string, cb: (s: any[]) => void) => {
    h.calls.push({ scope, from });
    cb(h.services.filter(s => scope === 'all' || scope.includes(s.parishId)));
    return () => {};
  },
}));

import { LangProvider } from '../src/contexts/LangContext';
import SchedulePage from '../src/pages/SchedulePage';

const parish = (id: string, nameEn: string, nameEl: string, over: any = {}) => ({
  id, slug: id, nameEn, nameEl, city: 'X', address: '', groupIds: [], accentColor: '#4B6B53', order: 0, visible: true, ...over,
});
const svc = (id: string, parishId: string, titleEn: string, date = '2026-12-06', time = '09:00', over: any = {}) =>
  ({ id, parishId, date, time, titleEn, titleEl: '', notesEn: '', notesEl: '', updatedAt: null, ...over });

const mount = (url = '/services') => render(
  <MemoryRouter initialEntries={[url]}><LangProvider><SchedulePage /></LangProvider></MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
  h.parishes = [
    parish('holy-trinity', 'Holy Trinity, Wellington', 'Αγία Τριάδα, Γουέλλινγκτον', { groupIds: ['wgtn'], accentColor: '#4B6B53' }),
    parish('st-nectarios', 'St Nectarios, Auckland', 'Άγιος Νεκτάριος, Όκλαντ', { groupIds: ['akl'], accentColor: '#8B5E3C' }),
    parish('st-andrew', 'St Andrew, Lower Hutt', 'Άγιος Ανδρέας, Λόουερ Χατ', { groupIds: ['wgtn'] }),
    parish('closed', 'Closed Parish', 'Κλειστή', { visible: false }),
  ];
  h.groups = [
    { id: 'wgtn', slug: 'wellington', nameEn: 'Wellington group', nameEl: 'Ομάδα Γουέλλινγκτον', order: 1 },
    { id: 'akl', slug: 'auckland', nameEn: 'Auckland group', nameEl: 'Ομάδα Όκλαντ', order: 2 },
  ];
  h.services = [
    svc('s1', 'holy-trinity', 'Sunday Orthros & Liturgy', '2026-12-06', '09:00'),
    svc('s2', 'st-nectarios', 'Vespers', '2026-12-05', '17:00'),
    svc('s3', 'st-andrew', 'Divine Liturgy', '2026-12-06', '10:00'),
    svc('s4', 'closed', 'Hidden service', '2026-12-06', '11:00'),
  ];
  h.calls = [];
  h.deferParishes = false;
  h.parishCb = null;
});
afterEach(cleanup);

describe('scopes', () => {
  it('all parishes: shows every visible parish\'s services and asks for "all" from today', () => {
    mount();
    expect(screen.getByText(/Holy Trinity, Wellington — Sunday Orthros/)).toBeTruthy();
    expect(screen.getByText(/St Nectarios, Auckland — Vespers/)).toBeTruthy();
    expect(screen.getByText(/St Andrew, Lower Hutt — Divine Liturgy/)).toBeTruthy();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].scope).toBe('all');
    expect(h.calls[0].from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('never shows services of a hidden parish', () => {
    mount();
    expect(screen.queryByText(/Hidden service/)).toBeNull();
  });
  it('group: asks only for that group\'s parishes', () => {
    mount('/services?group=wellington');
    expect(h.calls.at(-1)!.scope).toEqual(['holy-trinity', 'st-andrew']);
    expect(screen.getByText(/Holy Trinity, Wellington —/)).toBeTruthy();
    expect(screen.getByText(/St Andrew, Lower Hutt —/)).toBeTruthy();
    expect(screen.queryByText(/St Nectarios, Auckland —/)).toBeNull();
  });
  it('single parish', () => {
    mount('/services?parish=st-nectarios');
    expect(h.calls.at(-1)!.scope).toEqual(['st-nectarios']);
    expect(screen.getByText(/St Nectarios, Auckland — Vespers/)).toBeTruthy();
    expect(screen.queryByText(/Holy Trinity, Wellington —/)).toBeNull();
  });
  it('an unknown group or hidden parish shows "no services" and does not fall back to everything', () => {
    mount('/services?group=nope');
    expect(screen.getByText('No upcoming services found.')).toBeTruthy();
    expect(h.calls).toHaveLength(0);
    cleanup();
    mount('/services?parish=closed');
    expect(screen.getByText('No upcoming services found.')).toBeTruthy();
    expect(h.calls).toHaveLength(0);
  });
  it('says so when a parish has no upcoming services', () => {
    h.services = [];
    mount();
    expect(screen.getByText('No upcoming services found.')).toBeTruthy();
  });
});

describe('choosing a scope', () => {
  it('group chips and "All parishes" switch the list', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Auckland group' }));
    expect(h.calls.at(-1)!.scope).toEqual(['st-nectarios']);
    expect(screen.queryByText(/Holy Trinity, Wellington —/)).toBeNull();
    expect(screen.getByText(/St Nectarios, Auckland —/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'All parishes' }));
    expect(h.calls.at(-1)!.scope).toBe('all');
    expect(screen.getByText(/Holy Trinity, Wellington —/)).toBeTruthy();
  });
  it('the parish dropdown lists visible parishes only and selects one', () => {
    mount();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const names = [...select.options].map(o => o.text);
    expect(names).toContain('Holy Trinity, Wellington');
    expect(names).not.toContain('Closed Parish');
    fireEvent.change(select, { target: { value: 'st-andrew' } });
    expect(h.calls.at(-1)!.scope).toEqual(['st-andrew']);
    expect(screen.queryByText(/Holy Trinity, Wellington —/)).toBeNull();
  });
});

describe('loading', () => {
  it('waits for the parish list before judging a ?parish= link', () => {
    h.deferParishes = true;
    mount('/services?parish=holy-trinity');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('No upcoming services found.')).toBeNull();
    act(() => h.parishCb!(h.parishes));
    expect(screen.getByText(/Holy Trinity, Wellington — Sunday Orthros/)).toBeTruthy();
  });
});

describe('layout hooks', () => {
  it('heading in the hero band, services in the card grid', () => {
    const { container } = mount();
    expect(container.querySelector('.hero h1')?.textContent).toBe('Services');
    expect(container.querySelector('.hero-sub')).toBeTruthy();
    expect(container.querySelectorAll('.page > .cards-grid > div')).toHaveLength(3);   // 3 visible parishes' services
  });
});

describe('details', () => {
  it('uses each parish\'s accent colour on its card', () => {
    mount();
    const bar = (text: RegExp) => screen.getByText(text).parentElement!.parentElement!.firstElementChild as HTMLElement; // title → text column → card → bar
    expect(bar(/Holy Trinity, Wellington —/).style.background).toBe('rgb(75, 107, 83)');     // #4B6B53
    expect(bar(/St Nectarios, Auckland —/).style.background).toBe('rgb(139, 94, 60)');     // #8B5E3C
  });
  it('shows the notes line when there is one', () => {
    h.services = [svc('n', 'holy-trinity', 'Great Vespers', '2026-12-05', '18:00', { notesEn: 'Followed by a talk' })];
    mount();
    expect(screen.getByText('Followed by a talk')).toBeTruthy();
  });
  it('shows services in the order Firestore returns them (date, then time)', () => {
    mount();
    const rows = screen.getAllByText(/ — /).map(e => e.textContent);
    expect(rows.indexOf('Holy Trinity, Wellington — Sunday Orthros & Liturgy')).toBeLessThan(rows.indexOf('St Nectarios, Auckland — Vespers'));
    // (the mock returns insertion order: the real ordering is done by the query, see rules.test.ts)
  });
});

describe('Greek', () => {
  beforeEach(() => localStorage.setItem('gp_lang', 'el'));
  it('shows Greek headings, parish names and group chips', () => {
    h.services = [svc('s1', 'holy-trinity', 'Sunday Liturgy', '2026-12-06', '09:00', { titleEl: 'Κυριακάτικη Θεία Λειτουργία' })];
    mount();
    expect(screen.getByRole('heading', { name: 'Ακολουθίες' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ομάδα Γουέλλινγκτον' })).toBeTruthy();
    expect(screen.getByText(/Αγία Τριάδα, Γουέλλινγκτον — Κυριακάτικη Θεία Λειτουργία/)).toBeTruthy();
  });
  it('falls back to the English title when no Greek title was entered', () => {
    mount();
    expect(screen.getByText(/Αγία Τριάδα, Γουέλλινγκτον — Sunday Orthros & Liturgy/)).toBeTruthy();
  });
  it('shows the Greek "no services" text', () => {
    h.services = [];
    mount();
    expect(screen.getByText('Δεν βρέθηκαν προσεχείς ακολουθίες.')).toBeTruthy();
  });
});
