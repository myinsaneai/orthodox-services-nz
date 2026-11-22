// src/lib/schedule.ts
// Pure helpers for the Services view (no React, no Firebase) so they can be
// tested with fixed timestamps.

import type { Lang } from '../contexts/LangContext';
import type { Parish, Group, Service } from './firestore';

export const NZ_TZ = 'Pacific/Auckland';

/** Today's date on a New Zealand clock, "YYYY-MM-DD". */
export function todayNZ(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: NZ_TZ }).format(now);
}

/**
 * "Sun 29 Nov · 9:30 am". Service date and time are NZ wall-clock values, so
 * they are formatted as-is (via UTC) with no timezone conversion.
 */
export function formatWhen(s: Pick<Service, 'date' | 'time'>, lang: Lang): string {
  const [y, m, d] = s.date.split('-').map(Number);
  const [hh, mm] = s.time.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const locale = lang === 'el' ? 'el-GR' : 'en-NZ';
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(dt);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }).format(dt);
  return `${day} · ${time}`;
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

/** Stable string for a scope, used as an effect dependency. */
export function scopeKey(scope: Scope): string {
  return scope === 'all' ? 'all' : scope ? scope.join(',') : 'none';
}

/**
 * Drops services that belong to a hidden or missing parish. The "all parishes"
 * query cannot filter on a parish's `visible` flag, so it is applied here.
 * While the parish list is still empty (not loaded) nothing is dropped.
 */
export function visibleServices(services: Service[], parishes: Parish[]): Service[] {
  if (parishes.length === 0) return services;
  const ok = new Set(parishes.filter(p => p.visible).map(p => p.id));
  return services.filter(s => ok.has(s.parishId));
}
