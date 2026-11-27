// src/pages/SchedulePage.tsx
// Calendar (the Services page): the posted schedules, as a Calendar or a List, for one month at a time. The URL holds
// the selection, so a view can be shared or bookmarked:
//   /services                          all parishes, current month, calendar
//   ?group=<slug>  /  ?parish=<slug>   a named group of parishes / a single parish
//   ?month=2026-12                     the month (default: this month, New Zealand time)
//   ?view=list                         the list (default: the calendar grid; ?view=calendar still works)

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { subscribeParishes, subscribeGroups, subscribeServiceDaysForMonth } from '../lib/firestore';
import type { Parish, Group, ServiceDay } from '../lib/firestore';
import { todayNZ, resolveScope } from '../lib/schedule';
import { addMonths, isMonth, monthOf } from '../lib/dates';
import { isAtLeast } from '../lib/roles';
import { useRoleHint } from '../hooks/useRoleHint';
import { monthTitle } from '../lib/monthFormat';
import { entriesByDate } from '../lib/serviceDays';
import ServiceList from '../components/ServiceList';
import ServiceCalendar from '../components/ServiceCalendar';

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  background: active ? 'var(--color-primary)' : 'transparent',
  color: active ? 'var(--color-cream)' : 'var(--color-muted)',
  border: active ? '0.5px solid var(--color-primary)' : '0.5px solid var(--color-card-border)',
});

interface Loaded { ym: string; days: ServiceDay[]; error: boolean }

export default function SchedulePage() {
  const { lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  // Until the parish list has arrived, a ?parish= / ?group= slug cannot be resolved.
  const [parishesLoaded, setParishesLoaded] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // A hint only: it decides whether to show the Edit links. The editor page and the rules do the real check.
  const canEdit = isAtLeast(useRoleHint(), 'coordinator');

  const groupSlug = params.get('group');
  const parishSlug = params.get('parish');
  const view = params.get('view') === 'list' ? 'list' : 'calendar';
  const today = useMemo(() => todayNZ(), []);
  const monthParam = params.get('month');
  const ym = isMonth(monthParam) ? monthParam : monthOf(today);

  useEffect(() => {
    const u1 = subscribeParishes(p => { setParishes(p); setParishesLoaded(true); });
    const u2 = subscribeGroups(setGroups);
    return () => { u1(); u2(); };
  }, []);

  useEffect(
    () => subscribeServiceDaysForMonth(
      ym,
      days => setLoaded({ ym, days, error: false }),
      () => setLoaded({ ym, days: [], error: true }),
    ),
    [ym],
  );
  const loading = loaded?.ym !== ym || !parishesLoaded;

  const visibleParishes = useMemo(() => parishes.filter(p => p.visible), [parishes]);
  const scope = useMemo(
    () => resolveScope({ parishSlug, groupSlug }, parishes, groups),
    [parishSlug, groupSlug, parishes, groups],
  );
  const entries = useMemo(
    () => entriesByDate(loaded?.ym === ym ? loaded.days : [], parishes, scope, lang),
    [loaded, ym, parishes, scope, lang],
  );
  // A single parish needs no parish names; "all" and groups do.
  const editParish = parishSlug && Array.isArray(scope) && scope.length === 1 ? `&parish=${encodeURIComponent(parishSlug)}` : '';
  const multi = scope === 'all' || (Array.isArray(scope) && scope.length > 1);

  // Change one part of the selection and keep the others.
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };
  const selectScope = (next: { group?: string; parish?: string }) =>
    update({ group: next.group ?? null, parish: next.parish ?? null });
  const goMonth = (target: string) => update({ month: target === monthOf(today) ? null : target });

  return (
    <>
      <div className="hero">
        <h1>{t('servicesHeading', lang)}</h1>
        <div className="hero-sub">{t('servicesSub', lang)}</div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button type="button" style={chip(!groupSlug && !parishSlug)} onClick={() => selectScope({})}>
            {t('allParishes', lang)}
          </button>
          {groups.map(g => (
            <button
              key={g.id} type="button" style={chip(groupSlug === g.slug)}
              onClick={() => selectScope({ group: g.slug })}
            >
              {lang === 'el' ? g.nameEl : g.nameEn}
            </button>
          ))}
          {visibleParishes.length > 0 && (
            <select
              aria-label={t('navParishes', lang)}
              value={parishSlug ?? ''}
              onChange={e => selectScope(e.target.value ? { parish: e.target.value } : {})}
              style={{ ...chip(!!parishSlug), appearance: 'auto' }}
            >
              <option value="">{t('navParishes', lang)}…</option>
              {visibleParishes.map(p => (
                <option key={p.id} value={p.slug}>{lang === 'el' ? p.nameEl : p.nameEn}</option>
              ))}
            </select>
          )}
        </div>

        <div className="svc-toolbar">
          <button type="button" className="svc-nav" aria-label={t('prevMonth', lang)} onClick={() => goMonth(addMonths(ym, -1))}>←</button>
          <h2 className="svc-month" aria-live="polite">{monthTitle(ym, lang)}</h2>
          <button type="button" className="svc-nav" aria-label={t('nextMonth', lang)} onClick={() => goMonth(addMonths(ym, 1))}>→</button>
          {ym !== monthOf(today) && (
            <button type="button" className="svc-btn" onClick={() => goMonth(monthOf(today))}>{t('thisMonth', lang)}</button>
          )}
          {canEdit && <Link className="svc-btn" to={`/admin/schedule?month=${ym}${editParish}`}>{t('editSchedule', lang)}</Link>}
          <div className="svc-views" role="group">
            {(['calendar', 'list'] as const).map(v => (
              <button
                key={v} type="button" aria-pressed={view === v}
                className={view === v ? 'svc-views__on' : undefined}
                onClick={() => update({ view: v === 'calendar' ? null : v })}
              >
                {t(v === 'list' ? 'viewList' : 'viewCalendar', lang)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-muted)' }}>{t('loading', lang)}</p>
        ) : loaded?.error ? (
          <p role="alert" className="svc-error">{t('scheduleLoadFailed', lang)}</p>
        ) : view === 'list' ? (
          <ServiceList key={ym} ym={ym} lang={lang} entries={entries} multi={multi} />
        ) : (
          <ServiceCalendar
            key={ym} ym={ym} lang={lang} entries={entries} multi={multi} today={today}
            editHref={canEdit ? date => `/admin/schedule?month=${ym}&date=${date}${editParish}` : undefined}
          />
        )}
      </div>
    </>
  );
}
