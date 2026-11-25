import { describe, it, expect } from 'vitest';
import { nzHolidayOn, westernEaster, NZ_HOLIDAYS } from '../src/lib/nzHolidays';

const en = (d: string) => nzHolidayOn(d)?.en ?? null;

describe('NZ public holidays', () => {
  it('computes Western Easter', () => {
    expect(westernEaster(2024)).toBe('2024-03-31');
    expect(westernEaster(2025)).toBe('2025-04-20');
    expect(westernEaster(2026)).toBe('2026-04-05');
    expect(westernEaster(2027)).toBe('2027-03-28');
  });
  it('lists the 2026 holidays on the right days', () => {
    expect(en('2026-01-01')).toBe("New Year's Day");
    expect(en('2026-01-02')).toBe("Day after New Year's Day");
    expect(en('2026-02-06')).toBe('Waitangi Day');
    expect(en('2026-04-03')).toBe('Good Friday (Western)');
    expect(en('2026-04-06')).toBe('Easter Monday (Western)');
    expect(en('2026-06-01')).toBe("King's Birthday");
    expect(en('2026-07-10')).toBe('Matariki');
    expect(en('2026-10-26')).toBe('Labour Day');
    expect(en('2026-12-25')).toBe('Christmas Day');
  });
  it('moves weekend holidays to the following Monday and says so', () => {
    expect(en('2026-04-25')).toBeNull();                       // ANZAC Day 2026 is a Saturday
    expect(en('2026-04-27')).toBe('ANZAC Day (observed)');
    expect(en('2026-12-26')).toBeNull();                       // Boxing Day 2026 is a Saturday
    expect(en('2026-12-28')).toBe('Boxing Day (observed)');
    expect(en('2027-01-04')).toBe("Day after New Year's Day (observed)");  // 2 Jan 2027 is a Saturday
  });
  it('bumps the second of a pair so two holidays never share a day', () => {
    // Christmas Day 2027 is a Saturday and Boxing Day a Sunday: Monday 27 and Tuesday 28.
    expect(en('2027-12-27')).toBe('Christmas Day (observed)');
    expect(en('2027-12-28')).toBe('Boxing Day (observed)');
  });
  it('has Greek names, and no regional anniversary days', () => {
    expect(nzHolidayOn('2026-12-25')?.el).toBe('Χριστούγεννα');
    Object.values(NZ_HOLIDAYS).forEach(h => expect(h.el.length).toBeGreaterThan(0));
    expect(Object.values(NZ_HOLIDAYS).some(h => /Anniversary/.test(h.en))).toBe(false);
  });
});
