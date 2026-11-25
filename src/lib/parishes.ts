// src/lib/parishes.ts
// Building a new parish record from the admin form: checks, the address-friendly id, ordering.
// Pure functions (tested); the form and Firestore calls live elsewhere.

import { PARISH_STATES } from './states';
import type { ParishState } from './states';
import { isMapUrl } from './mapUrl';
import type { Parish } from './firestore';

export interface ParishForm {
  state: string;
  nameEn: string; nameEl: string;
  cityEn: string; cityEl: string;
  descriptionEn: string; descriptionEl: string;
  address: string;                 // one address for both languages
  mapUrl: string;
}

export const emptyParishForm = (): ParishForm => ({
  state: PARISH_STATES[0].id, nameEn: '', nameEl: '', cityEn: '', cityEl: '',
  descriptionEn: '', descriptionEl: '', address: '', mapUrl: '',
});

export const LIMITS = { name: 120, city: 80, description: 2000, address: 500 } as const;

/** First problem with the form as a sentence, or null when it can be saved. */
export function checkParishForm(f: ParishForm): string | null {
  if (!PARISH_STATES.some(s => s.id === f.state)) return 'Please choose a state.';
  const need: [string, string][] = [
    [f.cityEn, 'the city in English'], [f.cityEl, 'the city in Greek'],
    [f.nameEn, 'the parish name in English'], [f.nameEl, 'the parish name in Greek'],
  ];
  for (const [v, what] of need) if (!v.trim()) return `Please enter ${what}.`;
  if (f.nameEn.trim().length > LIMITS.name || f.nameEl.trim().length > LIMITS.name) return `A parish name can have up to ${LIMITS.name} characters.`;
  if (f.cityEn.trim().length > LIMITS.city || f.cityEl.trim().length > LIMITS.city) return `A city can have up to ${LIMITS.city} characters.`;
  if (f.descriptionEn.trim().length > LIMITS.description || f.descriptionEl.trim().length > LIMITS.description)
    return `A description can have up to ${LIMITS.description} characters.`;
  const hasEn = !!f.descriptionEn.trim(), hasEl = !!f.descriptionEl.trim();
  if (hasEn !== hasEl) return hasEn ? 'Please add the description in Greek too, or clear the English one.' : 'Please add the description in English too, or clear the Greek one.';
  if (!f.address.trim()) return 'Please enter the address.';
  if (f.address.trim().length > LIMITS.address) return `The address can have up to ${LIMITS.address} characters.`;
  if (f.mapUrl.trim() && !isMapUrl(f.mapUrl.trim())) return 'The location must be a Google Maps link (for example from Share → Copy link).';
  return null;
}

/** Latin letters and digits only, words joined by dashes; '' when nothing is left. */
export function slugify(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
}

/** An id and address-friendly name that no existing parish uses. */
export function uniqueSlug(nameEn: string, cityEn: string, taken: string[], fallback = Date.now().toString(36)): string {
  const base = slugify(`${nameEn} ${cityEn}`) || `parish-${fallback}`;
  let slug = base, n = 2;
  while (taken.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}

/** The form filled in from an existing parish (editing). */
export function formFromParish(p: Parish): ParishForm {
  return {
    state: p.state ?? '', nameEn: p.nameEn ?? '', nameEl: p.nameEl ?? '', cityEn: p.city ?? '', cityEl: p.cityEl ?? '',
    descriptionEn: p.descriptionEn ?? '', descriptionEl: p.descriptionEl ?? '', address: p.address ?? '', mapUrl: p.mapUrl ?? '',
  };
}

/** The edited parish: what the form holds, with id, address-friendly name, order, visibility and groups kept as they were. */
export function buildParishUpdate(f: ParishForm, photoURL: string, old: Parish): Parish {
  return {
    id: old.id, slug: old.slug, state: f.state,
    nameEn: f.nameEn.trim(), nameEl: f.nameEl.trim(),
    city: f.cityEn.trim(), cityEl: f.cityEl.trim(), address: f.address.trim(),
    descriptionEn: f.descriptionEn.trim(), descriptionEl: f.descriptionEl.trim(),
    mapUrl: f.mapUrl.trim(), photoURL,
    groupIds: old.groupIds ?? [], accentColor: old.accentColor ?? '', order: old.order, visible: old.visible,
  };
}

/** The record to save. `existing` are the parishes already there (for the id and the order). */
export function buildParish(f: ParishForm, photoURL: string, existing: Pick<Parish, 'slug' | 'id' | 'order'>[]): Parish {
  const slug = uniqueSlug(f.nameEn, f.cityEn, existing.flatMap(p => [p.slug, p.id]));
  const order = existing.reduce((m, p) => Math.max(m, Number.isFinite(p.order) ? p.order : 0), 0) + 1;
  return {
    id: slug, slug, state: f.state,
    nameEn: f.nameEn.trim(), nameEl: f.nameEl.trim(),
    city: f.cityEn.trim(), cityEl: f.cityEl.trim(), address: f.address.trim(),
    descriptionEn: f.descriptionEn.trim(), descriptionEl: f.descriptionEl.trim(),
    mapUrl: f.mapUrl.trim(), photoURL,
    groupIds: [], accentColor: '', order, visible: true,
  };
}

export interface StateSection { state: ParishState | null; parishes: Parish[] }

/**
 * Parishes split by state, in the order of PARISH_STATES (New Zealand first). Inside a state the
 * parishes keep their `order`. Empty states are left out. A parish with no state, or one this list
 * does not know, goes in a last section with `state: null`, so it never disappears.
 */
export function groupByState(parishes: Parish[]): StateSection[] {
  const byOrder = (a: Parish, b: Parish) => (a.order ?? 0) - (b.order ?? 0);
  const known = new Set(PARISH_STATES.map(s => s.id));
  const sections: StateSection[] = PARISH_STATES.map(state => ({
    state, parishes: parishes.filter(p => p.state === state.id).sort(byOrder),
  }));
  sections.push({ state: null, parishes: parishes.filter(p => !p.state || !known.has(p.state)).sort(byOrder) });
  return sections.filter(s => s.parishes.length > 0);
}

/**
 * Moves one parish up (-1) or down (+1) inside its state's list (already in display order).
 * The state keeps the same set of `order` numbers, shared out again in the new sequence, so no other
 * state is touched. Returns only the parishes whose `order` changes ([] when the move is impossible).
 * If two parishes in the list share a number, the numbers are first made strictly increasing.
 */
export function moveParishInList(list: Parish[], index: number, dir: -1 | 1): { id: string; order: number }[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [];
  const slots: number[] = [];
  list.map(p => p.order ?? 0).sort((a, b) => a - b).forEach((v, i) => slots.push(i === 0 ? v : Math.max(v, slots[i - 1] + 1)));
  const next = list.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next
    .map((p, i) => ({ id: p.id, order: slots[i] }))
    .filter(x => x.order !== list.find(p => p.id === x.id)!.order);
}
