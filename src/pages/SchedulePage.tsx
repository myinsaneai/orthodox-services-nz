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

const NZ_TZ = 'Pacific/Auckland';

function todayNZ(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: NZ_TZ }).format(new Date());
}

function formatWhen(s: Service, lang: 'en' | 'el'): string {
  const [y, m, d] = s.date.split('-').map(Number);
  const [hh, mm] = s.time.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const day = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-NZ', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(dt);
  const time = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-NZ', {
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }).format(dt);
  return `${day} · ${time}`;
}

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

  const groupSlug = params.get('group');
  const parishSlug = params.get('parish');

  useEffect(() => {
    const u1 = subscribeParishes(setParishes);
    const u2 = subscribeGroups(setGroups);
    return () => { u1(); u2(); };
  }, []);

  const visibleParishes = useMemo(() => parishes.filter(p => p.visible), [parishes]);
  const parishById = useMemo(
    () => Object.fromEntries(parishes.map(p => [p.id, p])) as Record<string, Parish>,
    [parishes],
  );

  // Resolve the URL selection to a Firestore scope.
  const scope: 'all' | string[] | null = useMemo(() => {
    if (parishSlug) {
      const p = visibleParishes.find(x => x.slug === parishSlug);
      return p ? [p.id] : null;
    }
    if (groupSlug) {
      const g = groups.find(x => x.slug === groupSlug);
      if (!g) return null;
      const ids = visibleParishes.filter(p => p.groupIds.includes(g.id)).map(p => p.id);
      return ids.length ? ids : null;
    }
    return 'all';
  }, [parishSlug, groupSlug, visibleParishes, groups]);

  const scopeKey = scope === 'all' ? 'all' : scope?.join(',') ?? 'none';

  useEffect(() => {
    if (scope === null) { setServices([]); setLoadingServices(false); return; }
    setLoadingServices(true);
    const unsub = subscribeUpcomingServices(scope, todayNZ(), s => {
      setServices(s);
      setLoadingServices(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const select = (next: Record<string, string>) => setParams(next, { replace: true });

  return (
    <>
      <div style={{ background: 'var(--color-cream)', padding: '20px 24px 18px', textAlign: 'center' }}>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26,
          color: 'var(--color-accent)',
        }}>
          {t('servicesHeading', lang)}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--color-hero-sub)', marginTop: 4 }}>
          {t('servicesSub', lang)}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 20px 40px' }}>
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
        ) : services.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>{t('noServices', lang)}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.map(s => {
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
