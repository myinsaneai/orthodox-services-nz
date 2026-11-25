// src/lib/dates.ts
// Calendar-date arithmetic on "YYYY-MM-DD" strings, done in UTC so that nothing here depends
// on the viewer's time zone or on daylight-saving changes (a day is always exactly one day).

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(y: number, m1: number, d: number): ISODate {
  // Date.UTC normalises out-of-range months/days (e.g. day 0, month 13), which is what callers rely on.
  const dt = new Date(Date.UTC(y, m1 - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** Whole days since 1970-01-01. */
export function dayNumber(s: ISODate): number {
  const { y, m, d } = parseISO(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(s);
  return toISO(y, m, d + n);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(s: ISODate): number {
  const { y, m, d } = parseISO(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

/** "YYYY-MM" of a date. */
export function monthOf(s: ISODate): string {
  return s.slice(0, 7);
}

/** Shifts a "YYYY-MM" by a number of months. */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export const isMonth = (s: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
