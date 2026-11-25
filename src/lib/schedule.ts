// src/lib/schedule.ts
// Pure helpers for the Services view (no React, no Firebase) so they can be
// tested with fixed timestamps.

import type { Parish, Group } from './firestore';

export const NZ_TZ = 'Pacific/Auckland';

/** Today's date on a New Zealand clock, "YYYY-MM-DD". */
export function todayNZ(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: NZ_TZ }).format(now);
}

export type Scope = 'all' | string[] | null;

/**
 * Turns the URL selection into a Firestore scope:
 *   parish slug  → that one parish
 *   group slug   → every visible parish in the group
 *   neither      → 'all'
 * Returns null when the slug is unknown, hidden, or the group has no visible
 * parishes (the page then shows "no services" instead of everything).
 */
export function resolveScope(
  sel: { parishSlug: string | null; groupSlug: string | null },
  parishes: Parish[],
  groups: Group[],
): Scope {
  const visible = parishes.filter(p => p.visible);
  if (sel.parishSlug) {
    const p = visible.find(x => x.slug === sel.parishSlug);
    return p ? [p.id] : null;
  }
  if (sel.groupSlug) {
    const g = groups.find(x => x.slug === sel.groupSlug);
    if (!g) return null;
    const ids = visible.filter(p => p.groupIds.includes(g.id)).map(p => p.id);
    return ids.length ? ids : null;
  }
  return 'all';
}
