// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({
  parishes: [] as any[],
  groups: [] as any[],
  days: [] as any[],
  months: [] as string[],
  deferParishes: false,
  parishCb: null as null | ((p: any[]) => void),
  failDays: false,
}));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: (p: any[]) => void) => {
    if (h.deferParishes) h.parishCb = cb; else cb(h.parishes);
    return () => {};
  },
  subscribeGroups: (cb: (g: any[]) => void) => { cb(h.groups); return () => {}; },
  subscribeServiceDaysForMonth: (ym: string, cb: (d: any[]) => void, onError?: (e: Error) => void) => {
    h.months.push(ym);
    if (h.failDays) onError?.(new Error('denied')); else cb(h.days.filter(d => d.yearMonth === ym));
    return () => {};
  },
}));

import { LangProvider } from '../src/contexts/LangContext';
import SchedulePage from '../src/pages/SchedulePage';

const parish = (id: string, nameEn: string, nameEl: string, over: any = {}) => ({
  id, slug: id, nameEn, nameEl, city: 'X', address: '', groupIds: [], accentColor: '#4B6B53', order: 0, visible: true, ...over,
});
const day = (parishId: string, date: string, entriesEn: string, entriesEl = '') =>
  ({ id: `${parishId}_${date}`, parishId, date, yearMonth: date.slice(0, 7), entriesEn, entriesEl });

const seen = { url: '' };
function Where() { const l = useLocation(); seen.url = l.pathname + l.search; return null; }
const mount = (path = '/services?month=2026-11&view=list') => render(
  <MemoryRouter initialEntries={[path]}><LangProvider><SchedulePage /><Where /></LangProvider></MemoryRouter>,
);
const cells = (c: HTMLElement) => c.querySelectorAll<HTMLElement>('.svc-cell[data-date]');
const cell = (c: HTMLElement, date: string) => c.querySelector<HTMLElement>(`.svc-cell[data-date="${date}"]`)!;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'en-NZ', configurable: true });
  h.parishes = [
    parish('holy-trinity', 'Holy Trinity, Wellington', 'Αγία Τριάδα, Γουέλλινγκτον', { groupIds: ['wgtn'], order: 1 }),
    parish('st-nectarios', 'St Nectarios, Auckland', 'Άγιος Νεκτάριος, Όκλαντ', { groupIds: ['akl'], order: 2 }),
    parish('st-andrew', 'St Andrew, Lower Hutt', 'Άγιος Ανδρέας, Λόουερ Χατ', { groupIds: ['wgtn'], order: 3 }),
    parish('closed', 'Closed Parish', 'Κλειστή', { visible: false }),
  ];
  h.groups = [
    { id: 'wgtn', slug: 'wellington', nameEn: 'Wellington group', nameEl: 'Ομάδα Γουέλλινγκτον', order: 1 },
    { id: 'akl', slug: 'auckland', nameEn: 'Auckland group', nameEl: 'Ομάδα Όκλαντ', order: 2 },
  ];
  h.days = [
    day('holy-trinity', '2026-11-22', '9:00 Orthros\n10:00 Divine Liturgy', '9:00 Όρθρος\n10:00 Θεία Λειτουργία'),
    day('st-andrew', '2026-11-22', '10:30 Divine Liturgy'),
    day('st-nectarios', '2026-11-25', '18:00 Great Vespers'),
    day('closed', '2026-11-22', 'Hidden service'),
    day('holy-trinity', '2026-12-06', '9:30 St Nicholas Liturgy'),
  ];
  h.months = [];
  h.deferParishes = false;
  h.parishCb = null;
  h.failDays = false;
  seen.url = '';
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('month', () => {
  it('defaults to the current month on a New Zealand clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T20:00:00Z'));   // already 1 December in NZ (UTC+13)
    mount('/services?view=list');
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(h.months).toEqual(['2026-12']);
  });
  it('uses ?month= and ignores a malformed one', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T00:00:00Z'));
    mount('/services?month=2027-02&view=list');
    expect(screen.getByRole('heading', { name: 'February 2027' })).toBeTruthy();
    cleanup();
    mount('/services?month=garbage&view=list');
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
  });
  it('moves between months, keeps the URL in step and can return to this month', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T00:00:00Z'));
    mount('/services');
    expect(screen.queryByRole('button', { name: 'This month' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(seen.url).toBe('/services?month=2026-12');
    expect(h.months.at(-1)).toBe('2026-12');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
    expect(seen.url).toBe('/services');
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
  });
  it('goes across the year end', () => {
    mount('/services?month=2026-12&view=list');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy();
  });
});

describe('List view', () => {
  it('is headed by the month, with the page heading in the hero band', () => {
    const { container } = mount();
    expect(container.querySelector('.hero h1')?.textContent).toBe('Calendar');
    expect(screen.getByText('Service Schedule for November 2026')).toBeTruthy();
    expect(container.querySelector('.svc-table')).toBeTruthy();
  });
  it('lists only days with a schedule, with each parish named and times in bold', () => {
    const { container } = mount();
    const rows = [...container.querySelectorAll('.svc-table tbody tr')].map(r => (r as HTMLElement).dataset.date);
    expect(rows).toEqual(['2026-11-22', '2026-11-25']);
    const sunday = container.querySelector('tr[data-date="2026-11-22"]') as HTMLElement;
    expect(within(sunday).getByText('Holy Trinity, Wellington')).toBeTruthy();
    expect(within(sunday).getByText('St Andrew, Lower Hutt')).toBeTruthy();
    expect([...sunday.querySelectorAll('strong')].map(s => s.textContent)).toEqual(
      expect.arrayContaining(['9:00', '10:00', '10:30']));
    expect(within(sunday).getByText('22 November')).toBeTruthy();
    expect(within(sunday).getByText('Sunday')).toBeTruthy();
  });
  it('never shows a hidden parish', () => {
    mount();
    expect(screen.queryByText(/Hidden service/)).toBeNull();
    expect(screen.queryByText('Closed Parish')).toBeNull();
  });
  it('shows the feast, any NZ holiday and the fast beside the date', () => {
    const { container } = mount('/services?month=2026-12&view=list');
    const xmasEve = container.querySelector('tr[data-date="2026-12-06"]') as HTMLElement;
    expect(within(xmasEve).getByText('St Nicholas, Archbishop of Myra')).toBeTruthy();
    expect(within(xmasEve).getByText('Fish allowed')).toBeTruthy();       // Nativity Fast, fish allowed on St Nicholas
    expect(xmasEve.querySelector('svg[data-fast="fish"]')).toBeTruthy();
  });
  it('says so when the month has no schedule, and offers every day', () => {
    h.days = [];
    const { container } = mount();
    expect(screen.getByText('No service schedule has been posted for this month yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all days' }));
    expect(container.querySelectorAll('.svc-table tbody tr')).toHaveLength(30);
    expect(screen.getByText('St Catherine the Great Martyr')).toBeTruthy();
  });
  it('can show all days and go back to posted days only', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Show all days' }));
    expect(container.querySelectorAll('.svc-table tbody tr')).toHaveLength(30);
    expect(container.querySelectorAll('.svc-none').length).toBe(28);
    fireEvent.click(screen.getByRole('button', { name: 'Show only days with services' }));
    expect(container.querySelectorAll('.svc-table tbody tr')).toHaveLength(2);
  });
  it('shows a load error instead of an empty month', () => {
    h.failDays = true;
    mount();
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/);
  });
  it('waits for the parish list before showing anything', () => {
    h.deferParishes = true;
    mount('/services?month=2026-11&parish=holy-trinity&view=list');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText(/No service schedule/)).toBeNull();
    act(() => h.parishCb!(h.parishes));
    expect(screen.getByText(/10:00/)).toBeTruthy();
  });
});

describe('scopes', () => {
  it('a group shows only its parishes', () => {
    const { container } = mount('/services?month=2026-11&group=wellington&view=list');
    const parishes = [...container.querySelectorAll('.svc-block__parish')].map(e => e.textContent);
    expect(parishes).toEqual(['Holy Trinity, Wellington', 'St Andrew, Lower Hutt']);
    expect(screen.queryByText(/Great Vespers/)).toBeNull();               // Auckland
  });
  it('a single parish shows no parish headings', () => {
    const { container } = mount('/services?month=2026-11&parish=st-nectarios&view=list');
    expect(screen.getByText(/Great Vespers/)).toBeTruthy();
    expect(container.querySelector('.svc-block__parish')).toBeNull();
    expect(screen.queryByText(/Orthros/)).toBeNull();
  });
  it('group chips, "All parishes" and the dropdown change the scope and keep the month and view', () => {
    mount('/services?month=2026-11&view=calendar');
    fireEvent.click(screen.getByRole('button', { name: 'Auckland group' }));
    expect(seen.url).toBe('/services?month=2026-11&view=calendar&group=auckland');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const names = [...select.options].map(o => o.text);
    expect(names).toContain('Holy Trinity, Wellington');
    expect(names).not.toContain('Closed Parish');
    fireEvent.change(select, { target: { value: 'st-andrew' } });
    expect(seen.url).toBe('/services?month=2026-11&view=calendar&parish=st-andrew');   // group is dropped
    fireEvent.click(screen.getByRole('button', { name: 'All parishes' }));
    expect(seen.url).toBe('/services?month=2026-11&view=calendar');
  });
  it('an unknown group or hidden parish shows nothing rather than everything', () => {
    mount('/services?month=2026-11&group=nope&view=list');
    expect(screen.getByText('No service schedule has been posted for this month yet.')).toBeTruthy();
    cleanup();
    mount('/services?month=2026-11&parish=closed&view=list');
    expect(screen.getByText('No service schedule has been posted for this month yet.')).toBeTruthy();
  });
});

describe('Calendar view', () => {
  const open = (path = '/services?month=2026-11&view=calendar') => mount(path);

  it('is the default view, and the page is called Calendar', () => {
    const { container } = mount('/services?month=2026-11');
    expect(container.querySelector('.hero h1')?.textContent).toBe('Calendar');
    expect(container.querySelector('.svc-cal')).toBeTruthy();
    expect(container.querySelector('.svc-table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Calendar' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('an unknown view falls back to the calendar; the old ?view=calendar links still work', () => {
    for (const v of ['view=calendar', 'view=nonsense', 'view=']) {
      const { container } = mount(`/services?month=2026-11&${v}`);
      expect(container.querySelector('.svc-cal')).toBeTruthy();
      cleanup();
    }
  });
  it('the toggle switches views and is kept in the URL (only the list is named)', () => {
    const { container } = mount('/services?month=2026-11');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(seen.url).toBe('/services?month=2026-11&view=list');
    expect(container.querySelector('.svc-table')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(seen.url).toBe('/services?month=2026-11');
    expect(container.querySelector('.svc-cal')).toBeTruthy();
  });
  it('keeps the chosen view when the month or the parish changes', () => {
    mount('/services?month=2026-11&view=list');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(seen.url).toBe('/services?month=2026-12&view=list');
  });
  it('the buttons are in the order Calendar, List', () => {
    mount('/services?month=2026-11');
    expect([...document.querySelectorAll('.svc-views button')].map(b => b.textContent)).toEqual(['Calendar', 'List']);
  });
  it('draws a Monday-first grid with every day of the month', () => {
    const { container } = open();
    expect(cells(container)).toHaveLength(30);
    expect([...container.querySelectorAll('[role="columnheader"]')].map(e => e.textContent)).toEqual(
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    // 1 November 2026 is a Sunday: six blanks before it; 36 cells are padded to 42.
    expect(container.querySelectorAll('.svc-cell--blank')).toHaveLength(12);
    const first = container.querySelector('.svc-cal__grid')!.children[6] as HTMLElement;
    expect(first.dataset.date).toBe('2026-11-01');
  });
  it('colours days by feast and marks fasting, posted schedules and NZ holidays', () => {
    const { container } = open('/services?month=2026-12&view=calendar');
    expect(cell(container, '2026-12-25').dataset.kind).toBe('nativity');
    expect(cell(container, '2026-12-08').dataset.kind).toBe('plain');
    expect(cell(container, '2026-12-27').dataset.kind).toBe('sunday');
    expect(cell(container, '2026-12-06').querySelector('svg[data-icon="church"]')).toBeTruthy();   // posted
    expect(cell(container, '2026-12-07').querySelector('svg[data-icon="church"]')).toBeNull();
    expect(cell(container, '2026-12-24').querySelector('svg[data-fast="strict"]')).toBeTruthy();
    expect(cell(container, '2026-12-26').querySelector('svg')).toBeNull();                          // fast-free: no icon
    expect(cell(container, '2026-12-25').querySelector('.svc-cell__nz')).toBeTruthy();              // Christmas Day
    expect(cell(container, '2026-12-28').querySelector('.svc-cell__nz')).toBeTruthy();              // Boxing Day observed
    expect(cell(container, '2026-12-10').querySelector('.svc-cell__nz')).toBeNull();
    expect(cell(container, '2026-12-25').querySelector('.svc-cell__feast')?.textContent).toBe('Nativity of Our Lo…');   // long names are cut in the cell; the panel has the full name
  });
  it('colours Greek Pascha, Holy Week and Bright Week (Pascha is 12 April 2026)', () => {
    const { container } = open('/services?month=2026-04&view=calendar');
    expect(cell(container, '2026-04-12').dataset.kind).toBe('pascha');
    expect(cell(container, '2026-04-08').dataset.kind).toBe('holyweek');
    expect(cell(container, '2026-04-14').dataset.kind).toBe('bright');
    expect(cell(container, '2026-04-05').dataset.kind).toBe('palm');
    expect(cell(container, '2026-04-10').querySelector('svg[data-fast="totalfast"]')).toBeTruthy();
  });
  it('gives every cell a spoken label with date, feast, fast and holiday', () => {
    const { container } = open('/services?month=2026-12&view=calendar');
    const label = cell(container, '2026-12-25').getAttribute('aria-label')!;
    expect(label).toMatch(/Friday 25 December 2026/);
    expect(label).toMatch(/Nativity of Our Lord/);
    expect(label).toMatch(/NZ public holiday|Christmas Day/);
  });
  it('opens a day panel on click and closes it on a second click', () => {
    const { container } = open();
    expect(container.querySelector('.svc-panel')).toBeNull();
    fireEvent.click(cell(container, '2026-11-25'));
    const panel = container.querySelector('.svc-panel') as HTMLElement;
    expect(within(panel).getByText('Wednesday 25 November 2026')).toBeTruthy();
    expect(within(panel).getByText(/St Catherine the Great Martyr/)).toBeTruthy();
    expect(within(panel).getByText('18:00')).toBeTruthy();
    expect(within(panel).getByText(/Great Vespers/)).toBeTruthy();
    expect(within(panel).getByText('St Nectarios, Auckland')).toBeTruthy();
    expect(within(panel).getByText(/Strict fast/)).toBeTruthy();
    expect(within(panel).getByText(/Nativity Fast/)).toBeTruthy();
    expect(cell(container, '2026-11-25').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(cell(container, '2026-11-25'));
    expect(container.querySelector('.svc-panel')).toBeNull();
  });
  it('shows the tone, and says so when nothing is posted for the day', () => {
    const { container } = open();
    fireEvent.click(cell(container, '2026-11-24'));
    const panel = container.querySelector('.svc-panel') as HTMLElement;
    expect(within(panel).getByText('No service schedule posted for this day yet.')).toBeTruthy();
    expect(within(panel).getByText(/^Tone \d$/)).toBeTruthy();
  });
  it('notes Greek national days and NZ holidays in the panel', () => {
    const { container } = open('/services?month=2026-03&view=calendar');
    fireEvent.click(cell(container, '2026-03-25'));
    const panel = container.querySelector('.svc-panel') as HTMLElement;
    expect(within(panel).getByText('Greek Independence Day')).toBeTruthy();
    expect(within(panel).getByText(/Annunciation of the Theotokos/)).toBeTruthy();
    expect(within(panel).getByText(/Fish allowed/)).toBeTruthy();
  });
  it('closes the panel when the month changes', () => {
    const { container } = open();
    fireEvent.click(cell(container, '2026-11-25'));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(container.querySelector('.svc-panel')).toBeNull();
  });
  it('has legends for the colours and the fasting icons', () => {
    const { container } = open();
    const legend = container.querySelector('.svc-cal')!.textContent!;
    ['Pascha', 'Great feast', 'Bright Week', 'Holy Week', 'Strict fast', 'Oil & wine allowed', 'Fish allowed', 'Total abstinence']
      .forEach(s => expect(legend).toContain(s));
    expect(screen.getByText(/your priest may direct otherwise/)).toBeTruthy();
  });
});

describe('Copy', () => {
  const stubClipboard = (write: any, writeText: any = vi.fn().mockResolvedValue(undefined)) => {
    (globalThis as any).ClipboardItem = class { constructor(public items: any) {} };
    Object.defineProperty(navigator, 'clipboard', { value: { write, writeText }, configurable: true });
    return writeText;
  };
  it('copies the table as HTML + text and says so', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    stubClipboard(write);
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(write.mock.calls[0][0][0].items).sort()).toEqual(['text/html', 'text/plain']);
    expect(screen.getByRole('button', { name: /Copied!/ })).toBeTruthy();
  });
  it('falls back to plain text, then reports a failure', async () => {
    const writeText = stubClipboard(vi.fn().mockRejectedValue(new Error('no')));
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Service Schedule for November 2026');
    expect(screen.getByRole('button', { name: /Copied!/ })).toBeTruthy();
    cleanup();

    stubClipboard(vi.fn().mockRejectedValue(new Error('no')), vi.fn().mockRejectedValue(new Error('no')));
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(screen.getByRole('alert').textContent).toMatch(/Could not copy/);
  });
});

describe('Greek', () => {
  beforeEach(() => localStorage.setItem('gp_lang', 'el'));
  it('shows Greek headings, month, parish names, group chips and the Greek schedule text', () => {
    const { container } = mount();
    expect(screen.getByRole('heading', { name: 'Ημερολόγιο' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Νοέμβριος 2026' })).toBeTruthy();
    expect(screen.getByText('Πρόγραμμα ακολουθιών — Νοέμβριος 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ομάδα Γουέλλινγκτον' })).toBeTruthy();
    const sunday = container.querySelector('tr[data-date="2026-11-22"]') as HTMLElement;
    expect(within(sunday).getByText('Αγία Τριάδα, Γουέλλινγκτον')).toBeTruthy();
    expect(within(sunday).getByText(/Θεία Λειτουργία/)).toBeTruthy();
    expect(within(sunday).getByText('22 Νοεμβρίου')).toBeTruthy();
    expect(within(sunday).getByText('Κυριακή')).toBeTruthy();
    expect(sunday.textContent).toContain('10:30 Divine Liturgy');           // no Greek text entered → English
  });
  it('shows Greek feast names, fasting labels and tones in the calendar', () => {
    const { container } = mount('/services?month=2026-11&view=calendar');
    expect([...container.querySelectorAll('[role="columnheader"]')][0].textContent).toBe('Δευ');
    fireEvent.click(cell(container, '2026-11-25'));
    const panel = container.querySelector('.svc-panel') as HTMLElement;
    expect(within(panel).getByText(/Αγία Αικατερίνη η Μεγαλομάρτυς/)).toBeTruthy();
    expect(within(panel).getByText(/Αυστηρή νηστεία/)).toBeTruthy();
    expect(within(panel).getByText(/^Ήχος /)).toBeTruthy();
    expect(within(panel).getByText('18:00')).toBeTruthy();
  });
  it('shows the Greek empty-month text', () => {
    h.days = [];
    mount();
    expect(screen.getByText('Δεν έχει αναρτηθεί ακόμη πρόγραμμα ακολουθιών για αυτόν τον μήνα.')).toBeTruthy();
  });
});

describe('Edit links (role hint)', () => {
  const setHint = (v: string | null) => { if (v) localStorage.setItem('gp_role', v); else localStorage.removeItem('gp_role'); };

  it('shows none to the public or to a plain user', () => {
    setHint('user');
    const { container } = mount('/services?month=2026-11&view=calendar');
    expect(screen.queryByRole('link', { name: 'Edit schedule' })).toBeNull();
    fireEvent.click(cell(container, '2026-11-22'));
    expect(screen.queryByRole('link', { name: 'Edit this day' })).toBeNull();
  });
  it('shows a toolbar link and a per-day link to a coordinator, keeping month and parish', () => {
    setHint('coordinator');
    const { container } = mount('/services?month=2026-11&view=calendar&parish=holy-trinity');
    expect(screen.getByRole('link', { name: 'Edit schedule' }).getAttribute('href'))
      .toBe('/admin/schedule?month=2026-11&parish=holy-trinity');
    fireEvent.click(cell(container, '2026-11-22'));
    expect(screen.getByRole('link', { name: 'Edit this day' }).getAttribute('href'))
      .toBe('/admin/schedule?month=2026-11&date=2026-11-22&parish=holy-trinity');
  });
  it('does not name a parish when several are shown', () => {
    setHint('admin');
    const { container } = mount('/services?month=2026-11&view=calendar');
    expect(screen.getByRole('link', { name: 'Edit schedule' }).getAttribute('href')).toBe('/admin/schedule?month=2026-11');
    fireEvent.click(cell(container, '2026-11-22'));
    expect(screen.getByRole('link', { name: 'Edit this day' }).getAttribute('href'))
      .toBe('/admin/schedule?month=2026-11&date=2026-11-22');
  });
  it('is available from the list view too, in Greek when the page is Greek', () => {
    setHint('superadmin');
    Object.defineProperty(navigator, 'language', { value: 'el-GR', configurable: true });
    mount('/services?month=2026-11');
    expect(screen.getByRole('link', { name: 'Επεξεργασία προγράμματος' })).toBeTruthy();
  });
});
