import { describe, it, expect } from 'vitest';
import {
  computePascha, getPascha, getDayData, getFastingPeriods, getTone, toneLabel,
  dayKind, dayFeastNames, dayShortName, fastLabel,
} from '../src/lib/orthodoxCalendar';
import { FIXED_FEASTS, MOVEABLE_OFFSETS, FAST_LABEL, FAST_PERIOD_LABEL, FAST_COLOR } from '../src/lib/greekFeasts';
import { addDays, weekday } from '../src/lib/dates';

const fast = (d: string) => getDayData(d).fast;

describe('Pascha (Julian paschalion, shown on the civil calendar)', () => {
  it.each([
    [2023, '2023-04-16'], [2024, '2024-05-05'], [2025, '2025-04-20'], [2026, '2026-04-12'],
    [2027, '2027-05-02'], [2028, '2028-04-16'], [2029, '2029-04-08'], [2030, '2030-04-28'],
    [2031, '2031-04-13'], [2032, '2032-05-02'], [2033, '2033-04-24'],
  ])('%i → %s', (y, d) => expect(computePascha(y)).toBe(d));

  it('is always a Sunday between 4 April and 8 May (2000–2099)', () => {
    for (let y = 2000; y <= 2099; y++) {
      const p = getPascha(y);
      expect(weekday(p), p).toBe(0);
      expect(p >= `${y}-04-04` && p <= `${y}-05-08`, p).toBe(true);
    }
  });
});

describe('feast tables', () => {
  it('every fixed feast is a real calendar day, with an English and a Greek name', () => {
    for (const [key, feast] of Object.entries(FIXED_FEASTS)) {
      const [m, d] = key.split('-').map(Number);
      expect(m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(2024, m, 0)).getUTCDate(), key).toBe(true);
      expect(feast.en.length, key).toBeGreaterThan(3);
      expect(/[Α-Ωα-ω]/.test(feast.el), `${key} needs a Greek name`).toBe(true);
    }
  });
  it('every moveable feast has a Greek name and falls on the weekday its name says', () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const [off, feast] of Object.entries(MOVEABLE_OFFSETS)) {
      expect(/[Α-Ωα-ω]/.test(feast.el), off).toBe(true);
      const dow = ((Number(off) % 7) + 7) % 7;
      const named = days.findIndex(n => new RegExp(`\\b${n}\\b`).test(feast.en.split(' of ')[0].split(' — ')[0]));
      if (named >= 0) expect(dow, `${feast.en} (${off})`).toBe(named);
    }
  });
  it('has a label and colour for every fast type and fasting period', () => {
    Object.keys(FAST_LABEL).forEach(k => {
      expect(FAST_COLOR[k as keyof typeof FAST_COLOR]).toMatch(/^#[0-9A-F]{6}$/i);
    });
    Object.values(FAST_PERIOD_LABEL).forEach(l => { expect(l.en).toBeTruthy(); expect(/[Α-Ωα-ω]/.test(l.el)).toBe(true); });
  });
});

describe('fixed feasts use civil dates (Revised Julian), not the Russian Julian dates', () => {
  it('Nativity is 25 December and Theophany 6 January', () => {
    expect(getDayData('2026-12-25').fixedFeast?.en).toMatch(/^Nativity of Our Lord/);
    expect(getDayData('2026-01-06').fixedFeast?.en).toMatch(/Theophany/);
  });
  it('7 January is the Synaxis of the Forerunner, not Christmas', () => {
    expect(getDayData('2026-01-07').fixedFeast?.en).toMatch(/Synaxis of St John/);
  });
  it('finds the Dormition, Transfiguration, Annunciation and Nektarios on their civil dates', () => {
    expect(getDayData('2026-08-15').fixedFeast?.en).toBe('Dormition of the Theotokos');
    expect(getDayData('2026-08-06').fixedFeast?.en).toMatch(/Transfiguration/);
    expect(getDayData('2026-03-25').fixedFeast?.en).toMatch(/Annunciation/);
    expect(getDayData('2026-11-09').fixedFeast?.el).toBe('Άγιος Νεκτάριος Πενταπόλεως');
  });
  it('notes the Greek national days', () => {
    expect(getDayData('2026-03-25').nationalDay?.en).toBe('Greek Independence Day');
    expect(getDayData('2026-10-28').nationalDay?.en).toBe('Ochi Day');
    expect(getDayData('2026-10-27').nationalDay).toBeNull();
  });
});

describe('moveable feasts follow Pascha', () => {
  // 2026: Pascha 12 April.
  it('places the Triodion and Lent', () => {
    expect(getDayData('2026-02-01').moveableFeast?.en).toMatch(/Publican/);
    expect(getDayData('2026-02-08').moveableFeast?.en).toMatch(/Prodigal/);
    expect(getDayData('2026-02-23').moveableFeast?.en).toMatch(/Clean Monday/);
    expect(getDayData('2026-03-01').moveableFeast?.en).toBe('Sunday of Orthodoxy');
  });
  it('places Holy Week, Pascha and Bright Week', () => {
    expect(getDayData('2026-04-05').moveableFeast?.en).toMatch(/Palm Sunday/);
    expect(getDayData('2026-04-10').moveableFeast?.el).toBe('Μεγάλη Παρασκευή — Άγια Πάθη');
    const p = getDayData('2026-04-12');
    expect(p.isPascha).toBe(true);
    expect(p.moveableFeast?.el).toMatch(/ΠΑΣΧΑ/);
    expect(getDayData('2026-04-13').isBrightWeek).toBe(true);
    expect(getDayData('2026-04-18').isBrightWeek).toBe(true);
    expect(getDayData('2026-04-19').isBrightWeek).toBe(false);
  });
  it('places Ascension, Pentecost and All Saints', () => {
    expect(getDayData('2026-05-21').moveableFeast?.en).toBe('Ascension of the Lord');
    expect(getDayData('2026-05-31').moveableFeast?.en).toMatch(/^Pentecost/);
    expect(getDayData('2026-06-07').moveableFeast?.en).toBe('Sunday of All Saints');
  });
  it('shows both a moveable and a fixed feast when they coincide', () => {
    // 2026: the Annunciation (25 March) falls on a Wednesday in Great Lent.
    expect(dayFeastNames(getDayData('2026-03-25'), 'en')).toMatch(/Annunciation/);
    // 2027: Pascha is 2 May, so Palm Sunday is 25 April and St Mark (25 April) shares the day.
    expect(dayFeastNames(getDayData('2027-04-25'), 'en')).toBe('Palm Sunday — Entry into Jerusalem · St Mark the Apostle and Evangelist');
    expect(dayShortName(getDayData('2027-04-25'), 'el')).toMatch(/Βαΐων/);
  });
});

describe('fasting', () => {
  it('Great Lent: strict Monday–Friday, oil & wine on weekends', () => {
    expect(fast('2026-02-23')).toBe('strict');   // Clean Monday
    expect(fast('2026-02-28')).toBe('oilwine');  // Saturday
    expect(fast('2026-03-01')).toBe('oilwine');  // Sunday of Orthodoxy
    expect(getDayData('2026-03-04').fastPeriod).toBe('greatLent');
  });
  it('Great Lent: fish on Palm Sunday and the Annunciation; Holy Week is strict; Holy Friday total', () => {
    expect(fast('2026-04-05')).toBe('fish');
    expect(fast('2026-03-25')).toBe('fish');
    expect(fast('2026-04-07')).toBe('strict');
    expect(fast('2026-04-09')).toBe('strict');
    expect(fast('2026-04-10')).toBe('totalfast');
    expect(fast('2026-04-11')).toBe('strict');
  });
  it('the Annunciation never falls in Holy Week or Bright Week (Pascha is never before 4 April)', () => {
    for (let y = 2000; y <= 2099; y++) {
      const d = getDayData(`${y}-03-25`);
      expect(d.isHolyWeek || d.isBrightWeek || d.isPascha, String(y)).toBe(false);
      expect(d.fast, String(y)).toBe('fish');
    }
  });
  it('Forty Martyrs allow oil & wine even on a weekday of Lent', () => {
    expect(fast('2026-03-09')).toBe('oilwine'); // Monday
  });
  it('Cheesefare week allows dairy; the Publican week and Bright Week are fast-free', () => {
    expect(fast('2026-02-16')).toBe('dairy');
    expect(fast('2026-02-22')).toBe('dairy');
    expect(getDayData('2026-02-18').fastPeriod).toBe('cheesefare');
    expect(fast('2026-02-01')).toBe('fastfree');
    expect(fast('2026-02-04')).toBe('fastfree'); // a Wednesday: the weekly fast is lifted
    expect(fast('2026-04-15')).toBe('fastfree');
    expect(fast('2026-04-12')).toBe('fastfree');
  });
  it('the week after Pentecost is fast-free and the Apostles\' Fast starts the Monday after All Saints', () => {
    expect(fast('2026-06-01')).toBe('fastfree');
    expect(fast('2026-06-07')).toBe('fastfree');
    expect(fast('2026-06-08')).toBe('strict');
    expect(getDayData('2026-06-08').fastPeriod).toBe('apostles');
  });
  it("Apostles' Fast: strict Mon/Wed/Fri, oil & wine Tue/Thu, fish at the weekend, relaxed on a major saint", () => {
    expect(fast('2026-06-10')).toBe('strict');
    expect(fast('2026-06-09')).toBe('oilwine');
    expect(fast('2026-06-13')).toBe('fish');
    expect(fast('2026-06-28')).toBe('fish');
    expect(fast('2026-06-24')).toBe('oilwine'); // Nativity of the Forerunner, a Wednesday
    expect(fast('2026-06-29')).toBeNull();      // Peter and Paul, a Monday: the fast has ended
  });
  it("the Apostles' Fast is short when Pascha is late, and absent when very late", () => {
    const len = (y: number) => {
      const p = getFastingPeriods(y).find(x => x.key === 'apostles')!;
      return p.start > p.end ? 0 : (new Date(p.end).getTime() - new Date(p.start).getTime()) / 86400000 + 1;
    };
    expect(len(2026)).toBe(21);
    expect(len(2027)).toBe(1);
    expect(len(2024)).toBe(0);
    expect(fast('2024-07-01')).toBeNull(); // Monday after All Saints 2024 is already past 28 June
  });
  it('Dormition Fast: 1–14 August, fish on the Transfiguration, none on the Dormition', () => {
    expect(getDayData('2026-07-31').fastPeriod).not.toBe('dormition');
    expect(fast('2026-08-03')).toBe('strict');  // Monday
    expect(fast('2026-08-08')).toBe('oilwine'); // Saturday
    expect(fast('2026-08-06')).toBe('fish');
    expect(fast('2026-08-14')).toBe('strict');  // Friday, last day of the fast
    expect(fast('2026-08-15')).toBe('fastfree');
  });
  it('Nativity Fast: 15 November – 24 December, no fish from 20 December, strict Eve', () => {
    expect(getDayData('2026-11-14').fastPeriod).not.toBe('nativity');
    expect(getDayData('2026-11-15').fastPeriod).toBe('nativity');
    expect(fast('2026-11-21')).toBe('fish');     // Entry of the Theotokos
    expect(fast('2026-11-28')).toBe('fish');     // Saturday
    expect(fast('2026-12-06')).toBe('fish');     // St Nicholas
    expect(fast('2026-12-19')).toBe('fish');     // Saturday
    expect(fast('2026-12-20')).toBe('oilwine');  // Sunday, no fish from 20 December
    expect(fast('2026-12-24')).toBe('strict');   // Eve of the Nativity (a Thursday)
  });
  it('the two Eves soften to oil & wine when they fall on a Saturday or Sunday', () => {
    expect(weekday('2022-12-24')).toBe(6);
    expect(fast('2022-12-24')).toBe('oilwine');
    expect(weekday('2025-01-05')).toBe(0);
    expect(fast('2025-01-05')).toBe('oilwine');
    expect(fast('2026-01-05')).toBe('strict');   // a Monday
  });
  it('Nativity to Theophany is fast-free (25 December – 4 January)', () => {
    expect(fast('2026-12-25')).toBe('fastfree');
    expect(fast('2026-12-30')).toBe('fastfree'); // a Wednesday
    expect(fast('2027-01-04')).toBe('fastfree');
    expect(getDayData('2026-12-30').fastPeriod).toBe('afterNativity');
  });
  it('outside the seasons Wednesday and Friday are oil & wine days, relaxed to fish on a great feast', () => {
    expect(fast('2026-10-14')).toBe('oilwine');  // Wednesday
    expect(getDayData('2026-10-14').fastPeriod).toBe('weekly');
    expect(fast('2026-10-16')).toBe('oilwine');  // Friday
    expect(fast('2026-10-15')).toBeNull();       // Thursday
    expect(fast('2026-10-12')).toBeNull();       // Monday
    expect(fast('2026-09-14')).toBe('strict');   // Exaltation of the Cross (Monday)
    expect(fast('2026-08-29')).toBe('strict');   // Beheading of the Forerunner (a Saturday) stays strict
    expect(fast('2026-09-08')).toBeNull();       // Nativity of the Theotokos, Tuesday
    expect(fast('2025-09-08')).toBeNull();
    expect(fast('2027-09-08')).toBe('fish');     // a Wednesday: a great feast relaxes the weekly fast
  });
});

describe('tone', () => {
  it('starts at tone 1 on Thomas Sunday and runs through eight Sundays', () => {
    expect(getDayData('2026-04-19').tone).toBe(1);
    expect(getDayData('2026-04-26').tone).toBe(2);
    expect(getDayData('2026-05-31').tone).toBe(7);  // Pentecost
    expect(getDayData('2026-06-07').tone).toBe(8);  // All Saints
    expect(getDayData('2026-06-14').tone).toBe(1);  // the cycle repeats
  });
  it('has no tone from Palm Sunday to Bright Saturday', () => {
    expect(getDayData('2026-04-05').tone).toBeNull();
    expect(getDayData('2026-04-08').tone).toBeNull();
    expect(getDayData('2026-04-18').tone).toBeNull();
    expect(getTone('2026-04-04', getPascha(2026))).not.toBeNull();   // Lazarus Saturday still has one
  });
  it('is the same all week (Sunday to Saturday)', () => {
    expect(getDayData('2026-06-15').tone).toBe(1);
    expect(getDayData('2026-06-20').tone).toBe(1);
    expect(getDayData('2026-06-21').tone).toBe(2);
  });
  it('carries the previous Pascha cycle into January and February', () => {
    const t = getDayData('2026-01-11').tone;
    expect(t).toBeGreaterThanOrEqual(1);
    expect(t).toBeLessThanOrEqual(8);
  });
  it('is labelled in both languages', () => {
    expect(toneLabel(3, 'en')).toBe('Tone 3');
    expect(toneLabel(3, 'el')).toBe('Ήχος γ΄');
    expect(toneLabel(5, 'el')).toBe('Ήχος πλ. α΄');
    expect(toneLabel(7, 'el')).toBe('Ήχος βαρύς');
  });
});

describe('day kinds (colours)', () => {
  it('maps the special days', () => {
    expect(dayKind(getDayData('2026-04-12'))).toBe('pascha');
    expect(dayKind(getDayData('2026-04-08'))).toBe('holyweek');
    expect(dayKind(getDayData('2026-04-14'))).toBe('bright');
    expect(dayKind(getDayData('2026-04-05'))).toBe('palm');
    expect(dayKind(getDayData('2026-05-31'))).toBe('pentecost');
    expect(dayKind(getDayData('2026-12-25'))).toBe('nativity');
    expect(dayKind(getDayData('2026-08-15'))).toBe('great');
    expect(dayKind(getDayData('2026-05-21'))).toBe('great');   // Ascension
    expect(dayKind(getDayData('2026-11-22'))).toBe('sunday');
    expect(dayKind(getDayData('2026-11-24'))).toBe('plain');
  });
});

describe('labels', () => {
  it('gives the fast in both languages', () => {
    expect(fastLabel('fish', 'en')).toBe('Fish allowed');
    expect(fastLabel('strict', 'el')).toBe('Αυστηρή νηστεία');
  });
  it('does not skip or repeat a day over many years (every date resolves)', () => {
    let d = '2024-01-01';
    for (let i = 0; i < 1461; i++) { getDayData(d); d = addDays(d, 1); }
    expect(d).toBe('2028-01-01');
  });
});
