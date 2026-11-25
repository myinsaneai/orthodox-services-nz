import { describe, it, expect } from 'vitest';
import {
  cleanText, appendLine, serviceDayPayload, isEmptyDay, templatePayload, entryTypePayload,
  templateComplete, entryTypeComplete, nextOrder, moveItem, serviceDayId,
} from '../src/lib/scheduleDocs';

describe('cleanText', () => {
  it('normalises line endings, trailing spaces and blank lines at the ends, and keeps the inside', () => {
    expect(cleanText('\r\n  9:00 Orthros  \r\n\r\n10:00 Liturgy \n\n')).toBe('  9:00 Orthros\n\n10:00 Liturgy');
    expect(cleanText('a\rb')).toBe('a\nb');
    expect(cleanText('   \n  ')).toBe('');
  });
});

describe('appendLine', () => {
  it('starts a text, or adds a new line after the last one', () => {
    expect(appendLine('', '9:00 Orthros')).toBe('9:00 Orthros');
    expect(appendLine('  \n', '9:00 Orthros')).toBe('9:00 Orthros');
    expect(appendLine('9:00 Orthros\n', '10:00 Liturgy')).toBe('9:00 Orthros\n10:00 Liturgy');
    expect(appendLine('9:00 Orthros', '10:00 Liturgy')).toBe('9:00 Orthros\n10:00 Liturgy');
  });
});

describe('day payload', () => {
  it('has the parish, date, month and cleaned text', () => {
    expect(serviceDayPayload('holy-trinity', '2026-11-25', ' 18:00 Vespers \n', 'x\r\n')).toEqual({
      parishId: 'holy-trinity', date: '2026-11-25', yearMonth: '2026-11', entriesEn: ' 18:00 Vespers', entriesEl: 'x',
    });
    expect(serviceDayId('a', '2026-01-02')).toBe('a_2026-01-02');
  });
  it('knows an empty day', () => {
    expect(isEmptyDay('', ' \n')).toBe(true);
    expect(isEmptyDay('x', '')).toBe(false);
    expect(isEmptyDay('', 'ω')).toBe(false);
  });
});

describe('templates and quick entries', () => {
  it('never put the id in the document and trim what is saved', () => {
    expect(templatePayload({ id: 'z', nameEn: ' Sunday ', nameEl: ' Κυριακή ', entriesEn: '9:00 A\n', entriesEl: '', order: 3 }))
      .toEqual({ nameEn: 'Sunday', nameEl: 'Κυριακή', entriesEn: '9:00 A', entriesEl: '', order: 3 });
    expect(entryTypePayload({ id: 'z', textEn: ' 9:00 Orthros ', textEl: '9:00 Όρθρος', order: 0 }))
      .toEqual({ textEn: '9:00 Orthros', textEl: '9:00 Όρθρος', order: 0 });
  });
  it('need both languages for the name / the line', () => {
    expect(templateComplete({ nameEn: 'A', nameEl: ' ' })).toBe(false);
    expect(templateComplete({ nameEn: 'A', nameEl: 'Α' })).toBe(true);
    expect(entryTypeComplete({ textEn: '', textEl: 'Α' })).toBe(false);
    expect(entryTypeComplete({ textEn: 'A', textEl: 'Α' })).toBe(true);
  });
});

describe('order', () => {
  const list = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }];
  it('a new item goes last', () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder(list)).toBe(3);
    expect(nextOrder([{ order: 7 }])).toBe(8);
  });
  it('moving swaps two neighbours and returns only the two that changed', () => {
    expect(moveItem(list, 1, -1)).toEqual([{ id: 'b', order: 0 }, { id: 'a', order: 1 }]);
    expect(moveItem(list, 1, 1)).toEqual([{ id: 'c', order: 1 }, { id: 'b', order: 2 }]);
  });
  it('cannot move the first item up or the last down, or something that is not there', () => {
    expect(moveItem(list, 0, -1)).toEqual([]);
    expect(moveItem(list, 2, 1)).toEqual([]);
    expect(moveItem(list, 5, -1)).toEqual([]);
  });
  it('repairs gaps and duplicates in the stored order while moving', () => {
    const messy = [{ id: 'a', order: 5 }, { id: 'b', order: 5 }, { id: 'c', order: 9 }];
    const changed = moveItem(messy, 2, -1);
    expect(changed.map(i => i.id).sort()).toEqual(['a', 'b', 'c']);
    expect(changed.find(i => i.id === 'c')!.order).toBe(1);
    expect(changed.find(i => i.id === 'b')!.order).toBe(2);
    expect(changed.find(i => i.id === 'a')!.order).toBe(0);
  });
});
