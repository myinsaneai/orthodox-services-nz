// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({
  role: 'admin' as string,
  mine: 'all' as 'all' | string[],
  parishes: [] as any[],
  days: [] as any[],
  templates: [] as any[],
  entryTypes: [] as any[],
  libFail: false,
  months: [] as string[],
  saved: [] as any[],
  deleted: [] as any[],
  saveError: null as any,
}));
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    role: h.role,
    canEditParish: (id: string) => h.mine === 'all' || h.mine.includes(id),
  }),
}));
vi.mock('../src/lib/firestore', () => ({
  subscribeParishes: (cb: any) => { cb(h.parishes); return () => {}; },
  subscribeServiceDaysForMonth: (ym: string, cb: any) => { h.months.push(ym); cb(h.days.filter(d => d.yearMonth === ym)); return () => {}; },
  subscribeServiceTemplates: (cb: any, onError: any) => { if (h.libFail) onError(new Error('x')); else cb(h.templates); return () => {}; },
  subscribeServiceEntryTypes: (cb: any, onError: any) => { if (h.libFail) onError(new Error('x')); else cb(h.entryTypes); return () => {}; },
  saveServiceDay: async (...a: any[]) => { if (h.saveError) throw h.saveError; h.saved.push(a); },
  deleteServiceDay: async (...a: any[]) => { if (h.saveError) throw h.saveError; h.deleted.push(a); },
}));

import { LangProvider } from '../src/contexts/LangContext';
import ScheduleEditorPage from '../src/admin/ScheduleEditorPage';

const parish = (id: string, nameEn: string, over: any = {}) => ({
  id, slug: id, nameEn, nameEl: nameEn, city: '', address: '', groupIds: [], accentColor: '#000', order: 0, visible: true, ...over,
});
const day = (parishId: string, date: string, entriesEn: string, entriesEl = '') =>
  ({ id: `${parishId}_${date}`, parishId, date, yearMonth: date.slice(0, 7), entriesEn, entriesEl });

const seen = { url: '' };
function Where() { const l = useLocation(); seen.url = l.pathname + l.search; return null; }
const mount = (path = '/admin/schedule?month=2026-11') => render(
  <MemoryRouter initialEntries={[path]}><LangProvider><ScheduleEditorPage /><Where /></LangProvider></MemoryRouter>,
);
const cell = (c: HTMLElement, date: string) => c.querySelector<HTMLElement>(`.svc-cell[data-date="${date}"]`)!;
const en = () => screen.getByLabelText('English') as HTMLTextAreaElement;
const el = () => screen.getByLabelText('Ελληνικά (Greek)') as HTMLTextAreaElement;
const type = (box: HTMLTextAreaElement, v: string) => fireEvent.change(box, { target: { value: v } });

beforeEach(() => {
  localStorage.clear();
  h.role = 'admin'; h.mine = 'all';
  h.parishes = [
    parish('ht', 'Holy Trinity', { order: 1 }),
    parish('sn', 'St Nectarios', { order: 2 }),
    parish('closed', 'Closed Parish', { order: 3, visible: false }),
  ];
  h.days = [
    day('ht', '2026-11-22', '9:00 Orthros\n10:00 Liturgy', '9:00 Όρθρος'),
    day('sn', '2026-11-22', 'Nectarios only'),
    day('closed', '2026-11-25', '18:00 Hidden parish vespers'),
    day('ht', '2026-12-06', 'December'),
  ];
  h.templates = [
    { id: 't1', nameEn: 'Sunday', nameEl: 'Κυριακή', entriesEn: '9:00 Orthros\n10:00 Divine Liturgy', entriesEl: '9:00 Όρθρος\n10:00 Θεία Λειτουργία', order: 0 },
    { id: 't2', nameEn: 'Great Feast', nameEl: 'Μεγάλη Εορτή', entriesEn: '8:00 Feast', entriesEl: '8:00 Εορτή', order: 1 },
  ];
  h.entryTypes = [{ id: 'e1', textEn: '18:00 Vespers', textEl: '18:00 Εσπερινός', order: 0 }];
  h.libFail = false; h.months = []; h.saved = []; h.deleted = []; h.saveError = null; seen.url = '';
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('who and what', () => {
  it('an admin may pick any parish, hidden ones marked', () => {
    mount();
    const sel = screen.getByLabelText('Parish') as HTMLSelectElement;
    expect([...sel.options].map(o => o.text)).toEqual(['Holy Trinity', 'St Nectarios', 'Closed Parish (hidden)']);
    expect(screen.getByRole('link', { name: /Templates/ }).getAttribute('href')).toBe('/admin/templates');
  });
  it('a coordinator gets only their own parishes, and no link to the templates', () => {
    h.role = 'coordinator'; h.mine = ['sn'];
    mount();
    const sel = screen.getByLabelText('Parish') as HTMLSelectElement;
    expect([...sel.options].map(o => o.text)).toEqual(['St Nectarios']);
    expect(screen.queryByRole('link', { name: /Templates/ })).toBeNull();
  });
  it('a coordinator with no parish is told what to do', () => {
    h.role = 'coordinator'; h.mine = [];
    mount();
    expect(screen.getByText(/No parish has been assigned to you yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Parish')).toBeNull();
  });
  it('shows only the chosen parish\'s days in the calendar, and follows the parish picker', () => {
    const { container } = mount();
    expect(cell(container, '2026-11-22').querySelector('svg[data-icon="church"]')).toBeTruthy();
    fireEvent.click(cell(container, '2026-11-22'));
    expect(en().value).toBe('9:00 Orthros\n10:00 Liturgy');
    expect(el().value).toBe('9:00 Όρθρος');
    fireEvent.change(screen.getByLabelText('Parish'), { target: { value: 'sn' } });
    expect(seen.url).toContain('parish=sn');
    expect(container.querySelector('.svc-panel')).toBeNull();               // selection is cleared
    fireEvent.click(cell(container, '2026-11-22'));
    expect(en().value).toBe('Nectarios only');
    expect(cell(container, '2026-11-25').querySelector('svg[data-icon="church"]')).toBeNull();
  });
  it('can edit a hidden parish (it still shows its days)', () => {
    const { container } = mount('/admin/schedule?month=2026-11&parish=closed');
    expect(cell(container, '2026-11-25').querySelector('svg[data-icon="church"]')).toBeTruthy();
  });
  it('an unknown parish in the URL falls back to the first one', () => {
    mount('/admin/schedule?month=2026-11&parish=nope');
    expect((screen.getByLabelText('Parish') as HTMLSelectElement).value).toBe('ht');
  });
  it('opens the day named in the URL', () => {
    const { container } = mount('/admin/schedule?month=2026-11&date=2026-11-22&parish=ht');
    expect(within(container.querySelector('.svc-panel') as HTMLElement).getByText('Sunday 22 November 2026')).toBeTruthy();
    expect(en().value).toContain('9:00 Orthros');
  });
  it('ignores a date outside the month', () => {
    const { container } = mount('/admin/schedule?month=2026-11&date=2026-12-06');
    expect(container.querySelector('.svc-panel')).toBeNull();
  });
  it('moves between months, closing the editor', () => {
    const { container } = mount();
    fireEvent.click(cell(container, '2026-11-22'));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(seen.url).toContain('month=2026-12');
    expect(container.querySelector('.svc-panel')).toBeNull();
    expect(h.months.at(-1)).toBe('2026-12');
  });
  it('links to the public page for the same parish and month', () => {
    mount();
    expect(screen.getByRole('link', { name: 'View public page' }).getAttribute('href'))
      .toBe('/services?month=2026-11&view=calendar&parish=ht');
  });
});

describe('editing a day', () => {
  const open = (date = '2026-11-24') => {
    const r = mount();
    fireEvent.click(cell(r.container, date));
    return r;
  };

  it('fills both boxes from a full-day template, and adds single entries to both', () => {
    open();
    expect(en().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Sunday' }));
    expect(en().value).toBe('9:00 Orthros\n10:00 Divine Liturgy');
    expect(el().value).toBe('9:00 Όρθρος\n10:00 Θεία Λειτουργία');
    fireEvent.click(screen.getByRole('button', { name: '+ 18:00 Vespers' }));
    expect(en().value).toBe('9:00 Orthros\n10:00 Divine Liturgy\n18:00 Vespers');
    expect(el().value).toBe('9:00 Όρθρος\n10:00 Θεία Λειτουργία\n18:00 Εσπερινός');
    fireEvent.click(screen.getByRole('button', { name: 'Great Feast' }));          // replaces
    expect(en().value).toBe('8:00 Feast');
  });
  it('offers no template buttons when there are none', () => {
    h.templates = []; h.entryTypes = [];
    open();
    expect(screen.queryByText(/Apply a full-day template/)).toBeNull();
    expect(screen.queryByText('Add a single entry')).toBeNull();
  });
  it('says so when the templates could not be loaded', () => {
    h.libFail = true;
    open();
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/);
  });
  it('Save is off until something changes, then saves both languages for this parish and day', async () => {
    open();
    const save = screen.getByRole('button', { name: 'Save & publish' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    type(en(), '9:30 Liturgy\n');
    type(el(), '9:30 Λειτουργία');
    expect(save.disabled).toBe(false);
    await act(async () => { fireEvent.click(save); });
    expect(h.saved).toEqual([['ht', '2026-11-24', '9:30 Liturgy\n', '9:30 Λειτουργία']]);
    expect(screen.getByText('✓ Saved and live')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save & publish' }) as HTMLButtonElement).disabled).toBe(true);
    type(en(), '9:30 Liturgy and more');
    expect(screen.queryByText('✓ Saved and live')).toBeNull();
    expect((screen.getByRole('button', { name: 'Save & publish' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('only whitespace changes do not count as a change', () => {
    open('2026-11-22');
    type(en(), '9:00 Orthros\n10:00 Liturgy\n\n');
    expect((screen.getByRole('button', { name: 'Save & publish' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('explains a refused save, and a failed one', async () => {
    open();
    type(en(), 'x');
    h.saveError = Object.assign(new Error('no'), { code: 'permission-denied' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & publish' })); });
    expect(screen.getByRole('alert').textContent).toMatch(/not allowed to change this parish/);
    h.saveError = new Error('offline');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & publish' })); });
    expect(screen.getByRole('alert').textContent).toMatch(/could not be saved/);
    expect(screen.queryByText('✓ Saved and live')).toBeNull();
  });
  it('Clear day shows only when something is saved, and asks first', async () => {
    open();
    expect(screen.queryByRole('button', { name: 'Clear day' })).toBeNull();
    cleanup();
    open('2026-11-22');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear day' })); });
    expect(h.deleted).toEqual([]);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear day' })); });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(h.deleted).toEqual([['ht', '2026-11-22']]);
    expect(en().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear day' })).toBeNull();
  });
  it('a failed Clear keeps the text', async () => {
    open('2026-11-22');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.saveError = new Error('offline');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear day' })); });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(en().value).toContain('Orthros');
  });
  it('limits each box to the 4000 characters the rules allow', () => {
    open();
    expect(en().maxLength).toBe(4000);
    expect(el().maxLength).toBe(4000);
  });
  it('shows the feast, tone and fast of the day above the form', () => {
    const { container } = open('2026-11-25');
    const panel = container.querySelector('.svc-panel') as HTMLElement;
    expect(within(panel).getByText(/St Catherine the Great Martyr/)).toBeTruthy();
    expect(within(panel).getByText(/Strict fast/)).toBeTruthy();
  });
});
