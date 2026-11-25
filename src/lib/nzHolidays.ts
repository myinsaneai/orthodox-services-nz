// src/lib/nzHolidays.ts
// New Zealand public holidays, computed (not hand-typed) so that "Mondayised" dates cannot go stale.
// Ported from the Russian parish site's calendar, with every date handled as a "YYYY-MM-DD" string.
//
// Rules (Holidays Act 2003): New Year's Day / Day after New Year's Day, Waitangi Day, ANZAC Day,
// Christmas Day and Boxing Day move to the nearest following weekday when they fall on a weekend
// (the two pairs never land on the same day). King's Birthday (1st Monday of June) and Labour Day
// (4th Monday of October) are always Mondays. Good Friday / Easter Monday follow WESTERN Easter,
// which is not the Orthodox Pascha. Matariki is gazetted year by year, so it is a lookup table.
// Regional anniversary days are left out: the parishes are spread across the country and Fiji,
// Tonga and Samoa, so a single region's holiday would mislead.

import { addDays, toISO, weekday } from './dates';
import type { ISODate } from './dates';

export interface NZHoliday { en: string; el: string }

const OBS_EN = ' (observed)';
const OBS_EL = ' (αργία που μεταφέρθηκε)';

function mondayise(date: ISODate): ISODate {
  const dow = weekday(date);
  if (dow === 6) return addDays(date, 2);
  if (dow === 0) return addDays(date, 1);
  return date;
}

function mondayisePair(first: ISODate, second: ISODate): [ISODate, ISODate] {
  const a = mondayise(first);
  let b = mondayise(second);
  if (b === a) b = addDays(b, 1);
  return [a, b];
}

function nthMonday(y: number, m1: number, n: number): ISODate {
  const first = toISO(y, m1, 1);
  const firstMonday = addDays(first, (8 - weekday(first)) % 7);
  return addDays(firstMonday, (n - 1) * 7);
}

/** Western (Gregorian) Easter Sunday — Meeus/Jones/Butcher. */
export function westernEaster(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(year, month, day);
}

// Gazetted Matariki dates (MBIE list), [month, day].
export const MATARIKI: Record<number, [number, number]> = {
  2022: [6, 24], 2023: [7, 14], 2024: [6, 28], 2025: [6, 20], 2026: [7, 10],
  2027: [6, 25], 2028: [7, 14], 2029: [7, 6], 2030: [6, 21], 2031: [7, 11],
  2032: [7, 2], 2033: [6, 24], 2034: [7, 7], 2035: [6, 29], 2036: [7, 18],
  2037: [7, 10], 2038: [6, 25], 2039: [7, 15], 2040: [7, 6],
};

export const NZ_HOLIDAY_YEARS = { from: 2022, to: 2040 };

function build(from: number, to: number): Record<ISODate, NZHoliday> {
  const out: Record<ISODate, NZHoliday> = {};
  const set = (date: ISODate, en: string, el: string, observed: boolean) => {
    out[date] = { en: en + (observed ? OBS_EN : ''), el: el + (observed ? OBS_EL : '') };
  };

  for (let y = from; y <= to; y++) {
    const ny = toISO(y, 1, 1), ny2 = toISO(y, 1, 2);
    const [nyObs, ny2Obs] = mondayisePair(ny, ny2);
    set(nyObs, "New Year's Day", 'Πρωτοχρονιά', nyObs !== ny);
    set(ny2Obs, "Day after New Year's Day", 'Μετά την Πρωτοχρονιά', ny2Obs !== ny2);

    const wai = toISO(y, 2, 6);
    const waiObs = mondayise(wai);
    set(waiObs, 'Waitangi Day', 'Ημέρα Waitangi', waiObs !== wai);

    const easter = westernEaster(y);
    set(addDays(easter, -2), 'Good Friday (Western)', 'Μεγάλη Παρασκευή (Δυτική)', false);
    set(addDays(easter, 1), 'Easter Monday (Western)', 'Δευτέρα του Πάσχα (Δυτική)', false);

    const anzac = toISO(y, 4, 25);
    const anzacObs = mondayise(anzac);
    set(anzacObs, 'ANZAC Day', 'Ημέρα ANZAC', anzacObs !== anzac);

    set(nthMonday(y, 6, 1), "King's Birthday", 'Γενέθλια του Βασιλιά', false);

    const mat = MATARIKI[y];
    if (mat) set(toISO(y, mat[0], mat[1]), 'Matariki', 'Matariki', false);

    set(nthMonday(y, 10, 4), 'Labour Day', 'Ημέρα της Εργασίας', false);

    const xmas = toISO(y, 12, 25), boxing = toISO(y, 12, 26);
    const [xmasObs, boxingObs] = mondayisePair(xmas, boxing);
    set(xmasObs, 'Christmas Day', 'Χριστούγεννα', xmasObs !== xmas);
    set(boxingObs, 'Boxing Day', 'Επομένη των Χριστουγέννων', boxingObs !== boxing);
  }
  return out;
}

export const NZ_HOLIDAYS: Record<ISODate, NZHoliday> = build(NZ_HOLIDAY_YEARS.from, NZ_HOLIDAY_YEARS.to);

export function nzHolidayOn(date: ISODate): NZHoliday | null {
  return NZ_HOLIDAYS[date] ?? null;
}
