// src/lib/scheduleDocs.ts
// What the schedule editor writes, as pure functions (no Firebase), so a test can hold the fields
// we send against the fields firestore.rules allows. The document id is never a field.

import type { ServiceTemplate, ServiceEntryType } from './firestore';
import { monthOf } from './dates';

/** Longest schedule text per language per day (the rules enforce the same limit). */
export const DAY_TEXT_MAX = 4000;
export const NAME_MAX = 100;
export const LINE_MAX = 200;

export const serviceDayId = (parishId: string, date: string) => `${parishId}_${date}`;

/** Windows line endings → "\n", trailing spaces off every line, blank lines at the ends removed. */
export function cleanText(s: string): string {
  return s.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
}

/** Adds a line at the end of a text box ("+ Divine Liturgy"). */
export function appendLine(text: string, line: string): string {
  const base = text.replace(/\s+$/, '');
  return base ? `${base}\n${line}` : line;
}

/** The fields of a serviceDays document (the editor adds `updatedAt`). */
export function serviceDayPayload(parishId: string, date: string, entriesEn: string, entriesEl: string) {
  return { parishId, date, yearMonth: monthOf(date), entriesEn: cleanText(entriesEn), entriesEl: cleanText(entriesEl) };
}

/** A day with no text in either language is removed rather than saved empty. */
export const isEmptyDay = (en: string, el: string) => cleanText(en) === '' && cleanText(el) === '';

export function templatePayload(t: ServiceTemplate) {
  return {
    nameEn: t.nameEn.trim(), nameEl: t.nameEl.trim(),
    entriesEn: cleanText(t.entriesEn), entriesEl: cleanText(t.entriesEl),
    order: t.order,
  };
}
export function entryTypePayload(e: ServiceEntryType) {
  return { textEn: e.textEn.trim(), textEl: e.textEl.trim(), order: e.order };
}

export const templateComplete = (t: Pick<ServiceTemplate, 'nameEn' | 'nameEl'>) => t.nameEn.trim() !== '' && t.nameEl.trim() !== '';
export const entryTypeComplete = (e: Pick<ServiceEntryType, 'textEn' | 'textEl'>) => e.textEn.trim() !== '' && e.textEl.trim() !== '';

/** The `order` for a new item: after every existing one. */
export const nextOrder = (items: { order: number }[]) => items.reduce((m, i) => Math.max(m, i.order), -1) + 1;

/**
 * Moves one item up (-1) or down (+1). Returns the items that must be rewritten with their new
 * `order` (just the two that swapped places, after renumbering the list 0…n-1), or [] when the move
 * is impossible (first item up, last item down).
 */
export function moveItem<T extends { id: string; order: number }>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [];
  const next = list.map(i => ({ ...i }));
  [next[index], next[to]] = [next[to], next[index]];
  next.forEach((item, i) => { item.order = i; });
  return next.filter((item, i) => item.order !== list[i]?.order || item.id !== list[i]?.id);
}
