import { describe, it, expect } from 'vitest';
import { todayNZ, formatWhen, resolveScope, scopeKey, visibleServices } from '../src/lib/schedule';
import type { Parish, Group, Service } from '../src/lib/firestore';

const parish = (id: string, over: Partial<Parish> = {}): Parish => ({
  id, slug: `slug-${id}`, nameEn: id, nameEl: id, city: '', address: '',
  groupIds: [], accentColor: '#000', order: 0, visible: true, ...over,
});
const group = (id: string): Group => ({ id, slug: `g-${id}`, nameEn: id, nameEl: id, order: 0 });

describe('New Zealand date', () => {
  it('uses the NZ calendar day, not the UTC day', () => {
    // NZST (UTC+12): 11:59 UTC is still 23:59 on the 26th, 12:00 UTC is midnight on the 27th
    expect(todayNZ(new Date('2026-07-01T11:59:00Z'))).toBe('2026-07-01');
    expect(todayNZ(new Date('2026-07-01T12:00:00Z'))).toBe('2026-07-02');
  });
  it('follows daylight saving (UTC+13) in summer', () => {
    expect(todayNZ(new Date('2026-12-24T10:59:00Z'))).toBe('2026-12-24');
    expect(todayNZ(new Date('2026-12-24T11:00:00Z'))).toBe('2026-12-25');
  });
  it('switches at the September daylight-saving change', () => {
    // 2026-09-27 02:00 NZST becomes 03:00 NZDT; the date itself is unaffected
    expect(todayNZ(new Date('2026-09-26T13:59:00Z'))).toBe('2026-09-27');
    expect(todayNZ(new Date('2026-09-27T10:59:00Z'))).toBe('2026-09-27');
    expect(todayNZ(new Date('2026-09-27T11:00:00Z'))).toBe('2026-09-28');
  });
});

describe('formatWhen', () => {
  // 29 Nov 2026 is a Sunday. The values are NZ wall-clock, shown as written.
  const s = { date: '2026-11-29', time: '09:30' };
  it('formats in English', () => {
    const out = formatWhen(s, 'en');
    expect(out).toMatch(/Sun/);
    expect(out).toMatch(/29/);
    expect(out).toMatch(/Nov/);
    expect(out).toMatch(/9:30/);
    expect(out).toMatch(/am/i);
  });
  it('formats in Greek', () => {
    const out = formatWhen(s, 'el');
    expect(out).toMatch(/Κυρ/);
    expect(out).toMatch(/29/);
    expect(out).toMatch(/Νοε/);
  });
  it('does not shift the time with the machine timezone or daylight saving', () => {
    expect(formatWhen({ date: '2026-12-25', time: '00:00' }, 'en')).toMatch(/12:00|0:00/);
    expect(formatWhen({ date: '2026-12-25', time: '23:45' }, 'en')).toMatch(/11:45/);
    expect(formatWhen({ date: '2026-12-25', time: '23:45' }, 'en')).toMatch(/25/);
  });
});

describe('resolveScope', () => {
  const g1 = group('g1');
  const parishes = [
    parish('a', { groupIds: ['g1'] }),
    parish('b', { groupIds: ['g1', 'g2'] }),
    parish('c', { groupIds: ['g2'] }),
    parish('hidden', { groupIds: ['g1'], visible: false }),
  ];
  const groups = [g1, group('g2'), group('empty')];
  const none = { parishSlug: null, groupSlug: null };

  it('is "all" with no selection', () => {
    expect(resolveScope(none, parishes, groups)).toBe('all');
  });
  it('resolves one parish by slug', () => {
    expect(resolveScope({ ...none, parishSlug: 'slug-c' }, parishes, groups)).toEqual(['c']);
  });
  it('resolves a group to its visible parishes only', () => {
    expect(resolveScope({ ...none, groupSlug: 'g-g1' }, parishes, groups)).toEqual(['a', 'b']);
    expect(resolveScope({ ...none, groupSlug: 'g-g2' }, parishes, groups)).toEqual(['b', 'c']);
  });
  it('a parish may belong to several groups', () => {
    const inG1 = resolveScope({ ...none, groupSlug: 'g-g1' }, parishes, groups) as string[];
    const inG2 = resolveScope({ ...none, groupSlug: 'g-g2' }, parishes, groups) as string[];
    expect(inG1.filter(x => inG2.includes(x))).toEqual(['b']);
  });
  it('returns null for unknown, hidden or empty selections (never falls back to all)', () => {
    expect(resolveScope({ ...none, parishSlug: 'nope' }, parishes, groups)).toBeNull();
    expect(resolveScope({ ...none, parishSlug: 'slug-hidden' }, parishes, groups)).toBeNull();
    expect(resolveScope({ ...none, groupSlug: 'nope' }, parishes, groups)).toBeNull();
    expect(resolveScope({ ...none, groupSlug: 'g-empty' }, parishes, groups)).toBeNull();
  });
  it('a parish selection wins over a group selection', () => {
    expect(resolveScope({ parishSlug: 'slug-a', groupSlug: 'g-g2' }, parishes, groups)).toEqual(['a']);
  });
  it('returns null while the lists are still empty (not yet loaded)', () => {
    expect(resolveScope({ ...none, parishSlug: 'slug-a' }, [], [])).toBeNull();
  });
});

describe('scopeKey', () => {
  it('is stable and distinguishes scopes', () => {
    expect(scopeKey('all')).toBe('all');
    expect(scopeKey(null)).toBe('none');
    expect(scopeKey(['a', 'b'])).toBe('a,b');
    expect(scopeKey(['a', 'b'])).toBe(scopeKey(['a', 'b']));
  });
});

describe('visibleServices', () => {
  const svc = (id: string, parishId: string): Service => ({
    id, parishId, date: '2026-12-01', time: '09:00', titleEn: '', titleEl: '', notesEn: '', notesEl: '', updatedAt: null,
  });
  const list = [svc('1', 'a'), svc('2', 'hidden'), svc('3', 'gone')];
  it('drops services of hidden parishes and of parishes that no longer exist', () => {
    const parishes = [parish('a'), parish('hidden', { visible: false })];
    expect(visibleServices(list, parishes).map(s => s.id)).toEqual(['1']);
  });
  it('keeps everything while the parish list has not loaded yet', () => {
    expect(visibleServices(list, [])).toHaveLength(3);
  });
});
