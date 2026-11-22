// src/pages/SchedulePage.tsx
// Services view. One page, three scopes selected via the URL:
//   /services                  → all parishes
//   /services?group=<slug>     → a named group of parishes
//   /services?parish=<slug>    → a single parish

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import {
  subscribeParishes, subscribeGroups, subscribeUpcomingServices,
} from '../lib/firestore';
import type { Parish, Group, Service } from '../lib/firestore';
import { DEFAULT_PARISH_ACCENT } from '../themes/tokens';
import { todayNZ, formatWhen, resolveScope, scopeKey, visibleServices } from '../lib/schedule';

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  background: active ? 'var(--color-primary)' : 'transparent',
  color: active ? 'var(--color-cream)' : 'var(--color-muted)',
  border: active ? '0.5px solid var(--color-primary)' : '0.5px solid var(--color-card-border)',
});

export default function SchedulePage() {
  const { lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  // Until the parish list has arrived, a ?parish= / ?group= slug cannot be
  // resolved, so show "Loading…" instead of a false "No upcoming services".
  const [parishesLoaded, setParishesLoaded] = useState(false);

  const groupSlug = params.get('group');
  const parishSlug = params.get('parish');

  useEffect(() => {
    const u1 = subscribeParishes(p => { setParishes(p); setParishesLoaded(true); });
    const u2 = subscribeGroups(setGroups);
    return () => { u1(); u2(); };
  }, []);

  const visibleParishes = useMemo(() => parishes.filter(p => p.visible), [parishes]);
  const parishById = useMemo(
    () => Object.fromEntries(parishes.map(p => [p.id, p])) as Record<string, Parish>,
    [parishes],
  );

  // Resolve the URL selection to a Firestore scope.
  const scope = useMemo(
    () => resolveScope({ parishSlug, groupSlug }, parishes, groups),
    [parishSlug, groupSlug, parishes, groups],
  );
  const key = scopeKey(scope);
  const unresolved = scope === null && !parishesLoaded;

  useEffect(() => {
    if (scope === null) {
      setServices([]);
      setLoadingServices(unresolved);
      return;
    }
    setLoadingServices(true);
    const unsub = subscribeUpcomingServices(scope, todayNZ(), s => {
      setServices(s);
      setLoadingServices(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, unresolved]);

  const shown = useMemo(() => visibleServices(services, parishes), [services, parishes]);

  const select = (next: Record<string, string>) => setParams(next, { replace: true });

  return (
    <>
      <div className="hero">
        <h1>{t('servicesHeading', lang)}</h1>
        <div className="hero-sub">{t('servicesSub', lang)}</div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button type="button" style={chip(!groupSlug && !parishSlug)} onClick={() => select({})}>
            {t('allParishes', lang)}
          </button>
          {groups.map(g => (
            <button
              key={g.id} type="button" style={chip(groupSlug === g.slug)}
              onClick={() => select({ group: g.slug })}
            >
              {lang === 'el' ? g.nameEl : g.nameEn}
            </button>
          ))}
          {visibleParishes.length > 0 && (
            <select
              aria-label={t('navParishes', lang)}
              value={parishSlug ?? ''}
              onChange={e => (e.target.value ? select({ parish: e.target.value }) : select({}))}
              style={{ ...chip(!!parishSlug), appearance: 'auto' }}
            >
              <option value="">{t('navParishes', lang)}…</option>
              {visibleParishes.map(p => (
                <option key={p.id} value={p.slug}>{lang === 'el' ? p.nameEl : p.nameEn}</option>
              ))}
            </select>
          )}
        </div>

        {loadingServices ? (
          <p style={{ color: 'var(--color-muted)' }}>{t('loading', lang)}</p>
        ) : shown.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>{t('noServices', lang)}</p>
        ) : (
          <div className="cards-grid">
            {shown.map(s => {
              const parish = parishById[s.parishId];
              const parishName = parish ? (lang === 'el' ? parish.nameEl : parish.nameEn) : '';
              const title = lang === 'el' ? s.titleEl || s.titleEn : s.titleEn;
              const notes = lang === 'el' ? s.notesEl || s.notesEn : s.notesEn;
              return (
                <div key={s.id} style={{
                  display: 'flex', gap: 10, alignItems: 'stretch', padding: '10px 12px',
                  border: '0.5px solid var(--color-card-border)', borderRadius: 8,
                  background: 'var(--color-card-bg)',
                }}>
                  <div style={{
                    width: 4, borderRadius: 2,
                    background: parish?.accentColor || DEFAULT_PARISH_ACCENT,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {parishName}{parishName && ' — '}{title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{formatWhen(s, lang)}</div>
                    {notes && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
