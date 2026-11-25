// src/lib/orthodoxCalendar.ts
// The Greek Orthodox (Revised Julian / "Neo-Julian") church calendar for one civil date:
// feasts, fasting level, tone, and the New Zealand public holiday. Pure functions on
// "YYYY-MM-DD" strings (see dates.ts) — no React, no Firebase, no time-zone dependence.
//
// Pascha is computed by the Julian paschalion for ALL Orthodox churches (the Revised Julian
// calendar changed the fixed feasts only), so the date below is the Julian computus plus the
// 13 days that separate the two calendars in 1900–2099. Fixed feasts are then simply looked up
// by their civil month and day (greekFeasts.ts).

import { addDays, dayNumber, parseISO, toISO, weekday } from './dates';
import type { ISODate } from './dates';
import {
  FIXED_FEASTS, MOVEABLE_OFFSETS, GREEK_NATIONAL_DAYS, FAST_LABEL, FAST_PERIOD_LABEL,
} from './greekFeasts';
import type { FastType, FeastData, FastPeriodKey, DayNote } from './greekFeasts';
import { nzHolidayOn } from './nzHolidays';
import type { NZHoliday } from './nzHolidays';

export type { FastType, FeastData, FastPeriodKey, DayNote, NZHoliday };

/** Orthodox Pascha (civil/Gregorian date) — valid for the years 1900–2099. */
export function computePascha(year: number): ISODate {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return toISO(year, month, day + 13); // Julian date + 13 days
}

const paschaCache = new Map<number, ISODate>();
export function getPascha(year: number): ISODate {
  let p = paschaCache.get(year);
  if (!p) { p = computePascha(year); paschaCache.set(year, p); }
  return p;
}

// ── Fasting ──────────────────────────────────────────────────────────────────
// The level of fasting depends on the weekday inside each season. These follow the common
// parish practice (Typikon); a parish priest may direct otherwise, so the schedule text is
// always the authority for a particular day.

// Great Lent: strict Monday–Friday, oil & wine on Saturday and Sunday.
const greatLent = (dow: number): FastType => (dow === 0 || dow === 6 ? 'oilwine' : 'strict');
// Dormition Fast: the same pattern (fish only on the Transfiguration, set on that feast).
const dormition = greatLent;
// Apostles' Fast: Mon/Wed/Fri strict, Tue/Thu oil & wine, Sat/Sun fish — a major saint relaxes
// the day (fish, or oil & wine on Wed/Fri).
function apostles(dow: number, majorSaint: boolean): FastType {
  if (majorSaint) return dow === 3 || dow === 5 ? 'oilwine' : 'fish';
  if (dow === 0 || dow === 6) return 'fish';
  if (dow === 2 || dow === 4) return 'oilwine';
  return 'strict';
}
// Nativity Fast: as the Apostles' Fast, except that from 20 to 24 December fish is not allowed.
function nativity(dow: number, lastDays: boolean): FastType {
  if (dow === 0 || dow === 6) return lastDays ? 'oilwine' : 'fish';
  if (dow === 2 || dow === 4) return 'oilwine';
  return 'strict';
}

export interface FastingPeriod { start: ISODate; end: ISODate; key: FastPeriodKey }

/** The four fasting seasons of a civil year (the Apostles' Fast can be empty when Pascha is late). */
export function getFastingPeriods(year: number): FastingPeriod[] {
  const pascha = getPascha(year);
  return [
    { key: 'greatLent', start: addDays(pascha, -48), end: addDays(pascha, -1) },
    // From the Monday after All Saints to 28 June (29 June is the feast of Peter and Paul).
    { key: 'apostles', start: addDays(pascha, 57), end: toISO(year, 6, 28) },
    { key: 'dormition', start: toISO(year, 8, 1), end: toISO(year, 8, 14) },
    { key: 'nativity', start: toISO(year, 11, 15), end: toISO(year, 12, 24) },
  ];
}

// ── Tone of the week ─────────────────────────────────────────────────────────
// The Octoechos runs Sunday to Sunday all year, restarting at tone 1 on Thomas Sunday; Palm Sunday
// to Bright Saturday has no tone of its own.
export function getTone(date: ISODate, pascha: ISODate): number | null {
  const diff = dayNumber(date) - dayNumber(pascha);
  if (diff >= -7 && diff <= 6) return null;
  const weeks = Math.floor(diff / 7);
  const tone = ((weeks % 8) + 8) % 8;
  return tone === 0 ? 8 : tone;
}

const TONE_EL = ['', 'α΄', 'β΄', 'γ΄', 'δ΄', 'πλ. α΄', 'πλ. β΄', 'βαρύς', 'πλ. δ΄'];
export function toneLabel(tone: number, lang: 'en' | 'el'): string {
  return lang === 'el' ? `Ήχος ${TONE_EL[tone]}` : `Tone ${tone}`;
}

// ── One day ──────────────────────────────────────────────────────────────────
export interface DayData {
  date: ISODate;
  dow: number;
  fixedFeast: FeastData | null;
  moveableFeast: FeastData | null;
  nzHoliday: NZHoliday | null;
  nationalDay: DayNote | null;
  fast: FastType | null;
  fastPeriod: FastPeriodKey | null;
  tone: number | null;
  isHolyWeek: boolean;
  isPascha: boolean;
  isBrightWeek: boolean;
  isSunday: boolean;
  /** Days since Pascha (negative before it). */
  paschaOffset: number;
}

const two = (n: number) => String(n).padStart(2, '0');
const WEEKEND_SOFTENED = new Set(['01-05', '12-24']); // the two Eves: oil & wine when on a Sat/Sun

export function getDayData(date: ISODate): DayData {
  const { y, m, d } = parseISO(date);
  const key = `${two(m)}-${two(d)}`;
  const dow = weekday(date);

  let pascha = getPascha(y);
  let offset = dayNumber(date) - dayNumber(pascha);
  if (offset < -100) { pascha = getPascha(y - 1); offset = dayNumber(date) - dayNumber(pascha); }

  const moveable = MOVEABLE_OFFSETS[String(offset)] ?? null;
  const fixed = FIXED_FEASTS[key] ?? null;

  let fast: FastType | null = null;
  let fastPeriod: FastPeriodKey | null = null;

  const majorSaint = fixed?.tier === 'major';
  const lastDaysOfNativity = m === 12 && d >= 20 && d <= 24;

  for (const p of getFastingPeriods(y)) {
    if (date < p.start || date > p.end) continue;
    fastPeriod = p.key;
    fast = p.key === 'greatLent' ? greatLent(dow)
      : p.key === 'apostles' ? apostles(dow, majorSaint)
      : p.key === 'dormition' ? dormition(dow)
      : nativity(dow, lastDaysOfNativity);
    break;
  }

  // Outside the seasons Wednesday and Friday are fasting days (oil & wine allowed); a great feast
  // of the Lord or the Theotokos relaxes them to fish. Mondays are not marked (monastic custom).
  if (!fast && (dow === 3 || dow === 5)) {
    const tier = fixed?.tier ?? moveable?.tier;
    fast = tier === 'great' || tier === 'pascha' ? 'fish' : 'oilwine';
    fastPeriod = 'weekly';
  }

  if (moveable?.fastFree || fixed?.fastFree) fast = 'fastfree';
  if (moveable?.fast) fast = moveable.fast;

  // A feast with its own fast level (fish on the Annunciation, strict on the Beheading, …) overrides
  // the season — but never Holy Week. (In the civil calendar the Annunciation can never fall in
  // Holy Week, since Pascha is never before 4 April; see the tests.)
  if (fixed?.fast && !moveable?.holyWeek) {
    fast = fixed.fast === 'strict' && WEEKEND_SOFTENED.has(key) && (dow === 0 || dow === 6)
      ? 'oilwine'
      : fixed.fast;
  }

  // Fast-free weeks override everything, the weekly Wednesday/Friday fast included.
  if (offset >= 0 && offset <= 6) { fast = 'fastfree'; fastPeriod = 'bright'; }
  if (offset >= -55 && offset <= -49) { fast = 'dairy'; fastPeriod = 'cheesefare'; }
  if (offset >= -70 && offset <= -64) { fast = 'fastfree'; fastPeriod = 'publican'; }
  if (offset >= 50 && offset <= 56) { fast = 'fastfree'; fastPeriod = 'afterPentecost'; }
  if ((m === 12 && d >= 26) || (m === 1 && d <= 4)) { fast = 'fastfree'; fastPeriod = 'afterNativity'; }

  return {
    date, dow,
    fixedFeast: fixed,
    moveableFeast: moveable,
    nzHoliday: nzHolidayOn(date),
    nationalDay: GREEK_NATIONAL_DAYS[key] ?? null,
    fast, fastPeriod,
    tone: getTone(date, pascha),
    isHolyWeek: !!moveable?.holyWeek,
    isPascha: offset === 0,
    isBrightWeek: offset >= 1 && offset <= 6,
    isSunday: dow === 0,
    paschaOffset: offset,
  };
}

// ── Presentation helpers ─────────────────────────────────────────────────────
export type Lang = 'en' | 'el';

export const feastName = (f: FeastData | null | undefined, lang: Lang) => (f ? f[lang] : '');

/** "Moveable · fixed" names for a day (either part may be missing). */
export function dayFeastNames(day: DayData, lang: Lang): string {
  return [feastName(day.moveableFeast, lang), feastName(day.fixedFeast, lang)].filter(Boolean).join(' · ');
}
/** Shorter label for a calendar cell: the moveable feast wins, otherwise the fixed one. */
export function dayShortName(day: DayData, lang: Lang): string {
  return feastName(day.moveableFeast, lang) || feastName(day.fixedFeast, lang);
}

export const fastLabel = (fast: FastType, lang: Lang) => FAST_LABEL[fast][lang];
export const fastPeriodLabel = (k: FastPeriodKey, lang: Lang) => FAST_PERIOD_LABEL[k][lang];

/** Which colour a day takes in the calendar grid and the list. */
export type DayKind =
  | 'pascha' | 'holyweek' | 'bright' | 'palm' | 'pentecost' | 'nativity' | 'great' | 'sunday' | 'plain';

export function dayKind(day: DayData): DayKind {
  const color = day.moveableFeast?.color ?? day.fixedFeast?.color;
  if (day.isPascha) return 'pascha';
  if (day.isHolyWeek) return 'holyweek';
  if (day.isBrightWeek) return 'bright';
  if (color === 'palm') return 'palm';
  if (color === 'pentecost') return 'pentecost';
  if (color === 'nativity') return 'nativity';
  if (day.moveableFeast?.tier === 'great' || day.fixedFeast?.tier === 'great') return 'great';
  if (day.isSunday) return 'sunday';
  return 'plain';
}
