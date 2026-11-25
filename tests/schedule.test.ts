import { describe, it, expect } from 'vitest';
import { todayNZ, resolveScope } from '../src/lib/schedule';
import type { Parish, Group } from '../src/lib/firestore';

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

