// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h: any = vi.hoisted(() => { const h: any = {
  templates: [] as any[],
  entryTypes: [] as any[],
  fail: false,
  err: null as any,
  calls: [] as any[],
  translate: (async () => '') as (...a: any[]) => Promise<string>,
}; h.rec = (name: string) => async (...a: any[]) => { if (h.err) throw h.err; h.calls.push([name, ...a]); }; return h; });
vi.mock('../src/lib/firestore', () => ({
  subscribeServiceTemplates: (cb: any, onError: any) => { if (h.fail) onError(new Error('x')); else cb(h.templates); return () => {}; },
  subscribeServiceEntryTypes: (cb: any, onError: any) => { if (h.fail) onError(new Error('x')); else cb(h.entryTypes); return () => {}; },
  newLibraryId: (c: string) => `new-${c}`,
  saveServiceTemplate: h.rec('saveTemplate'),
  saveServiceEntryType: h.rec('saveEntry'),
  deleteServiceTemplate: h.rec('deleteTemplate'),
  deleteServiceEntryType: h.rec('deleteEntry'),
  setLibraryOrder: h.rec('order'),
}));

vi.mock('../src/admin/translate', () => ({
  translateText: (...a: any[]) => h.translate(...a),
  translateFailure: (e: any) => `fail:${e?.code ?? 'x'}`,
}));

import TemplatesPage from '../src/admin/TemplatesPage';

const tpl = (id: string, nameEn: string, order: number) =>
  ({ id, nameEn, nameEl: `${nameEn}-el`, entriesEn: '9:00 A\n10:00 B', entriesEl: '9:00 Α', order });
const mount = () => render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
const fill = (root: HTMLElement, label: string, v: string) =>
  fireEvent.change(within(root).getByLabelText(label), { target: { value: v } });

beforeEach(() => {
  h.templates = [tpl('t1', 'Sunday', 0), tpl('t2', 'Feast', 1), tpl('t3', 'Weekday', 2)];
  h.entryTypes = [{ id: 'e1', textEn: '18:00 Vespers', textEl: '18:00 Εσπερινός', order: 0 }];
  h.fail = false; h.err = null; h.calls = [];
  h.translate = async (text: string, from: string) => `[${from}] ${text}`;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Templates page', () => {
  it('lists both libraries with a one-line preview', () => {
    mount();
    const s = section('Full-day templates');
    expect(within(s).getByText('Sunday')).toBeTruthy();
    expect(within(s).getAllByText('9:00 A · 10:00 B')).toHaveLength(3);
    expect(within(section('Quick entries')).getByText('18:00 Εσπερινός')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to Schedule/ }).getAttribute('href')).toBe('/admin/schedule');
  });
  it('shows empty states and load failures', () => {
    h.templates = []; h.entryTypes = [];
    mount();
    expect(screen.getByText('No templates yet.')).toBeTruthy();
    expect(screen.getByText('No quick entries yet.')).toBeTruthy();
  });
  it('reports a failed load', () => {
    h.fail = true;
    mount();
    expect(screen.getAllByRole('alert').map(a => a.textContent)).toEqual([
      'The templates could not be loaded.', 'The quick entries could not be loaded.',
    ]);
  });
  it('disables Up on the first and Down on the last', () => {
    mount();
    expect((screen.getByLabelText('Move Sunday up') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Weekday down') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Feast up') as HTMLButtonElement).disabled).toBe(false);
  });
  it('reordering writes only the two swapped items', async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByLabelText('Move Feast up')); });
    expect(h.calls).toHaveLength(1);
    const [name, col, changed] = h.calls[0];
    expect(name).toBe('order');
    expect(col).toBe('serviceTemplates');
    expect(changed.map((c: any) => [c.id, c.order]).sort()).toEqual([['t1', 1], ['t2', 0]]);
  });
  it('adds a template: Save stays off until both names are filled, then saves with the next order', async () => {
    mount();
    const s = section('Full-day templates');
    fireEvent.click(within(s).getByRole('button', { name: 'Add template' }));
    const save = within(s).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fill(s, 'Name (English)', 'Vigil');
    expect(save.disabled).toBe(true);
    fill(s, 'Όνομα (Ελληνικά)', 'Αγρυπνία');
    fill(s, 'Schedule (English)', '18:00 Vigil');
    expect(save.disabled).toBe(false);
    await act(async () => { fireEvent.click(save); });
    expect(h.calls).toEqual([['saveTemplate', {
      id: 'new-serviceTemplates', nameEn: 'Vigil', nameEl: 'Αγρυπνία', entriesEn: '18:00 Vigil', entriesEl: '', order: 3,
    }]]);
    expect(within(s).queryByRole('button', { name: 'Save' })).toBeNull();     // form closed
  });
  it('edits an existing quick entry and can cancel', async () => {
    mount();
    const s = section('Quick entries');
    fireEvent.click(within(s).getByLabelText('Edit 18:00 Vespers'));
    expect((within(s).getByLabelText('Line (English)') as HTMLInputElement).value).toBe('18:00 Vespers');
    fireEvent.click(within(s).getByRole('button', { name: 'Cancel' }));
    expect(within(s).queryByLabelText('Line (English)')).toBeNull();
    fireEvent.click(within(s).getByLabelText('Edit 18:00 Vespers'));
    fill(s, 'Line (English)', '17:30 Vespers');
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Save' })); });
    expect(h.calls[0][0]).toBe('saveEntry');
    expect(h.calls[0][1]).toMatchObject({ id: 'e1', textEn: '17:30 Vespers', textEl: '18:00 Εσπερινός', order: 0 });
  });
  it('limits field lengths to what the rules allow', () => {
    mount();
    const s = section('Full-day templates');
    fireEvent.click(within(s).getByRole('button', { name: 'Add template' }));
    expect((within(s).getByLabelText('Name (English)') as HTMLInputElement).maxLength).toBe(100);
    expect((within(s).getByLabelText('Schedule (English)') as HTMLTextAreaElement).maxLength).toBe(4000);
    fireEvent.click(within(s).getByRole('button', { name: 'Cancel' }));
    const q = section('Quick entries');
    fireEvent.click(within(q).getByRole('button', { name: 'Add quick entry' }));
    expect((within(q).getByLabelText('Line (English)') as HTMLInputElement).maxLength).toBe(200);
  });
  it('asks before deleting, and No keeps the item', async () => {
    mount();
    const s = section('Full-day templates');
    fireEvent.click(within(s).getByLabelText('Delete Feast'));
    expect(within(s).getByText('Delete “Feast”?')).toBeTruthy();
    fireEvent.click(within(s).getByRole('button', { name: 'No' }));
    expect(h.calls).toEqual([]);
    fireEvent.click(within(s).getByLabelText('Delete Feast'));
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Yes, delete' })); });
    expect(h.calls).toEqual([['deleteTemplate', 't2']]);
  });
  it('explains a refused or failed save and keeps the form open', async () => {
    mount();
    const s = section('Quick entries');
    fireEvent.click(within(s).getByRole('button', { name: 'Add quick entry' }));
    fill(s, 'Line (English)', 'x'); fill(s, 'Γραμμή (Ελληνικά)', 'χ');
    h.err = Object.assign(new Error('no'), { code: 'permission-denied' });
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Save' })); });
    expect(within(s).getByRole('alert').textContent).toMatch(/Not allowed/);
    h.err = new Error('offline');
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Save' })); });
    expect(within(s).getByRole('alert').textContent).toMatch(/Could not save/);
    expect(within(s).getByLabelText('Line (English)')).toBeTruthy();
  });

  it('translates the name and the schedule of a template, each with its own buttons', async () => {
    mount();
    const s = section('Full-day templates');
    fireEvent.click(within(s).getByRole('button', { name: 'Add template' }));
    fill(s, 'Name (English)', 'Vigil');
    fill(s, 'Schedule (English)', '18:00 Vigil');
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Translate name English → Greek' })); });
    expect((within(s).getByLabelText('Όνομα (Ελληνικά)') as HTMLInputElement).value).toBe('[en] Vigil');
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Translate schedule English → Greek' })); });
    expect((within(s).getByLabelText('Πρόγραμμα (Ελληνικά)') as HTMLTextAreaElement).value).toBe('[en] 18:00 Vigil');
    expect((within(s).getByLabelText('Name (English)') as HTMLInputElement).value).toBe('Vigil');   // untouched
    const save = within(s).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(h.calls).toEqual([]);                                                                   // nothing saved yet
  });
  it('a quick entry gets one pair of buttons and the Greek line is limited to 200 characters', async () => {
    mount();
    const s = section('Quick entries');
    fireEvent.click(within(s).getByRole('button', { name: 'Add quick entry' }));
    fill(s, 'Line (English)', '9:00 Orthros');
    h.translate = async () => 'Ό'.repeat(201);
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Translate English → Greek' })); });
    expect(within(s).getByRole('alert').textContent).toMatch(/200 characters/);
    h.translate = async () => '9:00 Όρθρος';
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Translate English → Greek' })); });
    expect((within(s).getByLabelText('Γραμμή (Ελληνικά)') as HTMLInputElement).value).toBe('9:00 Όρθρος');
    await act(async () => { fireEvent.click(within(s).getByRole('button', { name: 'Save' })); });
    expect(h.calls[0][1]).toMatchObject({ textEn: '9:00 Orthros', textEl: '9:00 Όρθρος' });
  });
});
