import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PARISH_STATES, stateById } from '../src/lib/states';
import { isMapUrl, safeMapUrl } from '../src/lib/mapUrl';
import { emptyParishForm, checkParishForm, slugify, uniqueSlug, buildParish } from '../src/lib/parishes';
import type { ParishForm } from '../src/lib/parishes';

const form = (over: Partial<ParishForm> = {}): ParishForm => ({
  ...emptyParishForm(), nameEn: 'Holy Trinity', nameEl: 'Αγία Τριάδα', cityEn: 'Wellington', cityEl: 'Ουέλλινγκτον', address: '5 Hania St', ...over,
});

describe('states', () => {
  it('are New Zealand, Fiji, Tonga, Samoa in that order, each with a Greek name', () => {
    expect(PARISH_STATES.map(s => s.nameEn)).toEqual(['New Zealand', 'Fiji', 'Tonga', 'Samoa']);
    expect(PARISH_STATES.every(s => s.nameEl.length > 0)).toBe(true);
    expect(stateById('fj')?.nameEn).toBe('Fiji');
    expect(stateById('xx')).toBeUndefined();
  });
  it('a new form starts on New Zealand', () => { expect(emptyParishForm().state).toBe('nz'); });
});

describe('Google Maps links', () => {
  it('accepts the usual Google Maps addresses', () => {
    for (const u of ['https://maps.app.goo.gl/AbC123', 'https://www.google.com/maps/place/Holy+Trinity/@-41.3,174.7,17z',
      'https://google.com/maps?q=x', 'https://goo.gl/maps/abc', 'https://maps.google.com/?q=x', 'https://www.google.co.nz/maps/place/x', 'https://maps.google.co.nz/?q=x'])
      expect(isMapUrl(u), u).toBe(true);
  });
  it('refuses everything else', () => {
    for (const u of ['http://maps.app.goo.gl/x', 'https://evil.example/maps/x', 'https://google.com.evil.example/maps/x',
      'https://www.google.com/search?q=maps', 'https://notgoogle.com/maps', 'javascript:alert(1)', 'maps.app.goo.gl/x', ''])
      expect(isMapUrl(u), u).toBe(false);
    expect(isMapUrl('https://maps.app.goo.gl/' + 'a'.repeat(500))).toBe(false);
    expect(safeMapUrl('https://evil.example')).toBe('');
    expect(safeMapUrl(undefined)).toBe('');
  });
});

describe('checkParishForm', () => {
  it('accepts a form with only the required fields', () => { expect(checkParishForm(form())).toBeNull(); });
  it('accepts description in both languages and a Maps link', () => {
    expect(checkParishForm(form({ descriptionEn: 'Our church', descriptionEl: 'Η εκκλησία μας', mapUrl: 'https://maps.app.goo.gl/x' }))).toBeNull();
  });
  it('needs an address, one for both languages, up to 500 characters', () => {
    expect(checkParishForm(form({ address: '  ' }))).toMatch(/enter the address/);
    expect(checkParishForm(form({ address: 'x'.repeat(501) }))).toMatch(/500/);
    expect(checkParishForm(form({ address: 'x'.repeat(500) }))).toBeNull();
  });
  it('needs name and city in both languages', () => {
    expect(checkParishForm(form({ nameEn: ' ' }))).toMatch(/name in English/);
    expect(checkParishForm(form({ nameEl: '' }))).toMatch(/name in Greek/);
    expect(checkParishForm(form({ cityEn: '' }))).toMatch(/city in English/);
    expect(checkParishForm(form({ cityEl: '' }))).toMatch(/city in Greek/);
  });
  it('a description is both languages or neither', () => {
    expect(checkParishForm(form({ descriptionEn: 'x' }))).toMatch(/in Greek too/);
    expect(checkParishForm(form({ descriptionEl: 'x' }))).toMatch(/in English too/);
  });
  it('refuses an unknown state, a non-Google link, and too long texts', () => {
    expect(checkParishForm(form({ state: 'xx' }))).toMatch(/state/);
    expect(checkParishForm(form({ mapUrl: 'https://example.com' }))).toMatch(/Google Maps/);
    expect(checkParishForm(form({ nameEn: 'x'.repeat(121) }))).toMatch(/120/);
    expect(checkParishForm(form({ cityEl: 'x'.repeat(81) }))).toMatch(/80/);
    expect(checkParishForm(form({ descriptionEn: 'x'.repeat(2001), descriptionEl: 'y' }))).toMatch(/2000/);
  });
});

describe('ids and the new record', () => {
  it('slugify keeps Latin letters and digits only', () => {
    expect(slugify('St. Nectarios & Co')).toBe('st-nectarios-co');
    expect(slugify('Ταξιάρχες')).toBe('');
    expect(slugify('Café Ñandú')).toBe('cafe-nandu');
    expect(slugify('a'.repeat(100)).length).toBe(60);
  });
  it('uniqueSlug avoids ids already used, and copes with a name with no Latin letters', () => {
    expect(uniqueSlug('Holy Trinity', 'Wellington', [])).toBe('holy-trinity-wellington');
    expect(uniqueSlug('Holy Trinity', 'Wellington', ['holy-trinity-wellington'])).toBe('holy-trinity-wellington-2');
    expect(uniqueSlug('Holy Trinity', 'Wellington', ['holy-trinity-wellington', 'holy-trinity-wellington-2'])).toBe('holy-trinity-wellington-3');
    expect(uniqueSlug('Αγία', 'Αθήνα', [], 'zz')).toBe('parish-zz');
  });
  it('buildParish fills every field, trims, sets the order after the last, and starts visible', () => {
    const p = buildParish(form({ nameEn: '  Holy Trinity ', mapUrl: ' https://maps.app.goo.gl/x ', state: 'fj' }), 'https://firebasestorage.googleapis.com/v0/b/x/o/p.jpg',
      [{ id: 'a', slug: 'a', order: 3 }, { id: 'b', slug: 'b', order: 1 }]);
    expect(p).toEqual({
      id: 'holy-trinity-wellington', slug: 'holy-trinity-wellington', state: 'fj',
      nameEn: 'Holy Trinity', nameEl: 'Αγία Τριάδα', city: 'Wellington', cityEl: 'Ουέλλινγκτον', address: '5 Hania St',
      descriptionEn: '', descriptionEl: '', mapUrl: 'https://maps.app.goo.gl/x',
      photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/p.jpg',
      groupIds: [], accentColor: '', order: 4, visible: true,
    });
  });
  it('the first parish gets order 1', () => {
    expect(buildParish(form(), '', []).order).toBe(1);
  });
});

describe('what is written matches firestore.rules', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const fn = rules.slice(rules.indexOf('function parishOk'), rules.indexOf('match /parishes/'));
  const list = (re: RegExp) => [...fn.match(re)![1].matchAll(/'(\w+)'/g)].map(m => m[1]);
  const allowed = list(/hasOnly\(\s*\[([^\]]*)\]/);
  const required = list(/hasAll\(\s*\[([^\]]*)\]/);
  const saved = (() => {                       // exactly what createParish writes: every field but the id
    const { id: _id, ...data } = buildParish(form(), '', []);
    return Object.keys(data);
  })();

  it('every saved field is one the rules allow (an extra field makes Firestore refuse the write)', () => {
    expect(saved.filter(k => !allowed.includes(k))).toEqual([]);
  });
  it('every field the rules require is saved', () => {
    expect(required.filter(k => !saved.includes(k))).toEqual([]);
  });
  it('createParish removes the id from what it writes', () => {
    const code = readFileSync('src/lib/firestore.ts', 'utf8');
    expect(code).toMatch(/const \{ id, \.\.\.data \} = p;[\s\S]*setDoc\(doc\(db, 'parishes', id\), data\)/);
  });
});
