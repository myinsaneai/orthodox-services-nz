import { describe, it, expect } from 'vitest';
import { monthTitle, dayMonth, weekdayLong, longDate, weekdayHeaders } from '../src/lib/monthFormat';

describe('month and date labels', () => {
  it('formats in English', () => {
    expect(monthTitle('2026-11', 'en')).toBe('November 2026');
    expect(dayMonth('2026-11-25', 'en')).toBe('25 November');
    expect(weekdayLong('2026-11-25', 'en')).toBe('Wednesday');
    expect(longDate('2026-11-25', 'en')).toBe('Wednesday 25 November 2026');
    expect(weekdayHeaders('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
  it('formats in Greek', () => {
    expect(monthTitle('2026-11', 'el')).toBe('Νοέμβριος 2026');
    expect(dayMonth('2026-11-25', 'el')).toBe('25 Νοεμβρίου');
    expect(weekdayLong('2026-11-25', 'el')).toBe('Τετάρτη');
    expect(longDate('2026-11-25', 'el')).toBe('Τετάρτη 25 Νοεμβρίου 2026');
    expect(weekdayHeaders('el')[0]).toBe('Δευ');
  });
  it('is not shifted by the viewer\'s time zone (first and last day of a month)', () => {
    expect(dayMonth('2026-12-01', 'en')).toBe('1 December');
    expect(dayMonth('2026-12-31', 'en')).toBe('31 December');
  });
});
