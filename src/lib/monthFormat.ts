// src/lib/monthFormat.ts
// Month and date labels for the Services views, in English (New Zealand) or Greek. Dates are
// "YYYY-MM-DD" strings and are formatted in UTC so the viewer's time zone can never shift them.

import type { Lang } from '../contexts/LangContext';
import { parseISO } from './dates';

const locale = (lang: Lang) => (lang === 'el' ? 'el-GR' : 'en-NZ');
const utc = (iso: string) => { const { y, m, d } = parseISO(iso); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (lang: Lang, iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale(lang), { ...opts, timeZone: 'UTC' }).format(utc(iso));

/** "November 2026" / "Νοέμβριος 2026" */
export const monthTitle = (ym: string, lang: Lang) => fmt(lang, `${ym}-01`, { month: 'long', year: 'numeric' });
/** "25 November" / "25 Νοεμβρίου" */
export const dayMonth = (iso: string, lang: Lang) => fmt(lang, iso, { day: 'numeric', month: 'long' });
/** "Wednesday" / "Τετάρτη" */
export const weekdayLong = (iso: string, lang: Lang) => fmt(lang, iso, { weekday: 'long' });
/** "Wednesday 25 November 2026" */
export const longDate = (iso: string, lang: Lang) =>
  `${weekdayLong(iso, lang)} ${fmt(lang, iso, { day: 'numeric', month: 'long', year: 'numeric' })}`;

/** Monday-first short weekday names. 2024-01-01 was a Monday. */
export function weekdayHeaders(lang: Lang): string[] {
  return Array.from({ length: 7 }, (_, i) => fmt(lang, `2024-01-0${i + 1}`, { weekday: 'short' }));
}
