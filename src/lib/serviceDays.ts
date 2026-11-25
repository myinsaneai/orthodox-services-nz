// src/lib/serviceDays.ts
// Pure helpers for the Services List and Calendar: turn the posted per-day schedules of the parishes
// into what a month view shows. No React, no Firebase (types only).

import type { Parish, ServiceDay } from './firestore';
import type { Scope } from './schedule';
import type { Lang } from '../contexts/LangContext';

/** One parish's posted schedule for one day, in the language to show. */
export interface ParishEntry {
  parishId: string;
  parish: Parish;
  text: string;
}

/** A parish's name in the viewer's language. */
export const parishName = (e: Pick<ParishEntry, 'parish'>, lang: Lang) =>
  (lang === 'el' ? e.parish.nameEl : e.parish.nameEn) || e.parish.nameEn;

/** The text in the viewer's language, falling back to the other language when it is empty. */
export function entryText(d: Pick<ServiceDay, 'entriesEn' | 'entriesEl'>, lang: Lang): string {
  const en = (d.entriesEn ?? '').trim();
  const el = (d.entriesEl ?? '').trim();
  return lang === 'el' ? el || en : en || el;
}

/**
 * Groups posted days by date, keeping only visible parishes that are in scope and entries that
 * actually have text. Parishes are listed in their own order (then by name) on each day.
 * While the parish list is still empty (not loaded), nothing is shown.
 */
export function entriesByDate(
  days: ServiceDay[],
  parishes: Parish[],
  scope: Scope,
  lang: Lang,
): Record<string, ParishEntry[]> {
  if (scope === null) return {};
  const visible = new Map(parishes.filter(p => p.visible).map(p => [p.id, p]));
  const out: Record<string, ParishEntry[]> = {};
  for (const d of days) {
    const parish = visible.get(d.parishId);
    if (!parish) continue;
    if (scope !== 'all' && !scope.includes(d.parishId)) continue;
    const text = entryText(d, lang);
    if (!text) continue;
    (out[d.date] ??= []).push({ parishId: d.parishId, parish, text });
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => a.parish.order - b.parish.order || parishName(a, lang).localeCompare(parishName(b, lang), lang));
  }
  return out;
}

/** Lines of an entry, without blank ones. */
export const entryLines = (text: string): string[] => text.split('\n').map(l => l.trim()).filter(Boolean);

/** Splits a line into parts so that clock times ("9:30", "18:00") can be shown in bold. */
export function splitTimes(line: string): { text: string; time: boolean }[] {
  return line
    .split(/(\b\d{1,2}[:.]\d{2}\b)/)
    .filter(p => p !== '')
    .map(p => ({ text: p, time: /^\d{1,2}[:.]\d{2}$/.test(p) }));
}
