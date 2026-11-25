import { describe, it, expect } from 'vitest';
import { addDays, addMonths, daysInMonth, dayNumber, isMonth, monthOf, parseISO, toISO, weekday } from '../src/lib/dates';

describe('dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-04-12', -48)).toBe('2026-02-23');
  });
  it('is not affected by daylight-saving changes (NZ springs forward on 27 Sep 2026)', () => {
    expect(addDays('2026-09-26', 1)).toBe('2026-09-27');
    expect(addDays('2026-09-27', 1)).toBe('2026-09-28');
    expect(dayNumber('2026-09-28') - dayNumber('2026-09-27')).toBe(1);
  });
  it('normalises out-of-range days and months', () => {
    expect(toISO(2026, 1, 0)).toBe('2025-12-31');
    expect(toISO(2026, 13, 1)).toBe('2027-01-01');
  });
  it('knows the weekday, month length and parts of a date', () => {
    expect(weekday('2026-04-12')).toBe(0);
    expect(weekday('2026-11-25')).toBe(3);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(parseISO('2026-04-05')).toEqual({ y: 2026, m: 4, d: 5 });
    expect(monthOf('2026-04-05')).toBe('2026-04');
  });
  it('moves months', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-05', 0)).toBe('2026-05');
    expect(addMonths('2026-05', -17)).toBe('2024-12');
  });
  it('validates "YYYY-MM"', () => {
    expect(isMonth('2026-11')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-1')).toBe(false);
    expect(isMonth(null)).toBe(false);
  });
});
