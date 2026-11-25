import { describe, it, expect } from 'vitest';
import { entriesByDate, entryText, entryLines, splitTimes, parishName } from '../src/lib/serviceDays';

const parish = (id: string, nameEn: string, nameEl: string, over: any = {}) =>
  ({ id, slug: id, nameEn, nameEl, city: '', address: '', groupIds: [], accentColor: '#000', order: 0, visible: true, ...over });
const day = (parishId: string, date: string, entriesEn: string, entriesEl = '') =>
  ({ id: `${parishId}_${date}`, parishId, date, yearMonth: date.slice(0, 7), entriesEn, entriesEl });

const parishes = [
  parish('b', 'B Parish', 'Ενορία Β', { order: 2 }),
  parish('a', 'A Parish', 'Ενορία Α', { order: 1 }),
  parish('c', 'C Parish', 'Ενορία Γ', { order: 1 }),
  parish('h', 'Hidden', 'Κρυφή', { visible: false }),
] as any[];

describe('entryText', () => {
  it('prefers the viewer\'s language and falls back to the other', () => {
    expect(entryText({ entriesEn: 'EN', entriesEl: 'EL' }, 'en')).toBe('EN');
    expect(entryText({ entriesEn: 'EN', entriesEl: 'EL' }, 'el')).toBe('EL');
    expect(entryText({ entriesEn: 'EN', entriesEl: '  ' }, 'el')).toBe('EN');
    expect(entryText({ entriesEn: '', entriesEl: 'EL' }, 'en')).toBe('EL');
    expect(entryText({ entriesEn: ' ', entriesEl: '' }, 'en')).toBe('');
  });
});

describe('entriesByDate', () => {
  const days = [
    day('b', '2026-11-22', '9:00 Liturgy'),
    day('a', '2026-11-22', '10:00 Liturgy', '10:00 Θεία Λειτουργία'),
    day('c', '2026-11-22', '8:30 Orthros'),
    day('h', '2026-11-22', 'hidden parish'),
    day('x', '2026-11-22', 'unknown parish'),
    day('a', '2026-11-25', '   '),
    day('a', '2026-11-29', 'Vespers'),
  ] as any[];

  it('lists visible parishes in their own order, then by name; skips blank, hidden and unknown ones', () => {
    const r = entriesByDate(days, parishes, 'all', 'en');
    expect(r['2026-11-22'].map(e => e.parishId)).toEqual(['a', 'c', 'b']);
    expect(r['2026-11-25']).toBeUndefined();
    expect(Object.keys(r)).toEqual(['2026-11-22', '2026-11-29']);
  });
  it('limits to a scope', () => {
    const r = entriesByDate(days, parishes, ['b', 'h'], 'en');
    expect(r['2026-11-22'].map(e => e.parishId)).toEqual(['b']);      // hidden stays hidden even if named
    expect(r['2026-11-29']).toBeUndefined();
  });
  it('shows nothing for an unresolved scope or before the parishes have loaded', () => {
    expect(entriesByDate(days, parishes, null, 'en')).toEqual({});
    expect(entriesByDate(days, [], 'all', 'en')).toEqual({});
  });
  it('uses the Greek text with the English fallback', () => {
    const r = entriesByDate(days, parishes, ['a'], 'el');
    expect(r['2026-11-22'][0].text).toBe('10:00 Θεία Λειτουργία');
    expect(r['2026-11-29'][0].text).toBe('Vespers');
  });
  it('names parishes in the viewer\'s language', () => {
    const e = entriesByDate(days, parishes, ['a'], 'en')['2026-11-22'][0];
    expect(parishName(e, 'en')).toBe('A Parish');
    expect(parishName(e, 'el')).toBe('Ενορία Α');
  });
});

describe('text helpers', () => {
  it('splits lines and drops blanks', () => {
    expect(entryLines('  9:00 Orthros \n\n 10:00 Liturgy\n')).toEqual(['9:00 Orthros', '10:00 Liturgy']);
  });
  it('marks clock times so they can be bold', () => {
    expect(splitTimes('Liturgy 9:30 and 18:00 Vespers')).toEqual([
      { text: 'Liturgy ', time: false }, { text: '9:30', time: true },
      { text: ' and ', time: false }, { text: '18:00', time: true }, { text: ' Vespers', time: false },
    ]);
    expect(splitTimes('9.30 Orthros')[0]).toEqual({ text: '9.30', time: true });
    expect(splitTimes('Psalm 118:1')).toHaveLength(1);                                  // not a clock time (3 digits)
  });
});
