// src/pages/ParishesPage.tsx
// Directory of parishes; each links to its own schedule view.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { subscribeParishes, setParishOrder } from '../lib/firestore';
import type { Parish } from '../lib/firestore';
import type { ParishState } from '../lib/states';
import { DEFAULT_PARISH_ACCENT } from '../themes/tokens';
import { useRoleHint } from '../hooks/useRoleHint';
import { useFavourites } from '../hooks/useFavourites';
import { setFavourite } from '../lib/favourites';
import { isAtLeast } from '../lib/roles';
import { groupByState, moveParishInList } from '../lib/parishes';
import { stateById } from '../lib/states';
import { safeMapUrl } from '../lib/mapUrl';
import { safePhotoUrl } from '../lib/photoUrl';

export default function ParishesPage() {
  const { lang } = useLang();
  const [parishes, setParishes] = useState<Parish[]>([]);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');            // error code of a refused reorder, '' when fine

  useEffect(() => subscribeParishes(setParishes), []);
  // Admin buttons: shown from the stored role hint (display only; the Firestore rules decide who may write).
  const canManage = isAtLeast(useRoleHint(), 'admin');
  const favIds = useFavourites();
  const visible = useMemo(() => parishes.filter(p => p.visible), [parishes]);
  // Starred parishes go first, in one section (state by state, then in the usual order); the rest stay in their states.
  const favourites = useMemo(
    () => groupByState(visible.filter(p => favIds.includes(p.id))).flatMap(s => s.parishes),
    [visible, favIds],
  );
  const sections = useMemo(() => groupByState(visible.filter(p => !favIds.includes(p.id))), [visible, favIds]);

  // Up/down inside one state. Only the `order` of the parishes that swap places is written.
  async function move(list: Parish[], index: number, dir: -1 | 1) {
    const changes = moveParishInList(list, index, dir);
    if (changes.length === 0) return;
    setBusy(true); setFailed('');
    try { await setParishOrder(changes); } catch (e) { setFailed((e as { code?: string })?.code || 'error'); } finally { setBusy(false); }
  }

  // One parish card. In the favourites section the state is named beside the city and there are no move
  // buttons (that list mixes states); in a state section the admin gets the up/down buttons.
  const card = (p: Parish, fav: boolean, list: Parish[] = [], i = 0) => {
    const el = lang === 'el';
    const city = (el && p.cityEl) || p.city;
    const name = el ? p.nameEl : p.nameEn;
    const description = (el ? p.descriptionEl : p.descriptionEn) || '';
    const map = safeMapUrl(p.mapUrl);
    const st: ParishState | undefined = fav ? stateById(p.state) : undefined;
    const place = st ? `${city} · ${el ? st.nameEl : st.nameEn}` : city;
    return (
      <div key={p.id} style={{
        position: 'relative', padding: '12px 14px', border: '0.5px solid var(--color-card-border)',
        borderRadius: 8, background: 'var(--color-card-bg)',
      }}>
        <button
          type="button" className={`pc-fav${fav ? ' pc-fav--on' : ''}`} aria-pressed={fav}
          aria-label={`${t(fav ? 'removeFavourite' : 'addFavourite', lang)}: ${name}`}
          onClick={() => setFavourite(p.id, !fav)}
        >{fav ? '★' : '☆'}</button>
        <Link to={`/services?parish=${encodeURIComponent(p.slug)}&view=list`} style={{ display: 'block', textDecoration: 'none' }}>
          {safePhotoUrl(p.photoURL) && <img className="pc-photo" src={safePhotoUrl(p.photoURL)} alt="" loading="lazy" />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 34 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: p.accentColor || DEFAULT_PARISH_ACCENT,
            }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{place}</div>
        </Link>
        {description && <div className="pc-desc">{description}</div>}
        {p.address && <div className="pc-addr">{p.address}</div>}
        {map && (
          <a className="pc-map" href={map} target="_blank" rel="noopener noreferrer">{t('viewMap', lang)}</a>
        )}
        {canManage && (
          <div>
            <Link className="pc-edit" to={`/admin/parishes/${encodeURIComponent(p.id)}`}>{t('editParish', lang)}</Link>
            {!fav && (
              <div className="pc-order">
                <button type="button" disabled={busy || i === 0} aria-label={`${t('moveParishUp', lang)}: ${name}`}
                        onClick={() => move(list, i, -1)}>↑</button>
                <button type="button" disabled={busy || i === list.length - 1} aria-label={`${t('moveParishDown', lang)}: ${name}`}
                        onClick={() => move(list, i, 1)}>↓</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="hero">
        <h1>{t('parishesHeading', lang)}</h1>
        {canManage && (
          <div className="hero-actions">
            <Link to="/admin/parishes/new" className="btn-add">{t('addParish', lang)}</Link>
          </div>
        )}
      </div>

      <div className="page">
        {failed && <p role="alert" className="svc-error">{t('reorderFailed', lang)} ({failed})</p>}
        {favourites.length === 0 && visible.length > 0 && <p className="pc-hint">{t('favouritesHint', lang)}</p>}
        {favourites.length > 0 && (
          <section className="ps ps--fav" aria-labelledby="ps-favourites">
            <h2 className="ps-h" id="ps-favourites">★ {t('favourites', lang)}</h2>
            <div className="cards-grid cards-grid--parishes">
              {favourites.map(p => card(p, true))}
            </div>
          </section>
        )}
        {sections.map(({ state, parishes: list }) => (
          <section key={state?.id ?? 'other'} className="ps" aria-labelledby={`ps-${state?.id ?? 'other'}`}>
            <h2 className="ps-h" id={`ps-${state?.id ?? 'other'}`}>
              {state ? (lang === 'el' ? state.nameEl : state.nameEn) : t('otherState', lang)}
            </h2>
            <div className="cards-grid cards-grid--parishes">
              {list.map((p, i) => card(p, false, list, i))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
